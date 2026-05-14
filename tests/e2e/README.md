# E2E-Tests (Playwright)

Diese Tests laufen gegen **lokales Supabase** in Docker — keine Prod-DB,
keine Cloud-Latency, deterministisch.

## Voraussetzungen (einmalig)

1. **Docker Desktop** installieren (oder Colima)
2. **Supabase CLI**: `brew install supabase/tap/supabase`
3. **Playwright-Browser**: `npm run test:e2e:install`

## Setup für einen Test-Run

### 1. Vorbereitung — kein anderer Server auf Port 3000

Falls schon ein `next dev` oder ähnliches auf `:3000` läuft, beende es:

```bash
# Was hört auf 3000?
lsof -i :3000

# Alle Next-Server killen:
pkill -f "next dev"
```

Playwright startet seinen eigenen Dev-Server auf `:3000` mit den
lokalen-Supabase-Variablen. Wenn da schon was anderes läuft, gehen die
Tests gegen den **falschen** Server und Landing/Auth-Tests failen.

### 2. Lokales Supabase starten

```bash
npm run db:start
```

Beim ersten Start ~1-2 Min (Image-Download). Output zeigt die URLs +
Keys. Wenn Output verloren: `npm run db:status` zeigt es nochmal.

### 3. Migrationen anwenden

```bash
npm run db:reset
```

### 4. Environment-Variablen exportieren

**Empfohlen — Helper liest sie direkt aus `supabase status`:**

```bash
source tests/e2e/load-env.sh
```

Output:
```
✓ E2E-Env geladen aus 'supabase status':
  URL:     http://127.0.0.1:54321
  ANON:    eyJhbGciOiJIUzI1NiIsInR5cCI...
  SERVICE: eyJhbGciOiJIUzI1NiIsInR5cCI...
```

Damit ist Copy-Paste-Verwechslung von anon-Key und service_role-Key
ausgeschlossen. Auch nach `supabase stop` + `supabase start` ein
einziger Befehl statt drei Manuelle-Exporte.

**Manuell falls du es bewusst willst:**

```bash
export E2E_SUPABASE_URL=http://127.0.0.1:54321
export E2E_SUPABASE_ANON_KEY=<anon key>
export E2E_SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

### 5. Tests starten

```bash
npm run test:e2e
```

Playwright startet automatisch `npm run dev` mit den `E2E_*`-Vars
weitergeleitet — der App-Server läuft dann gegen die lokale DB.

Wenn du den Dev-Server schon **selbst** gestartet hast (z. B. auf
einem anderen Port), zeig Playwright wohin:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e
```

Dann startet Playwright keinen eigenen Server.

### Visuell debuggen

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

- **Mieter-melden-UI** wird im Annehmen-Pfad-Test umgangen — der Test
  legt Diagnose-Tickets direkt per Admin-DB mit `erstellt_von=Verwalter`
  an. Grund: API `projekt-annehmen` erlaubt nur Verwalter/Admin, aber
  Mieter ist im aktuellen Melden-Flow `erstellt_von`. Konzept-Bug —
  separat zu klären.
- **Geocoding gemockt** — Nominatim ist rate-limited, würde flaky werden.
- **Email-Versand**: Resend nicht konfiguriert in Test-Umgebung,
  fire-and-forget bleibt no-op (siehe `lib/email/send.ts`).

## Was die Tests abdecken (Phase 1)

- `auth.spec.ts` — Auth-Routing + Form-Validierung (existierend)
- `landing.spec.ts` — Landing-Page-UI (existierend)
- `diagnose-flow.spec.ts`:
  - **Annehmen-Pfad**: HW gibt Befund + Festpreis ab → Verwalter klickt
    "Annehmen" → Projekt-Ticket entsteht, `kosten_final` = Restzahlung,
    Provision auf Restzahlung, Diagnose-Ticket erledigt.

## Geplant (Phase 2)

- `diagnose-flow.spec.ts` Auktion-mit-Vorkaufsrecht
- `diagnose-nachtraege.spec.ts` (3 Stufen)
- Mieter-melden-UI Smoke-Test
