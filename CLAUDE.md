# Reparo — Projektkontext für Claude Code

KI-getriebene Hausverwaltungs-Plattform. Drei Rollen: Mieter (meldet),
Verwalter (genehmigt), Handwerker (nimmt an). **Kernprinzip: Die KI
entscheidet und treibt den Prozess, Menschen genehmigen — nicht umgekehrt.**

- Repo: `~/Desktop/Reparo` · Prod: https://reparo-app.netlify.app
- Telefon Voice-AI: +1 (541) 800-4518

## Tech-Stack

- Next.js 14 (App Router), TypeScript (strict), Tailwind
- Supabase (Postgres + Auth + RLS), Service-Role-Client für interne Writes
- Netlify (Deploy + Scheduled Functions in `netlify/functions/*.mts`)
- Resend (E-Mail), Mapbox (Karte), Google Calendar API, Vapi (Voice AI)

## Befehle

- `npm run typecheck` — `tsc --noEmit` (immer vor "fertig" laufen lassen)
- `npm run build` — Production-Build (finaler Gate vor Deploy)
- `npm run lint` — ESLint
- `npm run dev` — lokaler Dev-Server
- DB: Migrationen liegen in `supabase/migrations/`, Apply via `supabase db push`

## Arbeitsweise (wichtig)

- **Einfach machen, nicht nachfragen.** Triff vernünftige Annahmen und setze
  sie um, statt um Erlaubnis oder Klärung zu bitten. Nur bei wirklich
  folgenschweren, unumkehrbaren Entscheidungen (Geld, Löschungen,
  Produktrichtung) kurz rückfragen.
- Bei Bugs: erst Root Cause verstehen, dann fixen — keine Schuss-ins-Blaue-Fixes.
- Nach Code-Änderungen **immer** `npm run typecheck` laufen lassen; bei
  größeren Änderungen zusätzlich `npm run build`.
- Defensiv programmieren: neue DB-Spalten-Zugriffe so bauen, dass der Code
  auch vor dem Migrations-Apply nicht crasht (try/catch + Defaults).
- Kleine, fokussierte Commits mit Conventional-Commit-Prefix
  (`fix:`, `feat:`, `chore:`). Nicht ungefragt pushen, außer es wird verlangt.

## Konventionen

- Kommentare und UI-Texte auf **Deutsch**.
- Migrationen: `YYYYMMDDHHMMSS_sprint_XX_beschreibung.sql`, immer
  `ADD COLUMN IF NOT EXISTS` / idempotent.
- Service-Role-Writes über `createServiceRoleClient()` aus
  `lib/supabase-server` (umgeht `protect_ticket_fields()` bewusst).
- Crons: Route unter `app/api/cron/<name>/route.ts` + Netlify-Wrapper
  `netlify/functions/<name>.mts` mit `x-cron-secret`-Auth (`CRON_SECRET`).

## Architektur — Auftragsvergabe (Kern der App)

Die Vergabe-Engine ist das Herzstück. Ablauf bei neuem Ticket:

1. **Auto-Vergabe** (`lib/auction/auto-vergabe.ts`, Sprint BD) startet beim
   Anlegen automatisch — Verwalter-Tickets sofort, Mieter-Tickets mit
   Sicherheitsnetz (nur Notfälle sofort, Rest wartet auf Freigabe).
2. **Stamm-HW-Vorzug** (`lib/auction/stamm-routing.ts`) — Vertrauens-HW wird
   zuerst 1:1 angefragt.
3. **Sequenzielle Direktvergabe** (`lib/auction/direktvergabe.ts`) — Top-
   Kandidat nach Smart-Score bekommt Anfrage mit gestaffeltem Timeout
   (notfall 15 Min / zeitnah 2 h / planbar 24 h). Cron
   `direktvergabe-eskalation` rückt bei Timeout zum nächsten Kandidaten.
4. **Mass-Invite-Auktion** als Fallback, wenn kein Kandidat im Radius.

Verwalter-Leitplanken (Präferenzen auf `profiles`): `auto_vergabe_aktiv`
(Master), `auto_vergabe_budget_eur` (Budget-Gate), `auto_freigabe_stunden`
(Cron `auto-freigabe` gibt wartende Mieter-Tickets frei). Der Marktplatz
(`app/dashboard-verwalter/marktplatz`) ist ein **Statusboard**, kein
Aktions-Werkzeug — manuelle Eingriffe sind bewusst Fallback.

## Sensible Dateien — nicht anfassen / nicht ausgeben

- `.env`, `.env.local` (Secrets) — niemals den Inhalt ausgeben.
- `prioritaet`-Werte sind projektweit `planbar | zeitnah | notfall`.
