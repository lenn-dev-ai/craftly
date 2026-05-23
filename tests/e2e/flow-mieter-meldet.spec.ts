import { test, expect, type Browser } from "@playwright/test"
import { seedTestUsers, TEST_USERS } from "./helpers/seed"
import { adminClient } from "./helpers/supabase-admin"
import { login } from "./helpers/login"
import { userAccessToken } from "./helpers/api-auth"

// Sprint J Flow 1 — Mieter meldet einen Schaden via Wizard.
//
// Robust gegen UI-Drift: nutzt getByRole + getByText/Label statt
// fragiler CSS-Selektoren. Ohne Foto → Regex-Fallback in
// app/dashboard-mieter/melden/page.tsx::analyseText (kein KI-API-Call
// nötig). Geocoding-API wird gemockt (Photon ist rate-limited).
//
// DB-Assertion: nach Submit existiert ein Ticket mit erstellt_von =
// Mieter und Status = 'offen'.

const SCHADEN_BESCHREIBUNG = "E2E: Wasserhahn tropft, Pfütze unter dem Waschbecken"
const SCHADEN_ORT = "Teststraße 5, 10115 Berlin"

async function loggedInMieterPage(browser: Browser) {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem(
      "reparo_cookie_consent",
      JSON.stringify({ wahl: "alle", datum: new Date().toISOString() }),
    )
  })
  const token = await userAccessToken(TEST_USERS.mieter.email, TEST_USERS.mieter.password)
  await context.route("**/api/**", async route => {
    const headers = { ...route.request().headers(), authorization: `Bearer ${token}` }
    await route.continue({ headers })
  })
  // Photon-Geocoding mocken
  await context.route("**/photon.komoot.io/**", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        features: [{
          geometry: { coordinates: [13.4, 52.53] },
          properties: { street: "Teststraße", housenumber: "5", postcode: "10115", city: "Berlin", countrycode: "DE" },
        }],
      }),
    }),
  )
  const page = await context.newPage()
  await login(page, { email: TEST_USERS.mieter.email, password: TEST_USERS.mieter.password })
  return { context, page }
}

test.describe.serial("Mieter-Flow: Schaden melden", () => {
  test.slow()

  test("Mieter geht durch Wizard und sieht Ticket in seiner Liste", async ({ browser }) => {
    const seed = await seedTestUsers()
    const { context, page } = await loggedInMieterPage(browser)

    // 1. Schaden-melden-Page öffnen
    await page.goto("/dashboard-mieter/melden")
    await expect(page.getByRole("heading", { name: /Schaden melden/i })).toBeVisible()

    // 2. Step "foto" — wir geben Text-Beschreibung statt Foto
    await page.getByPlaceholder(/Wasser tropft|beschreibe/i).fill(SCHADEN_BESCHREIBUNG)
    await page.getByRole("button", { name: /KI-Analyse starten/i }).click()

    // 3. Step "analyse" → "details": KI-Fallback (regex) braucht ~500ms
    await expect(page.getByText(/KI-Analyse abgeschlossen/i)).toBeVisible({ timeout: 10_000 })

    // 4. Details-Step → "Weiter — Ort angeben"
    await page.getByRole("button", { name: /Weiter.*Ort angeben/i }).click()

    // 5. Ort-Step: Adresse eingeben oder Profil-Wohnung nutzen
    //    (Mieter-Test-User hat keine Profil-Wohnung → manuelle Eingabe)
    const adresseInput = page.getByPlaceholder(/Straße, Hausnummer, Ort/i)
    if (await adresseInput.isVisible().catch(() => false)) {
      await adresseInput.fill(SCHADEN_ORT)
      // Photon-Vorschlag erscheint dropdown — den ersten klicken
      const vorschlag = page.getByText(/Teststraße|Berlin/i).first()
      await vorschlag.click({ timeout: 5_000 }).catch(() => { /* fallback */ })
    }
    // Wohnungs-Bezeichnung (optional)
    const wohnungInput = page.getByPlaceholder(/Whg\./i)
    if (await wohnungInput.isVisible().catch(() => false)) {
      await wohnungInput.fill("Whg. 3 OG")
    }
    await page.getByRole("button", { name: /Weiter.*Zusammenfassung/i }).click()

    // 6. Zusammenfassung → Submit
    await page.getByRole("button", { name: /Schaden melden|Senden|Abschicken/i }).first().click()

    // 7. Erfolg-Page
    await expect(page.getByText(/erfolgreich.*gesendet|wurde.*aufgenommen|Vielen Dank/i)).toBeVisible({ timeout: 10_000 })

    // 8. DB-Assertion: Ticket existiert
    const admin = adminClient()
    const { data: tickets } = await admin
      .from("tickets")
      .select("id, titel, beschreibung, status, erstellt_von")
      .eq("erstellt_von", seed.mieter.id)
      .order("created_at", { ascending: false })
      .limit(1)
    expect(tickets).toBeTruthy()
    expect(tickets!.length).toBeGreaterThan(0)
    expect(tickets![0].status).toBe("offen")
    expect(tickets![0].beschreibung).toContain("Wasserhahn")

    await context.close()
  })

  test.afterAll(async () => {
    // Cleanup: gerade angelegtes E2E-Ticket entfernen, damit nachfolgende
    // Test-Runs idempotent bleiben.
    const admin = adminClient()
    await admin
      .from("tickets")
      .delete()
      .ilike("beschreibung", "%E2E:%")
  })
})
