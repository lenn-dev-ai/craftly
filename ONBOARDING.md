# Reparo — Developer Onboarding

## 1. Repo / Codezugriff

- **Repo:** `git@github.com:lenn-dev-ai/craftly.git`
- **Branch:** `main` (einziger aktiver Branch)
- **Stack:** Next.js 14.2 (App Router) + Supabase + Tailwind CSS + TypeScript
- **Hosting:** Netlify (auto-deploy von `main`) → https://reparo-app.netlify.app
- **Supabase Projekt:** `gkojaogdzzyuboajwyom` (West EU / Ireland)

## 2. Lokale Startanleitung

```bash
git clone git@github.com:lenn-dev-ai/craftly.git
cd craftly

# Dependencies (npm)
npm install

# Env-Datei anlegen
cp .env.example .env.local
# → Supabase URL + Anon Key eintragen (siehe Punkt 3)

# Dev-Server
npm run dev              # → http://localhost:3000

# Build
npm run build            # Production Build

# Type-Check
npm run typecheck        # tsc --noEmit

# Lint
npm run lint             # next lint

# E2E Tests (braucht Playwright)
npm run test:e2e:install # einmalig: Chromium installieren
npm run test:e2e         # 14 Tests, alle grün Stand 15.05.2026

# Lokale Supabase (optional, nicht zwingend)
npm run db:start         # Docker-basiert
npm run db:reset         # Schema + Seed neu laden
npm run db:stop
```

## 3. Environment Variables

Die `.env.example` liegt im Repo. Für eine funktionierende lokale Instanz brauchst du nur 2 Werte:

```env
# PFLICHT — ohne läuft nichts
NEXT_PUBLIC_SUPABASE_URL=https://gkojaogdzzyuboajwyom.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key aus Supabase Dashboard → Settings → API>

# OPTIONAL — Funktionen degraden graceful ohne diese Keys
ANTHROPIC_API_KEY=               # KI-Schadenserkennung (ohne: Regex-Fallback)
RESEND_API_KEY=                  # E-Mail-Versand (ohne: No-Op, kein Crash)
CRON_SECRET=                     # Cron-Auth für /api/auction/check-expired
NEXT_PUBLIC_SITE_URL=            # Absolute URLs in Mails (Default: Netlify-URL)
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=    # Analytics (ohne: kein Tracking)
```

**Anon Key holen:** Supabase Dashboard → Project Settings → API → `anon` `public` Key kopieren.

### Google-OAuth aktivieren (optional, aber für Beta empfohlen)

Reparo unterstützt seit Mai 2026 Google-Login auf `/login` und `/registrierung`. Die UI ist immer sichtbar — der Button funktioniert aber nur wenn der Provider in Supabase aktiviert ist und ein Google OAuth Client existiert.

**Schritt 1 — Google Cloud Console:**
1. https://console.cloud.google.com → neues Projekt (z.B. `reparo-oauth`) oder bestehendes wählen
2. APIs & Services → OAuth consent screen → "External" → App-Name `Reparo`, Support-Email + Developer-Email setzen, Domain `reparo-app.netlify.app` als Authorized Domain
3. Credentials → Create Credentials → OAuth Client ID → Web Application
   - Name: `Reparo Web`
   - Authorized JavaScript origins: `https://reparo-app.netlify.app`, `http://localhost:3000`
   - Authorized redirect URIs: `https://gkojaogdzzyuboajwyom.supabase.co/auth/v1/callback` (← die Supabase-Callback-URL, nicht deine eigene!)
4. Client ID + Client Secret kopieren

**Schritt 2 — Supabase Dashboard:**
1. Authentication → Providers → Google → Enable
2. Client ID + Client Secret einfügen → Save
3. Authentication → URL Configuration:
   - Site URL: `https://reparo-app.netlify.app`
   - Additional Redirect URLs: `http://localhost:3000/auth/callback`, `https://reparo-app.netlify.app/auth/callback`

**Schritt 3 — Test:**
- Lokal `npm run dev` starten → `/login` → "Mit Google anmelden" → Google-Consent → landet zurück auf `/auth/callback` → falls neu: `/onboarding` für Rolle, sonst direkt aufs Dashboard

Wenn der Button bei einem User Fehler zeigt, kommt die Meldung als `?oauth_error=...`-Query zurück auf `/login` und wird oben in der roten Box angezeigt.

### Stripe Connect aktivieren (optional, Foundation für Penalty-System)

Reparo hat seit Mai 2026 ein Stripe-Connect-Onboarding für Handwerker auf `/dashboard-handwerker/verdienst`. Solange `STRIPE_SECRET_KEY` nicht gesetzt ist, zeigt die UI "Auszahlungen über Reparo werden vorbereitet" und alle `/api/stripe/*`-Endpoints returnen 503. Der Frist-Cron markiert Penalties trotzdem als `manual_pending` in `tickets.penalty_status` — du kannst manuell abrechnen oder später aktivieren.

**Schritt 1 — Stripe-Account + Connect aktivieren:**
1. https://dashboard.stripe.com → Account erstellen (Test-Mode reicht für Beta)
2. Connect → Settings → Platform-Profile ausfüllen (Branding, Beschreibung)
3. Connect → Settings → Type: Express aktivieren

**Schritt 2 — API-Keys:**
1. Developers → API Keys → Secret key (`sk_test_…`) kopieren
2. In `.env.local` / Netlify-Env setzen: `STRIPE_SECRET_KEY=sk_test_…`

**Schritt 3 — Webhook:**
1. Developers → Webhooks → Add Endpoint
   - URL: `https://reparo-app.netlify.app/api/stripe/webhook`
   - Events: `account.updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`
2. Signing-Secret (`whsec_…`) kopieren → `STRIPE_WEBHOOK_SECRET=whsec_…`

**Schritt 4 — Test:**
- Als HW einloggen → `/dashboard-handwerker/verdienst` → "Mit Stripe verbinden" → Stripe-Hosted-Onboarding ausfüllen (Test-Mode: nutze Stripe's test-data) → zurück zur App, sollte "✓ Bankkonto verbunden" zeigen
- Im Stripe-Dashboard sieht man den Express-Account unter Connect → Accounts

**Phase 2 (offen):** echte Penalty-Charging-Logik. Aktuell läuft nur die DB-Markierung — die Architektur-Entscheidung (PaymentMethod via SetupIntent vs. Connect-Reversal) steht aus. Bis dahin manuelle Verrechnung via `SELECT id, titel, penalty_amount_cents FROM tickets WHERE penalty_status='manual_pending'`.

## 4. Supabase Zugriff

### Projekt-Dashboard
https://supabase.com/dashboard/project/gkojaogdzzyuboajwyom

### Tabellenstruktur (Haupttabellen)
| Tabelle | Zweck |
|---------|-------|
| `profiles` | Alle User (Rollen: admin, verwalter, handwerker, mieter) |
| `tickets` | Schadensmeldungen / Aufträge (Status: offen → auktion → in_bearbeitung → erledigt) |
| `objekte` | Immobilien-Objekte (Adresse, Verwalter-Zuordnung) |
| `angebote` | HW-Angebote auf Tickets (Preis, Status, Smart-Score) |
| `bewertungen` | Mieter-Bewertungen nach Erledigung |
| `einladungen` | Verwalter lädt HW ein (Token-basiert) |
| `zeitslots` | HW Verfügbarkeiten (Wochentag + Zeitfenster) |
| `termine` | Gebuchte Termine (Ticket + HW + Datum) |
| `ki_quota` | Rate-Limiting für KI-Calls (10/Tag pro User) |

### SQL-Migrationen
Alle 25 Migrationen liegen in `supabase/migrations/` — chronologisch sortiert. Die wichtigsten neueren:

- `20260519000000_security_hardening.sql` — RLS Policies, Trigger-Guards, is_admin() Helper
- `20260519100000_security_recursion_fix.sql` — SECURITY DEFINER für RLS-Rekursion
- `20260519200000_security_trigger_nesting_fix.sql` — pg_trigger_depth() Bypass
- `20260520100000_rate_limit_ki_separate_table.sql` — ki_quota Tabelle + try_consume_ki_quota()

### RLS-Policies
Aktiviert auf allen Tabellen. Wichtige Pattern:
- `is_admin()` SECURITY DEFINER Helper für Admin-Checks ohne Rekursion
- `has_einladung()`, `can_bewerten()`, `is_handwerker()` als Rekursions-Breaker
- `protect_profile_fields()` + `protect_ticket_fields()` BEFORE UPDATE Trigger (Column-Level Protection)
- `pg_trigger_depth() > 1` Bypass für kaskadierende Trigger

### Seed-/Demo-Daten (Cloud)
| Rolle | Anzahl | Login-Pattern |
|-------|--------|---------------|
| Admin | 1 | Max Mustermann (lenn.test.2@gmail.com) |
| Verwalter | 1 | über Rollen-Wechsel im Admin-Dashboard |
| Handwerker | 1 | Mustermann Sanitär GmbH (gleicher Account) |
| Mieter | 1 | Test Mieter |

**Admin-Login:** lenn.test.2@gmail.com (Passwort kennt KI)

### Migrationen schreiben
Ja, du darfst Migrationen schreiben. Konvention:
```
supabase/migrations/YYYYMMDDHHMMSS_beschreibung.sql
```
- Immer idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`)
- Header-Kommentar mit Hintergrund/Motivation
- Erst lokal testen, dann auf Cloud via SQL Editor ausführen

## 5. Zielpriorität (Stand 15.05.2026)

| Prio | Bereich | Status |
|------|---------|--------|
| ✅ | Security Hardening (RLS, Trigger-Guards, Rate-Limiting) | Done |
| ✅ | Mobile-QA Bugs (Header-Overlap, Sidebar, HW-Subtitle) | Done |
| 🔴 1 | **Auth/Middleware** — Serverseitige Route-Protection für /admin, /dashboard-* | Offen |
| 🔴 2 | **Annehmen-Button Bug** — Verwalter kann Angebot nicht annehmen (Sprint 1) | In Arbeit (Claude Code) |
| 🟡 3 | Kalender mobil reparieren | In Arbeit (Claude Code) |
| 🟡 4 | Chat-Overflow fixen | In Arbeit (Claude Code) |
| 🟡 5 | Admin-Profil/Einstellungen-Seite (Email ändern etc.) | Offen |
| 🟢 6 | UI/UX Polish (Designsystem, Spacing, Konsistenz) | Später |
| 🟢 7 | Performance/SEO | Später |

**Claude Code arbeitet gerade an Sprint 1** (Punkte 2-4). Auth/Middleware ist der wichtigste offene Punkt für einen neuen Contributor.

## 6. Arbeitsregeln

- **Direkt auf `main` arbeiten** — kein Branch-Workflow aktuell (Solo-Projekt + AI-Agents)
- **Wenn du lieber PRs machst:** Gerne, dann Feature-Branch → PR → Merge
- **Dependencies:** Darfst installieren, aber sparsam. Keine großen UI-Libs (kein MUI, Chakra etc.) — alles ist Tailwind-only
- **Commits:** Ja, direkt committen. Konvention: `fix(bereich): Beschreibung` oder `feat(bereich): Beschreibung`
- **Tests:** E2E-Tests in `tests/` (Playwright). Wenn du Logik änderst, bestehende Tests nicht brechen. `npm run test:e2e` muss grün bleiben
- **Kein `npm run dev` mit Cloud-Supabase ohne `.env.local`** — ohne Env-Vars crasht der Client sofort

## 7. Projektstruktur (Überblick)

```
app/
├── dashboard-admin/        # Admin: Übersicht, Nutzer, Aktivität, System, Diagnose-Preise
├── dashboard-verwalter/    # Verwalter: Dashboard, Tickets, Marktplatz, Handwerker, Reporting
├── dashboard-handwerker/   # HW: Dashboard, Aufträge, Diagnosen, Karte, Zeitplan, Profil
├── dashboard-mieter/       # Mieter: Dashboard, Melden, Ticket-Detail
├── api/                    # API Routes (auction, ki, cron, auth)
├── login/                  # Auth
├── impressum/ agb/ datenschutz/  # Rechtsseiten
└── page.tsx                # Landing Page

components/
├── layout/
│   └── Sidebar.tsx         # Responsive Sidebar (alle Dashboards)
├── ticket/                 # Ticket-Karten, Detail, Pipeline
├── handwerker/             # HW-spezifische Komponenten
├── landing/                # Landing Page Sections
├── pricing/                # Preismodell
└── ui/                     # Buttons, Cards, Skeletons, Toasts

lib/
├── supabase.ts             # Supabase Client (Browser)
├── supabase-server.ts      # Supabase Client (Server/API)
└── design-tokens.ts        # Farben, Spacing (neu)

supabase/
├── migrations/             # 25 SQL-Dateien (chronologisch)
└── seed.sql                # Demo-Daten
```

## 8. Bekannte Architektur-Schwächen

1. **Keine serverseitige Auth-Middleware** — Dashboard-Routes sind nur client-seitig geschützt (useEffect-Redirect). Jeder kann `/dashboard-admin` aufrufen und sieht kurz den Content bevor der Redirect greift. → **Erste Baustelle für dich.**
2. **Kein Designsystem** — Farben/Spacing sind als Hex-Werte in jeder Komponente hartcodiert. `design-tokens.ts` existiert seit kurzem, ist aber noch nicht überall verwendet.
3. **Monolithische Page-Komponenten** — Manche Dashboard-Pages sind 300+ Zeilen. Refactoring in kleinere Komponenten wäre gut.
4. **Keine Unit-Tests** — Nur E2E-Tests (Playwright). Unit-Tests für Business-Logik (Auction-Engine, Smart-Score) fehlen.
