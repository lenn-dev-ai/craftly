# E2E-Tests (Playwright)

Diese Tests laufen gegen **lokales Supabase** in Docker — keine Prod-DB,
keine Cloud-Latency, deterministisch.

## Voraussetzungen (einmalig)

1. **Docker Desktop** installieren (oder Colima)
2. **Supabase CLI** installieren:
   ```bash
   brew install supabase/tap/supabase
   ```
3. **Playwright-Browser** installieren:
   ```bash
   npm run test:e2e:install
   ```

## Setup für einen Test-Run

### 1. Lokales Supabase starten

```bash
npm run db:start
```

Beim ersten Start dauert das 1–2 Min (Image-Download). Output enthält:

```
         API URL: http://127.0.0.1:54321
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
        anon key: eyJhbGciOiJI...
service_role key: eyJhbGciOiJI...
```

### 2. Migrationen anwenden

Alle Migrationen aus `supabase/migrations/` werden bei jedem `db:reset`
sauber neu eingespielt:

```bash
npm run db:reset
```

### 3. Environment-Variablen exportieren

```bash
export E2E_SUPABASE_URL=http://127.0.0.1:54321
export E2E_SUPABASE_SERVICE_ROLE_KEY=<service_role key aus db:start-Output>
```

Du kannst sie auch in `.env.test.local` (gitignored) speichern und vor
dem Test-Run via `source .env.test.local` laden.

### 4. Next-App gegen lokale Supabase starten

In einem zweiten Terminal:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key> \
npm run dev
```

### 5. Tests starten

```bash
npm run test:e2e
```

Oder mit UI-Mode für interaktives Debugging:

```bash
npm run test:e2e:ui
```

## Test-User

Werden in `tests/e2e/helpers/seed.ts` definiert und vor jedem Test-Run
frisch angelegt (alter State wird gelöscht):

| Rolle | Email | Passwort |
|---|---|---|
| Mieter | `mieter@reparo.test` | `TestMieter2026!` |
| Handwerker Diagnose | `hw-diagnose@reparo.test` | `TestHwDiag2026!` |
| Handwerker Konkurrent | `hw-konkurrent@reparo.test` | `TestHwKonk2026!` |
| Verwalter | `verwalter@reparo.test` | `TestVerwalt2026!` |

## Bekannte Limits

- **Mieter-melden-UI ist nicht getestet** — der Test legt Diagnose-Tickets
  direkt per Admin-DB an. Grund: Berechtigungs-Konzept (wer ist
  `erstellt_von`?) ist noch nicht final.
- **Geocoding wird gemockt** — Nominatim ist rate-limited, würde flaky werden.
- **Email-Versand**: Resend ist nicht konfiguriert in der Test-Umgebung,
  fire-and-forget bleibt no-op (siehe `lib/email/send.ts`).

## Was die Tests abdecken (Phase 1)

- `diagnose-flow.spec.ts`:
  - **Annehmen-Pfad**: HW gibt Befund + Festpreis ab → Verwalter klickt
    "Annehmen" → Projekt-Ticket entsteht, `kosten_final` = Restzahlung,
    Provision auf Restzahlung, Diagnose-Ticket erledigt.

## Geplant (Phase 2)

- `diagnose-flow.spec.ts` Auktion-mit-Vorkaufsrecht
- `diagnose-nachtraege.spec.ts` (3 Stufen)
- Mieter-melden-UI Smoke-Test
