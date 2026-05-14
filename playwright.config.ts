import { defineConfig, devices } from "@playwright/test"

// Erste Browser müssen installiert werden:
//   npx playwright install --with-deps chromium
//
// Setup-Reihenfolge für E2E-Tests:
//   1. `npm run db:start`    → lokales Supabase (Docker)
//   2. `export E2E_SUPABASE_URL=http://127.0.0.1:54321`
//      `export E2E_SUPABASE_ANON_KEY=<anon key>`
//      `export E2E_SUPABASE_SERVICE_ROLE_KEY=<service_role key>`
//   3. `npm run test:e2e`
//
// Playwright startet den Dev-Server automatisch mit den E2E_*-Vars
// als Supabase-Config — der App-Server läuft dann gegen die LOKALE DB,
// nicht gegen Prod. Wenn du den Server bereits selbst gestartet hast,
// setze `PLAYWRIGHT_BASE_URL=http://localhost:<port>`.

const PORT = process.env.PORT || 3000
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  testDir: "./tests/e2e",
  // Tests teilen sich dieselben Test-User in der DB — paralleler Lauf
  // würde seed-Konflikte erzeugen (z. B. Tickets eines anderen Tests
  // löschen). Single-Worker, fullyParallel innerhalb einer file via
  // test.describe.serial gesteuert.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Wichtig: leitet die E2E-Supabase-Vars in den Dev-Server-Prozess
        // weiter. Ohne das würde der Auto-gestartete Server aus .env.local
        // gegen die Prod-DB verbinden, nicht gegen die lokale Supabase.
        env: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          SUPABASE_SERVICE_ROLE_KEY: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        },
      },
})
