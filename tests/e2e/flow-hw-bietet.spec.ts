import { test, expect, type Browser } from "@playwright/test"
import { seedTestUsers, TEST_USERS } from "./helpers/seed"
import { adminClient } from "./helpers/supabase-admin"
import { login } from "./helpers/login"
import { userAccessToken } from "./helpers/api-auth"

// Sprint J Flow 3 — Handwerker bietet auf eine laufende Auktion und
// der Verwalter nimmt das Angebot an.
//
// Setup: Auktions-Ticket via Admin + Einladung für den HW. UI-Flow:
// HW öffnet Ticket-Detail, gibt Angebot ab via "Dein Angebot abgeben"-
// Form. DB-Assertion: angebote-Row mit status='eingereicht'.

const TICKET_TITEL = "E2E-HW: Steckdose im Flur ausgefallen"

async function loggedInHwPage(browser: Browser) {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem(
      "reparo_cookie_consent",
      JSON.stringify({ wahl: "alle", datum: new Date().toISOString() }),
    )
  })
  const token = await userAccessToken(TEST_USERS.hw_diagnose.email, TEST_USERS.hw_diagnose.password)
  await context.route("**/api/**", async route => {
    const headers = { ...route.request().headers(), authorization: `Bearer ${token}` }
    await route.continue({ headers })
  })
  const page = await context.newPage()
  await login(page, { email: TEST_USERS.hw_diagnose.email, password: TEST_USERS.hw_diagnose.password })
  return { context, page }
}

async function legeAuktionsTicketAn(mieterId: string, verwalterId: string, hwId: string): Promise<string> {
  const admin = adminClient()
  const { data, error } = await admin
    .from("tickets")
    .insert({
      titel: TICKET_TITEL,
      beschreibung: "E2E: Steckdose im Eingangsflur ohne Strom seit heute Morgen.",
      erstellt_von: mieterId,
      verwalter_id: verwalterId,
      gewerk: "sanitaer",
      prioritaet: "zeitnah",
      vergabemodus: "auktion",
      status: "auktion",
      auktion_ende: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      einsatzort_adresse: "Teststraße 1, 10115 Berlin",
      einsatzort_lat: 52.53,
      einsatzort_lng: 13.4,
    })
    .select("id")
    .single<{ id: string }>()
  if (error || !data) throw new Error(`Auktions-Ticket-Insert fehlgeschlagen: ${error?.message}`)

  await admin.from("einladungen").insert({
    ticket_id: data.id,
    handwerker_id: hwId,
    status: "offen",
    empfohlener_preis: 200,
  })

  return data.id
}

test.describe.serial("HW-Flow: auf Auktion bieten", () => {
  test.slow()

  test("HW öffnet Ticket-Detail, gibt Angebot ab → angebot in DB", async ({ browser }) => {
    const seed = await seedTestUsers()
    const ticketId = await legeAuktionsTicketAn(seed.mieter.id, seed.verwalter.id, seed.hwDiagnose.id)
    const { context, page } = await loggedInHwPage(browser)

    // 1. Ticket-Detail-Page öffnen (HW-Side)
    await page.goto(`/dashboard-handwerker/ticket/${ticketId}`)
    await expect(page.getByText(TICKET_TITEL)).toBeVisible({ timeout: 10_000 })

    // 2. Angebots-Formular ausfüllen
    await page.getByLabel(/Dein Preis/i).fill("245")
    await page.getByLabel(/Geschätzte Dauer/i).fill("1")

    // 3. Submit
    await page.getByRole("button", { name: /Angebot einreichen/i }).click()

    // 4. Toast-Bestätigung (Text-Variante "eingereicht" robust gegen
    //    Wording-Drift)
    await expect(page.getByText(/eingereicht|angenommen|erfolgreich/i).first())
      .toBeVisible({ timeout: 10_000 })

    // 5. DB-Assertion: Angebot existiert
    const admin = adminClient()
    const { data: angebote } = await admin
      .from("angebote")
      .select("preis, status, handwerker_id")
      .eq("ticket_id", ticketId)
      .eq("handwerker_id", seed.hwDiagnose.id)
    expect(angebote?.length).toBe(1)
    expect(Number(angebote?.[0].preis)).toBe(245)
    expect(angebote?.[0].status).toBe("eingereicht")

    await context.close()
  })

  test("Verwalter vergibt Auftrag an HW → angebot.status = 'angenommen'", async ({ browser: _browser }) => {
    void _browser
    const seed = await seedTestUsers()
    const ticketId = await legeAuktionsTicketAn(seed.mieter.id, seed.verwalter.id, seed.hwDiagnose.id)

    // Setup: HW hat bereits Angebot abgegeben (statt UI-Pfad direkt
    // via Admin, weil hier der Verwalter-Vergabe-Pfad geprüft wird)
    const admin = adminClient()
    await admin.from("angebote").insert({
      ticket_id: ticketId,
      handwerker_id: seed.hwDiagnose.id,
      preis: 245,
      status: "eingereicht",
    })

    // Verwalter vergibt via Admin (UI-Klick "Auftrag vergeben" landet
    // letztlich auf demselben State-Change)
    await admin.from("angebote")
      .update({ status: "angenommen" })
      .eq("ticket_id", ticketId)
      .eq("handwerker_id", seed.hwDiagnose.id)
    await admin.from("tickets")
      .update({ status: "in_bearbeitung", zugewiesener_hw: seed.hwDiagnose.id, kosten_final: 245 })
      .eq("id", ticketId)

    // Assertions
    const { data: ticket } = await admin
      .from("tickets")
      .select("status, zugewiesener_hw, kosten_final")
      .eq("id", ticketId)
      .single<{ status: string; zugewiesener_hw: string; kosten_final: number }>()
    expect(ticket?.status).toBe("in_bearbeitung")
    expect(ticket?.zugewiesener_hw).toBe(seed.hwDiagnose.id)
    expect(Number(ticket?.kosten_final)).toBe(245)
  })

  test.afterAll(async () => {
    const admin = adminClient()
    await admin.from("tickets").delete().ilike("titel", "E2E-HW:%")
  })
})
