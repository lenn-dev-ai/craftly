# Reparo

KI-getriebene Hausverwaltungs-Plattform. Drei Rollen — **Mieter** melden Schäden,
**Verwalter** genehmigen, **Handwerker** nehmen an. Kernprinzip: **Die KI entscheidet
und treibt den Prozess, Menschen genehmigen — nicht umgekehrt.**

- Prod: https://reparo-app.de (Closed Beta hinter Basic-Auth-Gate)
- Repo: github.com/lenn-dev-ai/craftly

---

## Architektur

| Schicht | Technik |
|---|---|
| Frontend/Backend | Next.js 14 (App Router), TypeScript (strict), Tailwind |
| Datenbank + Auth | Supabase (Postgres + RLS + Auth). Interne Writes über Service-Role-Client |
| Hosting | Netlify (Deploy + Scheduled Functions in `netlify/functions/*.mts`) |
| E-Mail | Resend (Domain reparo-app.de verifiziert) |
| Karte / Voice / Kalender | Mapbox · Vapi (Web-Voice + Telefon) · Google Calendar API |
| Zahlungen | Stripe (Connect + Provisions-Modell), optional |

### Verzeichnis-Layout
```
app/
  api/                 # Route Handler (REST). Auth via getUserFromRequest,
                       #   Cron via x-cron-secret, Webhooks via HMAC-Signatur
  api/cron/<name>/     # Cron-Logik  ← Wrapper in netlify/functions/<name>.mts
  dashboard-mieter|verwalter|handwerker|admin/   # Rollen-Dashboards
  status/[id]/         # Zero-Login-Statusseite für Mieter (HMAC-Token)
lib/
  auction/             # Vergabe-Engine (Herzstück, s.u.)
  agent/               # HW-Agent-Scoring (score-einladung)
  email/               # Resend-Versand + Templates
  vapi/                # Voice-Assistant-Config
  status-token.ts      # HMAC-Signierung für Zero-Login-Links
components/            # UI + rollenspezifische Komponenten
supabase/migrations/   # DB-Schema + RLS (idempotent, YYYYMMDDHHMMSS_*)
tests/unit/            # Vitest (reine Kern-Logik)   ·  tests/e2e/ = Playwright
```

### Vergabe-Engine (Kern)
Beim Anlegen eines Tickets läuft automatisch (`lib/auction/`):
1. **Auto-Vergabe** startet — Verwalter-Tickets sofort, Mieter-Tickets mit
   Sicherheitsnetz (nur Notfälle sofort, Rest wartet auf Freigabe).
2. **Stamm-HW-Vorzug** — Vertrauens-Handwerker wird zuerst 1:1 angefragt.
3. **Sequenzielle Direktvergabe** — Top-Kandidat nach Smart-Score, gestaffelter
   Timeout (Notfall 15 min / zeitnah 2 h / planbar 24 h). Cron rückt bei Timeout
   zum nächsten Kandidaten.
4. **Mass-Invite** als Fallback, wenn kein Kandidat im Radius.

Die geteilte Annehmen/Ablehnen-Logik liegt in `lib/auction/einladung-aktionen.ts`
(nutzen sowohl Web-UI als auch Voice-Assistent).

---

## Lokale Entwicklung

```bash
npm install
cp .env.example .env.local     # Werte eintragen (s. ENV-Checkliste unten)
npm run dev                    # http://localhost:3000
```

### Befehle
| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server |
| `npm run typecheck` | `tsc --noEmit` (immer vor „fertig") |
| `npm run lint` | ESLint (0 Warnings erwartet) |
| `npm run build` | Production-Build (finaler Gate) |
| `npm run test:unit` | Vitest — Vergabe-Engine, Provision, Scoring, Token |
| `npx playwright test` | E2E-Flows |

DB-Migrationen: liegen in `supabase/migrations/`, Apply via `supabase db push`
oder Supabase-Dashboard. Alle idempotent (`ADD COLUMN IF NOT EXISTS` etc.).

---

## Deployment (Netlify)

Deploys automatisch von `main` (GitHub-Integration). Build-Command `next build`,
Publish `.next` (via `@netlify/plugin-nextjs`). Scheduled Functions werden aus
`netlify/functions/*.mts` registriert.

Details + ENV-Checkliste: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

---

## Sicherheit (Stand Audit 2026-07-05)

- **RLS** auf allen 27 Tabellen aktiv, Policies rollenbasiert.
- **API-Auth** durchgängig: `getUserFromRequest` (Bearer), `x-cron-secret`,
  HMAC-Webhook-Signaturen. Vapi-Webhooks in Produktion signaturpflichtig.
- **SECURITY-DEFINER-Funktionen** gehärtet (kein anon-EXECUTE auf schreibenden).
- Bewusste Restposten: HaveIBeenPwned-Passwort-Check (Supabase Pro nötig),
  GraphQL-Schema-Sichtbarkeit (RLS-geschützt, Supabase-Default).
</content>
