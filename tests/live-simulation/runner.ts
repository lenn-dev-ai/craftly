import { chromium, type Browser, type Page } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import { resolve, join } from "node:path"
import { createMetrics, recordFailure, recordSkipped, recordSuccess, writeReport } from "./metrics"
import { PERSONAS, type Persona } from "./personas"
import { weightedScenarioChoice } from "./scenarios"

type AllowedUrl = string

const SIM_BASE_URL = normalizeBaseUrl(process.env.SIM_BASE_URL || "http://localhost:3000")
const SIM_USERS = parsePositiveInt(process.env.SIM_USERS || "10", 10)
const SIM_HEADLESS = parseBoolean(process.env.SIM_HEADLESS, true)
const ALLOW_WRITES = parseBoolean(process.env.ALLOW_WRITES, false)
const ALLOW_PROD_SIMULATION = parseBoolean(process.env.ALLOW_PROD_SIMULATION, false)

if (SIM_BASE_URL.includes("reparo-app.netlify.app") && !ALLOW_PROD_SIMULATION) {
  throw new Error(
    "Prod-Simulation blockiert. Setze ALLOW_PROD_SIMULATION=true, wenn du wirklich gegen https://reparo-app.netlify.app laufen willst.",
  )
}

const personas = PERSONAS.slice(0, Math.min(SIM_USERS, PERSONAS.length))
const metrics = createMetrics()
const runId = new Date().toISOString().replace(/[:.]/g, "-")
const screenshotDir = resolve(process.cwd(), "test-results/live-simulation/screenshots")

async function main(): Promise<void> {
  await mkdir(screenshotDir, { recursive: true })
  const browser: Browser = await chromium.launch({ headless: SIM_HEADLESS })

  try {
  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i]
    const scenario = weightedScenarioChoice(persona.rolle, hashSeed(`${persona.id}:${i}`), ALLOW_WRITES)
    metrics.totalRuns += 1
    const context = await browser.newContext({
      baseURL: SIM_BASE_URL,
      locale: "de-DE",
      timezoneId: "Europe/Berlin",
      viewport: { width: 1440, height: 1200 },
    })
    const page = await context.newPage()
    const startedAt = Date.now()
    const localConsoleErrors: string[] = []
    const localHttpErrors: string[] = []
    const localDeadEnds: string[] = []

    page.on("console", message => {
      if (message.type() === "error") {
        localConsoleErrors.push(`[${persona.id}] ${message.text()}`)
      }
    })
    page.on("pageerror", error => {
      localConsoleErrors.push(`[${persona.id}] pageerror: ${error.message}`)
    })
    page.on("response", response => {
      const status = response.status()
      if (status >= 400) {
        localHttpErrors.push(`[${status}] ${response.request().method()} ${response.url()}`)
      }
    })

    try {
      await runSmokeRoutes(page, persona, SIM_BASE_URL)

      if (scenario.writes && !ALLOW_WRITES) {
        recordSkipped(metrics, scenario.id, "ALLOW_WRITES=false")
      } else if (scenario.writes && ALLOW_WRITES) {
        throw new Error("Write scenario not implemented safely yet")
      } else {
        await runReadOnlyScenario(page, persona, scenario.id, SIM_BASE_URL)
      }

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
  }
  } finally {
    await browser.close()
  }

  const report = await writeReport(metrics, {
    baseUrl: SIM_BASE_URL,
    users: personas.length,
    headless: SIM_HEADLESS,
    allowWrites: ALLOW_WRITES,
    allowProdSimulation: ALLOW_PROD_SIMULATION,
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

async function goto(page: Page, baseUrl: AllowedUrl, path: string): Promise<void> {
  const url = new URL(path, baseUrl).toString()
  await page.goto(url, { waitUntil: "domcontentloaded" })
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
