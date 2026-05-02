import { test, expect } from "@playwright/test"

test.describe("Landing Page", () => {
  test("rendert Hero, Sektionen und CTAs", async ({ page }) => {
    await page.goto("/")

    // Hero
    await expect(page.getByRole("heading", { name: /Mehr verdienen/i })).toBeVisible()
    await expect(page.getByText(/Stundenauktion/i).first()).toBeVisible()

    // Hauptsektionen sichtbar
    await expect(page.getByRole("heading", { name: /So funktioniert die Stundenauktion/i })).toBeVisible()
    await expect(page.getByRole("heading", { name: /Häufige Fragen/i })).toBeVisible()

    // CTA-Buttons
    await expect(page.getByRole("link", { name: /Kostenlos als Handwerker starten/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /Ich bin Verwalter/i })).toBeVisible()
  })

  test("Footer-Links zu Impressum und Datenschutz funktionieren", async ({ page }) => {
    await page.goto("/")

    await page.getByRole("link", { name: "Impressum" }).first().click()
    await expect(page).toHaveURL(/\/impressum$/)
    await expect(page.getByRole("heading", { name: /Impressum/i })).toBeVisible()

    await page.goBack()
    await page.getByRole("link", { name: "Datenschutz" }).first().click()
    await expect(page).toHaveURL(/\/datenschutz$/)
    await expect(page.getByRole("heading", { name: /Datenschutzerklärung/i })).toBeVisible()
  })

  test("FAQ-Accordion lässt sich öffnen und schließen", async ({ page }) => {
    await page.goto("/#funktionen")

    // Erste FAQ ist standardmäßig offen
    const ersteFrage = page.getByRole("button", { name: /Was kostet Reparo/i })
    await expect(ersteFrage).toHaveAttribute("aria-expanded", "true")

    // Schließen
    await ersteFrage.click()
    await expect(ersteFrage).toHaveAttribute("aria-expanded", "false")
  })
})
