import { test, expect } from "@playwright/test"

// Post-Deploy-Smoke-Test (Audit 11.07.2026).
//
// Ergänzt die tiefen Flow-Specs (flow-mieter-meldet / flow-hw-bietet /
// flow-verwalter-vergibt), die lokales Supabase + Seed brauchen. Dieser
// Smoke-Test läuft OHNE Docker/Seed/Auth gegen eine DEPLOYTE URL und prüft
// nur, dass die kritische Infrastruktur gesund ist — als schneller Gate
// nach jedem Deploy.
//
// Ausführen (gegen Prod oder Deploy-Preview):
//   PLAYWRIGHT_BASE_URL=https://reparo-app.de npx playwright test smoke
// bzw. `npm run test:smoke`.

test.describe("Smoke: kritische Infrastruktur", () => {
  test("Landing lädt und zeigt den Hero", async ({ page }) => {
    const res = await page.goto("/")
    expect(res?.status()).toBeLessThan(400)
    await expect(page.getByRole("heading", { name: /Mehr verdienen/i })).toBeVisible({ timeout: 15_000 })
  })

  test("Login-Seite lädt und zeigt das Formular", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("button", { name: "Anmelden", exact: true })).toBeVisible({ timeout: 15_000 })
  })

  test("Geschützte Route leitet ohne Auth zum Login um", async ({ page }) => {
    await page.goto("/dashboard-verwalter")
    await page.waitForURL(/\/login(\?|$)/, { timeout: 15_000 })
  })

  test("Cron-Endpunkt weist unauthentifizierte Aufrufe ab", async ({ request }) => {
    // Ohne x-cron-secret und ohne Admin-Session → kein Zugang (Auth-Guard
    // aus lib/cron/auth.ts). 401/403/503 sind alle akzeptable Abweisungen;
    // 200 wäre ein Sicherheitsloch.
    const res = await request.post("/api/cron/direktvergabe-eskalation")
    expect([401, 403, 503]).toContain(res.status())
  })

  test("Telemetrie-Endpunkt verlangt Login", async ({ request }) => {
    const res = await request.post("/api/telemetrie", { data: { feature: "karte" } })
    expect(res.status()).toBe(401)
  })
})
