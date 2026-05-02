import { defineConfig, devices } from "@playwright/test"

// Erste Browser müssen installiert werden:
//   npx playwright install --with-deps chromium
// (oder alle Browser: npx playwright install)

const PORT = process.env.PORT || 3000
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Weitere Geräte aktivieren wenn nötig:
    // { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  // Lokal gegen `npm run dev` testen — in CI wird der Build separat gestartet
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
