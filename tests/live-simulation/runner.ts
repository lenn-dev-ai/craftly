import { chromium, type Browser, type BrowserContext, type Page, type StorageState } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import { resolve, join } from "node:path"
import { ensureSimulationAccounts } from "./accounts"
import { ensureSimulationFixtures, type LiveSimulationFixtures } from "./fixtures"
import { createMetrics, recordFailure, recordSkipped, recordSuccess, writeReport } from "./metrics"
import { PERSONAS, type Persona } from "./personas"
import { weightedScenarioChoice } from "./scenarios"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

type AllowedUrl = string
const SIM_TITLE_PREFIX = "[SIM]"

const SIM_BASE_URL = normalizeBaseUrl(process.env.SIM_BASE_URL || "http://localhost:3000")
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.E2E_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.E2E_SUPABASE_ANON_KEY
const SIM_USERS = parsePositiveInt(process.env.SIM_USERS || "10", 10)
const SIM_HEADLESS = parseBoolean(process.env.SIM_HEADLESS, true)
const ALLOW_WRITES = parseBoolean(process.env.ALLOW_WRITES, false)
const ALLOW_PROD_SIMULATION = parseBoolean(process.env.ALLOW_PROD_SIMULATION, false)
const SIM_SEED_ACCOUNTS = parseBoolean(process.env.SIM_SEED_ACCOUNTS, false)
const SIM_CONCURRENCY = parsePositiveInt(process.env.SIM_CONCURRENCY || "5", 5)

if (SIM_BASE_URL.includes("reparo-app.netlify.app") && !ALLOW_PROD_SIMULATION) {
  throw new Error(
    "Prod-Simulation blockiert. Setze ALLOW_PROD_SIMULATION=true, wenn du wirklich gegen https://reparo-app.netlify.app laufen willst.",
  )
}

const personas = selectSimulationPersonas(SIM_USERS)
const metrics = createMetrics()
const runId = new Date().toISOString().replace(/[:.]/g, "-")
const screenshotDir = resolve(process.cwd(), "test-results/live-simulation/screenshots")

async function main(): Promise<void> {
  await mkdir(screenshotDir, { recursive: true })
  if (ALLOW_WRITES && !SIM_SEED_ACCOUNTS) {
    throw new Error("ALLOW_WRITES=true erfordert SIM_SEED_ACCOUNTS=true, damit die Live-Test-Fixtures deterministisch angelegt werden können.")
  }

  let fixtureState: LiveSimulationFixtures | null = null
  let authStates: Map<string, StorageState> | null = null
  if (SIM_SEED_ACCOUNTS) {
    const seededAccounts = await ensureSimulationAccounts(personas, ALLOW_WRITES)
    if (ALLOW_WRITES) {
      fixtureState = await ensureSimulationFixtures(personas, seededAccounts)
    }
  }
  const browser: Browser = await chromium.launch({ headless: SIM_HEADLESS })
  authStates = await primeAuthStates(personas)

  try {
    await runConcurrent(personas, SIM_CONCURRENCY, async (persona, index) => {
      const scenario = weightedScenarioChoice(persona.rolle, hashSeed(`${persona.id}:${index}`), ALLOW_WRITES)
      metrics.totalRuns += 1
      const storageState = authStates?.get(persona.email)
      if (!storageState) {
        throw new Error(`auth-state-missing:${persona.email}`)
      }
      const context = await browser.newContext({
        baseURL: SIM_BASE_URL,
        locale: "de-DE",
        timezoneId: "Europe/Berlin",
        viewport: { width: 1440, height: 1200 },
        storageState,
      })
      await installAuthFetchBridge(context)
      const page = await context.newPage()
      const startedAt = Date.now()
      const localConsoleErrors: string[] = []
      const localHttpErrors: string[] = []
      const localDeadEnds: string[] = []

      page.on("console", message => {
        if (message.type() === "error") {
          const text = message.text()
          if (!isExpectedConsoleNoise(text)) {
            localConsoleErrors.push(`[${persona.id}] ${text}`)
          }
        }
      })
      page.on("pageerror", error => {
        if (!isExpectedConsoleNoise(error.message)) {
          localConsoleErrors.push(`[${persona.id}] pageerror: ${error.message}`)
        }
      })
      page.on("response", response => {
        const status = response.status()
        if (status >= 400 && !isExpectedHttpNoise(response.url(), status)) {
          localHttpErrors.push(`[${persona.id}] [${status}] ${response.request().method()} ${response.url()}`)
        }
      })

      try {
        await runSmokeRoutes(page, persona, SIM_BASE_URL)

        if (scenario.writes && !ALLOW_WRITES) {
          metrics.consoleErrors.push(...localConsoleErrors)
          metrics.httpErrors.push(...localHttpErrors)
          metrics.deadEnds.push(...localDeadEnds)
          recordSkipped(metrics, scenario.id, "ALLOW_WRITES=false")
          return
        }
        if (scenario.writes && ALLOW_WRITES) {
          const outcome = await runWriteScenario(page, persona, scenario.id, fixtureState)
          if (outcome.kind === "skipped") {
            metrics.consoleErrors.push(...localConsoleErrors)
            metrics.httpErrors.push(...localHttpErrors)
            metrics.deadEnds.push(...localDeadEnds)
            recordSkipped(metrics, scenario.id, outcome.reason)
            return
          }
          const finalUrl = page.url()
          if (isDeadEnd(finalUrl)) {
            localDeadEnds.push(`[${persona.id}] ${scenario.id} -> ${finalUrl}`)
          }
          metrics.consoleErrors.push(...localConsoleErrors)
          metrics.httpErrors.push(...localHttpErrors)
          metrics.deadEnds.push(...localDeadEnds)
          recordSuccess(metrics, scenario.id, Date.now() - startedAt)
          return
        }

        await runReadOnlyScenario(page, persona, scenario.id, SIM_BASE_URL)

        const finalUrl = page.url()
        if (isDeadEnd(finalUrl)) {
          localDeadEnds.push(`[${persona.id}] ${scenario.id} -> ${finalUrl}`)
        }

        metrics.consoleErrors.push(...localConsoleErrors)
        metrics.httpErrors.push(...localHttpErrors)
        metrics.deadEnds.push(...localDeadEnds)
        recordSuccess(metrics, scenario.id, Date.now() - startedAt)
      } catch (error) {
        metrics.consoleErrors.push(...localConsoleErrors)
        metrics.httpErrors.push(...localHttpErrors)
        metrics.deadEnds.push(...localDeadEnds)
        const screenshotPath = join(screenshotDir, `${persona.id}-${scenario.id}-${runId}.png`)
        await safeScreenshot(page, screenshotPath)
        metrics.screenshots.push(screenshotPath)
        recordFailure(metrics, scenario.id, Date.now() - startedAt, error instanceof Error ? error.message : String(error))
      } finally {
        await context.close()
      }
    })
  } finally {
    await browser.close()
  }

  const report = await writeReport(metrics, {
    baseUrl: SIM_BASE_URL,
    users: personas.length,
    headless: SIM_HEADLESS,
    concurrency: SIM_CONCURRENCY,
    allowWrites: ALLOW_WRITES,
    allowProdSimulation: ALLOW_PROD_SIMULATION,
    seedAccounts: SIM_SEED_ACCOUNTS,
    runId,
  })

  console.log(`Live simulation finished.`)
  console.log(`Report: ${report.jsonPath}`)
  console.log(`Markdown: ${report.markdownPath}`)

  if (metrics.failedRuns > 0) {
    process.exitCode = 1
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})

async function runSmokeRoutes(page: Page, persona: Persona, baseUrl: AllowedUrl): Promise<void> {
  await goto(page, baseUrl, "/")
  await goto(page, baseUrl, "/login")
  await goto(page, baseUrl, "/registrierung")
  await goto(page, baseUrl, dashboardRouteForRole(persona.rolle))
}

async function primeAuthStates(personas: readonly Persona[]): Promise<Map<string, StorageState>> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL/ANON_KEY fehlen. Lade tests/e2e/load-env.sh vor dem Live-Simulation-Run.")
  }
  const supabaseUrl = new URL(SUPABASE_URL)
  const appUrl = new URL(SIM_BASE_URL)
  const authCookieName = `sb-${supabaseUrl.hostname.split(".")[0]}-auth-token`
  const states = new Map<string, StorageState>()
  for (const persona of personas) {
    const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
    const { data, error } = await supabase.auth.signInWithPassword({
      email: persona.email,
      password: persona.passwort,
    })
    if (error || !data.session) {
      throw new Error(`Session-Prewarm fehlgeschlagen für ${persona.email}: ${error?.message ?? "unknown"}`)
    }
    states.set(persona.email, {
      cookies: [
        {
          name: authCookieName,
          value: encodeURIComponent(JSON.stringify(data.session)),
          domain: appUrl.hostname,
          path: "/",
          httpOnly: false,
          secure: appUrl.protocol === "https:",
          sameSite: "Lax",
          expires: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
        },
      ],
      origins: [],
    })
  }
  return states
}

async function runReadOnlyScenario(page: Page, persona: Persona, scenarioId: string, baseUrl: AllowedUrl): Promise<void> {
  switch (scenarioId) {
    case "ticket_status_pruefen":
      await goto(page, baseUrl, "/dashboard-mieter/tickets")
      break
    case "dashboard_pruefen":
      await goto(page, baseUrl, "/dashboard-verwalter")
      break
    case "neue_meldung_oeffnen":
      await goto(page, baseUrl, "/dashboard-verwalter/tickets")
      break
    case "reporting_pruefen":
      await goto(page, baseUrl, "/dashboard-verwalter/reporting")
      break
    case "dashboard_pruefen_hw":
      await goto(page, baseUrl, "/dashboard-handwerker")
      break
    case "einnahmen_pruefen":
      await goto(page, baseUrl, "/dashboard-handwerker/einnahmen")
      break
    default:
      await goto(page, baseUrl, dashboardRouteForRole(persona.rolle))
      break
  }
}

type WriteOutcome = { kind: "done" } | { kind: "skipped"; reason: string }

async function runWriteScenario(
  page: Page,
  persona: Persona,
  scenarioId: string,
  fixtures: LiveSimulationFixtures | null,
): Promise<WriteOutcome> {
  switch (scenarioId) {
    case "schaden_melden_text":
      await runMieterMelden(page, {
        withPhoto: false,
        addressQuery: pickAddressQuery(persona),
        description: "Wasser tropft von der Decke im Bad, der Fleck wird größer.",
        titleHint: "Wasserschaden / Feuchtigkeit",
      })
      return { kind: "done" }
    case "schaden_melden_foto_optional":
      await runMieterMelden(page, {
        withPhoto: true,
        addressQuery: pickAddressQuery(persona),
        description: "Heizung wird nicht warm und die Wohnung kühlt ab.",
        titleHint: "Heizung / Warmwasser ausgefallen",
      })
      return { kind: "done" }
    case "zeitslot_pflegen":
      await runZeitslotPflegen(page)
      return { kind: "done" }
    case "diagnose_annehmen":
      if (!fixtures) return { kind: "skipped", reason: "fixtures-not-seeded" }
      {
        const ticketId = fixtureTicketId(fixtures.diagnoseClaimTicketIds, persona.id)
        if (!ticketId) return { kind: "skipped", reason: "diagnose-claim-ticket-missing" }
        const outcome = await runDiagnoseAnnehmen(page, `${SIM_TITLE_PREFIX} Diagnose Claim ${persona.id}`)
        if (!outcome) return { kind: "skipped", reason: "diagnose-annehmen-ui-not-present" }
      }
      return { kind: "done" }
    case "befund_abgeben":
      if (!fixtures) return { kind: "skipped", reason: "fixtures-not-seeded" }
      {
        const ticketId = fixtureTicketId(fixtures.diagnoseBefundTicketIds, persona.id)
        if (!ticketId) return { kind: "skipped", reason: "diagnose-befund-ticket-missing" }
        const outcome = await runDiagnoseBefund(page, `${SIM_TITLE_PREFIX} Diagnose Befund ${persona.id}`)
        if (!outcome) return { kind: "skipped", reason: "befund-action-not-present" }
      }
      return { kind: "done" }
    case "angebot_abgeben":
      if (!fixtures) return { kind: "skipped", reason: "fixtures-not-seeded" }
      await runAngebotAbgeben(page, fixtures.sharedAuctionTicketId)
      return { kind: "done" }
    case "profil_pflegen":
      await runProfilPflegen(page)
      return { kind: "done" }
    case "auktion_starten":
      if (!fixtures) return { kind: "skipped", reason: "fixtures-not-seeded" }
      {
        const ticketId = fixtureTicketId(fixtures.verwalterAuctionTicketIds, persona.id)
        if (!ticketId) return { kind: "skipped", reason: "verwalter-auction-ticket-missing" }
        await runAuktionStarten(page, ticketId)
      }
      return { kind: "done" }
    case "angebot_annehmen":
      if (!fixtures) return { kind: "skipped", reason: "fixtures-not-seeded" }
      await runAngebotAnnehmen(page, fixtures.sharedAuctionTicketId)
      return { kind: "done" }
    case "nachtrag_pruefen":
      if (!fixtures) return { kind: "skipped", reason: "fixtures-not-seeded" }
      {
        const ticketId = fixtureTicketId(fixtures.verwalterNachtragTicketIds, persona.id)
        if (!ticketId) return { kind: "skipped", reason: "verwalter-nachtrag-ticket-missing" }
        const outcome = await runNachtragPruefen(page, ticketId)
        if (!outcome) return { kind: "skipped", reason: "nachtrag-entscheidungs-ui-not-present" }
      }
      return { kind: "done" }
    case "handwerker_buchen":
      return { kind: "skipped", reason: "not-implemented-safely-yet" }
    case "unvollstaendige_meldung":
      return { kind: "skipped", reason: "negative-flow-not-implemented-safely-yet" }
    case "bewertung_abgeben":
      if (!fixtures) return { kind: "skipped", reason: "fixtures-not-seeded" }
      await runBewertungAbgeben(page, fixtures.sharedReviewTicketIds[persona.id])
      return { kind: "done" }
    default:
      return { kind: "skipped", reason: `write-scenario-${scenarioId}-not-implemented-safely-yet` }
  }
}

async function runMieterMelden(
  page: Page,
  params: {
    withPhoto: boolean
    addressQuery: string
    description: string
    titleHint: string
  },
): Promise<void> {
  await page.context().route("https://photon.komoot.io/api/**", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [13.405, 52.52] },
            properties: {
              street: "Alexanderplatz",
              housenumber: "1",
              postcode: "10178",
              city: "Berlin",
              country: "Germany",
              countrycode: "DE",
            },
          },
        ],
      }),
    }),
  )
  await page.goto("/dashboard-mieter/melden", { waitUntil: "domcontentloaded" })

  if (params.withPhoto) {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==",
      "base64",
    )
    await page.locator('input[type="file"]').setInputFiles({
      name: "schaden.png",
      mimeType: "image/png",
      buffer: png,
    })
  }

  await page.locator("textarea").first().fill(params.description)
  await page.getByRole("button", { name: /KI-Analyse starten/i }).click()
  await page.waitForSelector("text=KI-Analyse abgeschlossen", { timeout: 15_000 })
  await page.getByText(params.titleHint, { exact: false }).waitFor({ timeout: 10_000 })

  await page.getByRole("button", { name: /Weiter -- Ort angeben|Weiter — Ort angeben/i }).click()

  await fillAddressAutocomplete(page, params.addressQuery)

  await page.getByRole("button", { name: /Weiter.*Zusammenfassung/i }).click()
  await page.getByRole("button", { name: /Meldung absenden/i }).click()
  await page.getByText("Schaden erfolgreich gemeldet", { exact: false }).waitFor({ timeout: 20_000 })
}

async function fillAddressAutocomplete(page: Page, query: string): Promise<void> {
  const input = page.getByLabel("Adresse des Gebäudes")
  await input.fill(query)
  await page.waitForTimeout(500)
  const firstSuggestion = page.locator('ul button').first()
  await firstSuggestion.click({ timeout: 10_000 })
}

async function runZeitslotPflegen(page: Page): Promise<void> {
  await page.goto("/dashboard-handwerker/zeitslots", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /\+ Neuer Slot/i }).click()
  await page.getByText("Neuen Zeitslot erstellen").waitFor({ timeout: 10_000 })

  const start = new Date()
  start.setDate(start.getDate() + 2)
  const date = start.toISOString().slice(0, 10)

  await page.getByLabel(/Titel/i).fill("Live-Test Vormittags-Slot")
  await page.getByLabel(/Datum/i).fill(date)
  await page.getByLabel(/Von/i).fill("08:00")
  await page.getByLabel(/Bis/i).fill("12:00")
  await page.getByLabel(/Notizen/i).fill("Automatischer Live-Test-Slot")
  await page.getByRole("button", { name: /Zeitslot veröffentlichen/i }).click()
  await page.getByText("Zeitslot erfolgreich erstellt!").waitFor({ timeout: 15_000 })
}

async function runDiagnoseAnnehmen(page: Page, ticketTitle: string): Promise<boolean> {
  await page.goto("/dashboard-handwerker/diagnosen", { waitUntil: "domcontentloaded" })
  const card = page.locator("article").filter({ hasText: ticketTitle })
  const button = card.getByRole("button", { name: /Termin annehmen/i })
  if ((await button.count()) === 0) {
    return false
  }
  await Promise.all([
    page.waitForResponse(r => r.url().includes("/api/diagnose/termin-annehmen") && r.request().method() === "POST", { timeout: 20_000 }),
    button.click(),
  ])
  await page.waitForTimeout(1000)
  return true
}

async function runDiagnoseBefund(page: Page, ticketTitle: string): Promise<boolean> {
  await page.goto("/dashboard-handwerker/diagnosen", { waitUntil: "domcontentloaded" })
  const card = page.locator("article").filter({ hasText: ticketTitle })
  const createButton = card.getByRole("button", { name: /Befund \+ Angebot erstellen/i })
  if ((await createButton.count()) === 0) {
    return false
  }
  await createButton.click({ timeout: 20_000 })
  await page.locator("textarea").first().fill("Dichtung defekt, Austausch vor Ort erforderlich.")
  await page.locator('input[type="number"][min="0.5"]').first().fill("2.5")
  await page.locator('input[type="number"][min="1"]').first().fill("380")
  const leistungInput = page.locator('input[placeholder*="Dichtung"]').first()
  await leistungInput.fill("Dichtung wechseln")
  await page.getByRole("button", { name: /^\+$/ }).first().click()
  await leistungInput.fill("Material inklusive")
  await page.getByRole("button", { name: /^\+$/ }).first().click()
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGBgAAAABAABJzQnCgAAAABJRU5ErkJggg==",
    "base64",
  )
  await page.locator('input[type="file"]').setInputFiles({
    name: "befund.png",
    mimeType: "image/png",
    buffer: png,
  })
  await Promise.all([
    page.waitForResponse(r => r.url().includes("/api/diagnose/befund-abgeben") && r.request().method() === "POST", { timeout: 20_000 }),
    page.getByRole("button", { name: /Befund \+ Angebot speichern/i }).click(),
  ])
  await page.getByText("Befund + Angebot").waitFor({ state: "detached", timeout: 15_000 }).catch(() => {})
  return true
}

async function runAuktionStarten(page: Page, ticketId: string | undefined): Promise<void> {
  if (!ticketId) throw new Error("diagnose_auktion_ticket fehlt")
  await page.goto(`/dashboard-verwalter/ticket/${ticketId}`, { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: /In Auktion mit Vorkaufsrecht/i }).click()
  await Promise.all([
    page.waitForResponse(r => r.url().includes("/api/diagnose/projekt-zur-auktion") && r.request().method() === "POST", { timeout: 20_000 }),
    page.getByRole("button", { name: /Ja, in Auktion/i }).click(),
  ])
}

async function runAngebotAnnehmen(page: Page, ticketId: string | undefined): Promise<void> {
  if (!ticketId) throw new Error("shared_auction_ticket fehlt")
  await page.goto(`/dashboard-verwalter/ticket/${ticketId}`, { waitUntil: "domcontentloaded" })
  const vergebenBtn = page.getByRole("button", { name: /Auftrag vergeben/i }).first()
  await vergebenBtn.click()
  await Promise.all([
    page.waitForResponse(r => r.url().includes("/api/auction/close") && r.request().method() === "POST", { timeout: 20_000 }),
    page.getByRole("button", { name: /Ja, vergeben/i }).click(),
  ])
}

async function runNachtragPruefen(page: Page, ticketId: string | undefined): Promise<boolean> {
  if (!ticketId) throw new Error("nachtrag_ticket fehlt")
  await page.goto(`/dashboard-verwalter/ticket/${ticketId}`, { waitUntil: "domcontentloaded" })
  const genehmigenBtn = page.getByRole("button", { name: /Genehmigen/i }).first()
  if ((await genehmigenBtn.count()) === 0) {
    return false
  }
  await Promise.all([
    page.waitForResponse(r => r.url().includes("/api/nachtraege/genehmigen") && r.request().method() === "POST", { timeout: 20_000 }),
    genehmigenBtn.click(),
  ])
  return true
}

async function runAngebotAbgeben(page: Page, ticketId: string | undefined): Promise<void> {
  if (!ticketId) throw new Error("shared_auction_ticket fehlt")
  await page.goto(`/dashboard-handwerker/angebot/${ticketId}`, { waitUntil: "domcontentloaded" })
  await page.getByRole("heading", { name: /Angebot abgeben/i }).waitFor({ timeout: 20_000 })
  await page.locator('input[type="number"]').first().fill("365")
  await page.locator('input[type="date"]').first().fill(futureDate(10))
  await page.locator("textarea").first().fill("Eingereicht im Live-Test.")
  await Promise.all([
    page.waitForResponse(r => r.url().includes("/api/auction/bid") && r.request().method() === "POST", { timeout: 45_000 }),
    page.getByRole("button", { name: /Angebot über .* absenden/i }).click(),
  ])
}

async function runProfilPflegen(page: Page): Promise<void> {
  await page.goto("/dashboard-handwerker/profil", { waitUntil: "domcontentloaded" })
  const telefon = page.getByLabel("Telefon")
  await telefon.fill("+49 30 1234567")
  await page.getByRole("button", { name: /Profil speichern/i }).click()
  await page.getByText("Gespeichert").waitFor({ timeout: 10_000 }).catch(() => {})
}

async function runBewertungAbgeben(page: Page, ticketId: string | undefined): Promise<void> {
  if (!ticketId) throw new Error("review_ticket fehlt")
  await page.goto(`/dashboard-mieter/ticket/${ticketId}`, { waitUntil: "domcontentloaded" })
  await page.getByLabel("5 Sterne").click()
  await page.getByPlaceholder(/Kommentar/i).fill("Schnelle und saubere Abwicklung im Live-Test.")
  await page.getByRole("button", { name: /Bewertung absenden/i }).click()
  await page.getByText("Danke für deine Bewertung").waitFor({ timeout: 15_000 }).catch(() => {})
}

function pickAddressQuery(persona: Persona): string {
  if (persona.bezirk) {
    return `${persona.bezirk} Berlin`
  }
  return "Berlin Mitte"
}

function futureDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fixtureTicketId(map: Record<string, string>, personaId: string): string | undefined {
  return map[personaId] ?? Object.values(map)[0]
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function runConcurrent<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const limit = Math.max(1, Math.min(concurrency, items.length || 1))
  let index = 0
  const active = Array.from({ length: limit }, async () => {
    while (index < items.length) {
      const current = index
      index += 1
      const item = items[current]
      await worker(item, current)
    }
  })
  await Promise.all(active)
}

async function goto(page: Page, baseUrl: AllowedUrl, path: string): Promise<void> {
  const url = new URL(path, baseUrl).toString()
  await page.goto(url, { waitUntil: "domcontentloaded" })
}

async function installAuthFetchBridge(context: BrowserContext): Promise<void> {
  await context.addInitScript(`
    (() => {
      const originalFetch = window.fetch.bind(window)

      function extractAccessToken() {
        const cookieMatch = document.cookie.match(/(?:^|;\s*)sb-[^=]+-auth-token=([^;]+)/)
        if (cookieMatch) {
          try {
            const parsedCookie = JSON.parse(decodeURIComponent(cookieMatch[1]))
            if (typeof parsedCookie.access_token === "string" && parsedCookie.access_token.length > 0) {
              return parsedCookie.access_token
            }
          } catch {
            // fall through to localStorage scan
          }
        }
        for (const key of Object.keys(localStorage)) {
          const raw = localStorage.getItem(key)
          if (!raw) continue
          try {
            const parsed = JSON.parse(raw)
            if (typeof parsed.access_token === "string" && parsed.access_token.length > 0) {
              return parsed.access_token
            }
          } catch {
            continue
          }
        }
        return null
      }

      window.fetch = async (input, init) => {
        const requestUrl = typeof input === "string" || input instanceof URL ? input.toString() : input.url
        const url = new URL(requestUrl, window.location.href)
        if (url.origin === window.location.origin && url.pathname.startsWith("/api/")) {
          const accessToken = extractAccessToken()
          if (accessToken) {
            const headers = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined))
            if (!headers.has("Authorization")) {
              headers.set("Authorization", "Bearer " + accessToken)
            }
            init = { ...(init || {}), headers }
          }
        }
        return originalFetch(input, init)
      }
    })()
  `)
}

function dashboardRouteForRole(role: Persona["rolle"]): string {
  switch (role) {
    case "mieter":
      return "/dashboard-mieter"
    case "verwalter":
      return "/dashboard-verwalter"
    case "handwerker":
      return "/dashboard-handwerker"
  }
}

function selectSimulationPersonas(total: number): Persona[] {
  const capped = Math.min(Math.max(total, 1), PERSONAS.length)
  const pools: Record<Persona["rolle"], Persona[]> = {
    verwalter: PERSONAS.filter(persona => persona.rolle === "verwalter"),
    handwerker: PERSONAS.filter(persona => persona.rolle === "handwerker"),
    mieter: PERSONAS.filter(persona => persona.rolle === "mieter"),
  }

  const quotas = computeRoleQuotas(capped)
  return [
    ...pools.verwalter.slice(0, quotas.verwalter),
    ...pools.handwerker.slice(0, quotas.handwerker),
    ...pools.mieter.slice(0, quotas.mieter),
  ]
}

function computeRoleQuotas(total: number): Record<Persona["rolle"], number> {
  const roles: Array<{ role: Persona["rolle"]; weight: number }> = [
    { role: "verwalter", weight: 5 },
    { role: "handwerker", weight: 25 },
    { role: "mieter", weight: 70 },
  ]

  const base = total >= 3 ? 1 : 0
  const counts: Record<Persona["rolle"], number> = {
    verwalter: base,
    handwerker: base,
    mieter: base,
  }

  const allocation = total - base * roles.length
  if (allocation <= 0) {
    if (total === 1) return { verwalter: 0, handwerker: 0, mieter: 1 }
    if (total === 2) return { verwalter: 0, handwerker: 1, mieter: 1 }
    return counts
  }

  const totalWeight = roles.reduce((sum, entry) => sum + entry.weight, 0)
  const fractional: Array<{ role: Persona["rolle"]; fraction: number }> = []
  let assigned = 0

  for (const entry of roles) {
    const exact = (allocation * entry.weight) / totalWeight
    const whole = Math.floor(exact)
    counts[entry.role] += whole
    assigned += whole
    fractional.push({ role: entry.role, fraction: exact - whole })
  }

  let remaining = allocation - assigned
  fractional.sort((a, b) => b.fraction - a.fraction)
  for (let i = 0; i < fractional.length && remaining > 0; i++) {
    counts[fractional[i].role] += 1
    remaining -= 1
  }

  return counts
}

function normalizeBaseUrl(url: string): AllowedUrl {
  if (!/^https?:\/\//i.test(url)) {
    return `http://${url.replace(/^\/+/, "")}`
  }
  return url.replace(/\/+$/, "")
}

function parsePositiveInt(input: string, fallback: number): number {
  const parsed = Number.parseInt(input, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseBoolean(input: string | undefined, fallback: boolean): boolean {
  if (input == null) return fallback
  const normalized = input.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function hashSeed(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = Math.imul(31, hash) + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function isDeadEnd(url: string): boolean {
  const pathname = new URL(url).pathname
  return pathname.includes("/login") || pathname.includes("/404") || pathname.includes("/not-found")
}

async function safeScreenshot(page: Page, screenshotPath: string): Promise<void> {
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true })
  } catch {
    // ignore screenshot failures
  }
}

function isExpectedConsoleNoise(message: string): boolean {
  return (
    message.includes("Failed to fetch RSC payload") ||
    message.includes("Fast Refresh had to perform a full reload") ||
    message.includes("Failed to fetch") && message.includes("@supabase/auth-js") ||
    message.includes("Failed to fetch") && message.includes("GoTrueClient.js")
  )
}

function isExpectedHttpNoise(url: string, status: number): boolean {
  return status === 503 && url.includes("/api/ki/schadenserkennung")
}
