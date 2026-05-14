import type { Page } from "@playwright/test"

// UI-Login-Helper: füllt das Login-Formular aus und wartet bis Dashboard
// geladen ist. Nutzt die echte UI statt API-Direct-Login, damit Tests
// auch Auth-State-Edge-Cases mit abdecken.

interface LoginOptions {
  email: string
  password: string
  /** Pfad zu dem nach Login redirected werden soll. Default: rollen-spezifisches Dashboard. */
  expectedPath?: string | RegExp
}

export async function login(page: Page, { email, password, expectedPath }: LoginOptions): Promise<void> {
  await page.goto("/login")
  await page.getByLabel(/E-Mail-Adresse/i).fill(email)
  await page.getByLabel(/Passwort/i).fill(password)
  await page.getByRole("button", { name: /Anmelden/i }).click()

  // Default: wartet auf irgendein Dashboard
  const target = expectedPath ?? /\/dashboard-(verwalter|handwerker|mieter|admin)/
  await page.waitForURL(target, { timeout: 15_000 })
}
