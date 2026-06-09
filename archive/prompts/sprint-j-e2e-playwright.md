# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint J — Playwright E2E-Test-Suite für Kern-Flows

> Quality-Layer. CC kann während Lennart-Urlaub durchziehen.
> Aufwand: ~8h Claude Code. Eigenständig.

## Ziel

3 Kern-Flows als End-to-End-Tests in Playwright. Läuft in CI bei jedem PR + nightly auf Production.

## Kern-Flows

### Flow 1 — Mieter meldet Schaden
1. Mieter-Login (test.mieter@craftly-test.de)
2. Klick „Schaden melden"
3. Wizard durch: Gewerk, Beschreibung, Ort, Dringlichkeit
4. Submit → Ticket erscheint in „Meine Tickets"

### Flow 2 — Verwalter vergibt Ticket
1. Verwalter-Login (test.verwalter@craftly-test.de)
2. Sieht neues Ticket in Liste
3. Klick → Detail-View
4. Klick „An Handwerker vergeben"
5. Auswahl-Dialog: HW auswählen + Auktion starten
6. Submit → Status = „auktion"
7. Verify: Toast + Status-Badge

### Flow 3 — Handwerker bietet + gewinnt
1. HW-Login (test.handwerker@craftly-test.de)
2. Marktplatz: neues Ticket sichtbar
3. Klick → Detail
4. Angebot abgeben (Preis + Dauer + Anmerkung)
5. Submit → Toast „Angebot eingereicht"
6. Verwalter-Tab: Angebot erscheint im Ticket
7. Verwalter klickt „Angebot annehmen"
8. HW-Tab: Status = „beauftragt"

## Tech-Stack

- Playwright (npm i -D @playwright/test)
- Browser: Chromium (CI), Firefox + Webkit lokal optional
- Reporter: HTML-Reporter für CI-Artifacts
- Base-URL: `process.env.E2E_BASE_URL` (default: http://localhost:3000)

## Setup-Steps

### Phase J1 — Playwright installieren + Config (45 min)

```bash
npm i -D @playwright/test
npx playwright install chromium
```

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  retries: 1,
  workers: 1,  // sequenziell wegen DB-State
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
})
```

### Phase J2 — Test-Setup mit Auth-Fixtures (1h)

`e2e/fixtures.ts`:
- Helper `loginAs(page, role)` → ruft `/login`, tippt Email+PW, wartet auf Dashboard
- Helper `createCleanTicket(page)` → setzt DB-State zurück via API

### Phase J3 — Flow 1 (Mieter meldet) implementieren (1.5h)

`e2e/flow-mieter-meldet.spec.ts`

### Phase J4 — Flow 2 (Verwalter vergibt) implementieren (1.5h)

`e2e/flow-verwalter-vergibt.spec.ts`

### Phase J5 — Flow 3 (HW bietet) implementieren (2h)

`e2e/flow-hw-bietet.spec.ts`

### Phase J6 — CI-Integration via GitHub Actions (1h)

`.github/workflows/e2e.yml`:
- Trigger: pull_request + nightly cron
- Steps: install → start dev server → run playwright → upload report
- Browser: chromium only (für Speed)

### Phase J7 — Commit + PR

`feat(e2e): Playwright-Suite für 3 Kern-Flows (Sprint J)`

## Constraints

- Tests müssen idempotent sein (DB-Cleanup vor jedem Test via API-Helper)
- Keine echten E-Mails verschicken (Resend mocken oder Test-ENV mit RESEND_SKIP_SEND=true)
- Test-Accounts müssen existieren (test.mieter, test.verwalter, test.handwerker)
- Tests laufen gegen lokalen dev-Server oder Preview-Deploy

## Erfolg

- 3 Kern-Flows nightly grün
- Jeder PR sieht E2E-Status vor merge
- Regressions-Sicherheit für künftige Sprints

## Erster Schritt

Phase J1 (Playwright installieren) + J2 (Auth-Fixtures).
