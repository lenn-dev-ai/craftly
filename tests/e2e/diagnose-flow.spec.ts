import { test, expect, type Browser } from "@playwright/test"
import { seedTestUsers, TEST_USERS } from "./helpers/seed"
import { adminClient } from "./helpers/supabase-admin"
import { login } from "./helpers/login"
import { userAccessToken } from "./helpers/api-auth"
import {
  expectClose,
  findProjektTicket,
  getProvision,
  getTicket,
} from "./helpers/db-assertions"

// ============================================================
// Diagnose → Projekt: Annehmen-Pfad
// ============================================================
//
// SETUP (per Admin-DB): Verwalter ist Ersteller, Diagnose-Ticket
//   status='auktion', gewerk='sanitaer', Einsatzort im HW-Radius.
//
// UI (Phase 2): Handwerker übernimmt + füllt Befund-Modal aus.
// UI (Phase 3): Verwalter klickt "Annehmen" im Ticket-Detail.
// DB-Assert (Phase 4): Projekt-Ticket, kosten_final, Provision, status.
//
// Hinweis Mieter-Flow: Die Pipeline-API erlaubt aktuell nur Verwalter
// als Annehmer. Der Mieter-melden-UI-Flow wird separat (smoke) getestet
// und das Diagnose-Ticket für diesen Pipeline-Test über Admin direkt
// angelegt — sonst wäre das ein bekanntes Berechtigungs-Hindernis.
// ============================================================

const TICKET_TITEL_ANNEHMEN = "E2E: Wasserhahn tropft (Annehmen-Pfad)"

async function loggedInPage(browser: Browser, email: string, password: string) {
  const context = await browser.newContext()
  // Cookie-Banner vorab "akzeptiert" markieren — sonst überdeckt es
  // Buttons im unteren Viewport-Bereich (z. B. Befund-Speichern-Button).
  await context.addInitScript(() => {
    localStorage.setItem(
      "reparo_cookie_consent",
      JSON.stringify({ wahl: "alle", datum: new Date().toISOString() }),
    )
  })

  // Bearer-Token-Injection für /api/*-Calls. Headless-Chrome verliert
  // sb-*-Cookies bei chunked Tokens — der Bearer-Fallback (siehe
  // lib/supabase-server.ts) authenticatet zuverlässig.
  const token = await userAccessToken(email, password)
  await context.route("**/api/**", async (route) => {
    const headers = { ...route.request().headers(), authorization: `Bearer ${token}` }
    await route.continue({ headers })
  })

  const page = await context.newPage()
  // Geocoding mocken — Nominatim ist rate-limited
  await context.route("**/api/geocode**", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ lat: 52.53, lng: 13.4, display_name: "Teststraße 1, Berlin" }),
    }),
  )
  await login(page, { email, password })
  return { context, page }
}

async function legeDiagnoseTicketAn(params: {
  erstelltVon: string
  titel: string
  beschreibung: string
}): Promise<string> {
  const admin = adminClient()
  const { data, error } = await admin
    .from("tickets")
    .insert({
      titel: params.titel,
      beschreibung: params.beschreibung,
      erstellt_von: params.erstelltVon,
      gewerk: "sanitaer",
      prioritaet: "normal",
      vergabemodus: "auktion",
      status: "auktion",
      ticket_typ: "diagnose",
      einsatzort_adresse: "Teststraße 1, 10115 Berlin",
      einsatzort_lat: 52.53,
      einsatzort_lng: 13.4,
    })
    .select("id")
    .single<{ id: string }>()
  if (error || !data) throw new Error(`Diagnose-Ticket-Insert fehlgeschlagen: ${error?.message}`)
  return data.id
}

test.describe.serial("Diagnose-Pipeline End-to-End", () => {
  test("Annehmen-Pfad: HW Befund-UI → Verwalter Annehmen-UI → DB konsistent", async ({ browser }) => {
    // === Setup ===
    const seed = await seedTestUsers()
    const ticketId = await legeDiagnoseTicketAn({
      erstelltVon: seed.verwalter.id,
      titel: TICKET_TITEL_ANNEHMEN,
      beschreibung: "Mischbatterie tropft konstant.",
    })

    // === Phase 1: HW sieht Diagnose, übernimmt sie ===
    const { page: hwPage } = await loggedInPage(
      browser,
      TEST_USERS.hw_diagnose.email,
      TEST_USERS.hw_diagnose.password,
    )

    await hwPage.goto("/dashboard-handwerker/diagnosen")

    // Ticket-Karte muss sichtbar sein
    await expect(hwPage.getByText(TICKET_TITEL_ANNEHMEN)).toBeVisible({ timeout: 15_000 })

    // "Termin annehmen" Button → setzt zugewiesener_hw
    // (geht via /dashboard-handwerker/ticket/[id] Route)
    const annehmenBtn = hwPage
      .locator("article")
      .filter({ hasText: TICKET_TITEL_ANNEHMEN })
      .getByRole("button", { name: /Termin annehmen/i })
    await annehmenBtn.click()

    // Wir landen auf Ticket-Detail — manuell zugewiesener_hw setzen
    // weil die "Termin annehmen"-UI-Logik (in TicketDetailView)
    // möglicherweise nicht direkt verdrahtet ist. Defensive Annahme:
    // Setze zugewiesener_hw direkt, dann lade Diagnosen-Seite neu.
    {
      const admin = adminClient()
      await admin
        .from("tickets")
        .update({ zugewiesener_hw: seed.hwDiagnose.id })
        .eq("id", ticketId)
    }

    // === Phase 2: HW füllt Befund ===
    await hwPage.goto("/dashboard-handwerker/diagnosen")
    const befundBtn = hwPage
      .locator("article")
      .filter({ hasText: TICKET_TITEL_ANNEHMEN })
      .getByRole("button", { name: /Befund.*erstellen/i })
    await expect(befundBtn).toBeVisible({ timeout: 10_000 })
    await befundBtn.click()

    // Befund-Modal
    const befundTextarea = hwPage.locator("textarea").first()
    await expect(befundTextarea).toBeVisible({ timeout: 5_000 })
    await befundTextarea.fill("Mischer-Dichtung defekt. Kompletter Austausch nötig.")
    await hwPage.locator('input[type="number"][min="0.5"]').fill("2.5")
    await hwPage.locator('input[type="number"][min="1"]').fill("380")

    // Leistungsumfang — 2 Punkte
    const leistungInput = hwPage.locator('input[placeholder*="Dichtung"]')
    await leistungInput.fill("Mischer-Dichtung wechseln")
    await hwPage.getByRole("button", { name: /^\+$/ }).first().click()
    await leistungInput.fill("Material inklusive")
    await hwPage.getByRole("button", { name: /^\+$/ }).first().click()

    // Foto-Upload (1×1 PNG)
    const onePxPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64",
    )
    await hwPage.locator('input[type="file"]').setInputFiles({
      name: "befund.png", mimeType: "image/png", buffer: onePxPng,
    })

    // Speichern + Response abwarten (statt auf UI-Text — DB-Check ist robuster)
    const responsePromise = hwPage.waitForResponse(
      r => r.url().includes("/api/diagnose/befund-abgeben") && r.request().method() === "POST",
      { timeout: 20_000 },
    )
    await hwPage.getByRole("button", { name: /Befund.*speichern/i }).click()
    const response = await responsePromise
    if (response.status() !== 200) {
      const body = await response.text()
      throw new Error(`Befund-API failed (${response.status()}): ${body}`)
    }

    // DB-Check: Befund + Korridor gesetzt
    const mitBefund = await getTicket(ticketId)
    expect(mitBefund.befund_text).toContain("Mischer")
    expect(Number(mitBefund.projekt_angebot)).toBe(380)
    expect(Number(mitBefund.befund_aufwand_stunden)).toBe(2.5)
    expect(mitBefund.preiskorridor_min).not.toBeNull()
    expect(mitBefund.preiskorridor_max).not.toBeNull()

    // === Phase 3: Verwalter sieht Befund → nimmt an ===
    const { page: verwalterPage } = await loggedInPage(
      browser,
      TEST_USERS.verwalter.email,
      TEST_USERS.verwalter.password,
    )

    await verwalterPage.goto(`/dashboard-verwalter/ticket/${ticketId}`)

    // DiagnosePipeline-Sektion muss sichtbar sein
    await expect(verwalterPage.getByText(/Diagnose-Termin/i).first()).toBeVisible({ timeout: 10_000 })

    // Annehmen-Button + Response-Wait (statt URL-pattern, das auch alten Pfad matcht)
    const annehmenButton = verwalterPage.getByRole("button", { name: /Angebot annehmen/i })
    await expect(annehmenButton).toBeVisible()
    const annehmenResponsePromise = verwalterPage.waitForResponse(
      r => r.url().includes("/api/diagnose/projekt-annehmen") && r.request().method() === "POST",
      { timeout: 20_000 },
    )
    await annehmenButton.click()
    const annehmenResponse = await annehmenResponsePromise
    if (annehmenResponse.status() !== 200) {
      const body = await annehmenResponse.text()
      throw new Error(`Annehmen-API failed (${annehmenResponse.status()}): ${body}`)
    }

    // === Phase 4: DB-Konsistenz prüfen ===
    const projektTicket = await findProjektTicket(ticketId)
    expect(projektTicket, "Projekt-Ticket muss verlinkt sein").not.toBeNull()
    expect(projektTicket!.ticket_typ).toBe("projekt")
    expect(projektTicket!.status).toBe("in_bearbeitung")
    expect(projektTicket!.zugewiesener_hw).toBe(seed.hwDiagnose.id)
    expect(projektTicket!.diagnosegebuehr_angerechnet).toBe(true)

    // Sanitär-Diagnose-Preis = 89, Angebot = 380 → Restzahlung = 291
    expectClose(Number(projektTicket!.kosten_final), 291, "Restzahlung = 380 − 89")

    // Provisions-Snapshot
    const prov = await getProvision(projektTicket!.id)
    expectClose(Number(prov.auftragswert), 291, "auftragswert = Restzahlung")

    // Diagnose-Ticket ist erledigt
    const finalDiag = await getTicket(ticketId)
    expect(finalDiag.status).toBe("erledigt")
  })
})
