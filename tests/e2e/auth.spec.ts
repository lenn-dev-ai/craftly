import { test, expect } from "@playwright/test"

test.describe("Auth-Routing & Validierung", () => {
  test("Geschützte Dashboard-Route leitet ohne Auth zum Login um", async ({ page }) => {
    await page.goto("/dashboard-verwalter")
    await expect(page).toHaveURL(/\/login(\?|$)/)
  })

  test("Geschützte Admin-Route leitet ohne Auth zum Login um", async ({ page }) => {
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/login(\?|$)/)
  })

  test("Login-Form zeigt Validierungs-Fehler bei leerer Submission", async ({ page }) => {
    await page.goto("/login")

    // Warten bis Form sichtbar (verhindert Race nach Auth-Check)
    await expect(page.getByRole("button", { name: /Anmelden/i })).toBeVisible()

    await page.getByRole("button", { name: /Anmelden/i }).click()

    // zod-Schema sollte Fehler triggern (E-Mail Pflicht + Passwort Pflicht)
    await expect(page.getByText(/E-Mail-Adresse eingeben|gültige E-Mail/i).first()).toBeVisible()
    await expect(page.getByText(/Passwort eingeben/i)).toBeVisible()
  })

  test("Login-Form zeigt Format-Fehler bei ungültiger E-Mail", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByLabel(/E-Mail-Adresse/i)).toBeVisible()

    await page.getByLabel(/E-Mail-Adresse/i).fill("nicht-eine-email")
    await page.getByLabel(/Passwort/i).fill("irgendwas")
    await page.getByRole("button", { name: /Anmelden/i }).click()

    await expect(page.getByText(/gültige E-Mail-Adresse/i)).toBeVisible()
  })

  test("Registrierung zeigt Handwerker-spezifische Felder erst nach Rollenwahl", async ({ page }) => {
    await page.goto("/registrierung")

    // Standard ist "verwalter" — keine Firmen-/Gewerk-Felder
    await expect(page.getByLabel(/Firmenname/i)).not.toBeVisible()

    await page.getByLabel(/Ich bin/i).selectOption("handwerker")

    // Jetzt sollten die Handwerker-Felder erscheinen
    await expect(page.getByLabel(/Firmenname/i)).toBeVisible()
    await expect(page.getByLabel(/Gewerk/i)).toBeVisible()
  })

  test("Passwort-Stärke-Anzeige reagiert live", async ({ page }) => {
    await page.goto("/registrierung")

    const passwortFeld = page.getByLabel(/^Passwort$/)
    await passwortFeld.fill("kurz")
    await expect(page.getByText(/Mindestens 8 Zeichen/i).first()).toBeVisible()

    await passwortFeld.fill("Stark1Passwort")
    await expect(page.getByText(/^Stark$/)).toBeVisible()
  })
})
