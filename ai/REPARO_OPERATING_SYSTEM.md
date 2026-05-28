# Reparo — Operating System

> **Zweck**: Langlebige Konstitution. Was sich NICHT von Session zu Session ändert.
> Für tagesaktuelle Sprint-Lage → `SESSION_HANDOFF.md`.
> **Letzte Review:** 27.05.2026

---

## 1. Wer macht was

### Mensch
- **Lennart** (`centavo_rechts.4q@icloud.com`) — Gründer. Entscheidet Strategie & Pricing. Oft unterwegs/Urlaub. Erwartet eigenständige Arbeit, will nur bei echten Entscheidungspunkten gefragt werden.

### KI-Agenten
- **Cowork** (Claude in claude.ai) — Strategie + Code-Drafts direkt ins Repo, Supabase-MCP, Netlify-MCP, Triage von Feedback-Loops.
- **CC** (Claude Code CLI) — Commits, Pushes, lokale Bash, längere Sprints.

### Collab-Pattern
```
Cowork  →  schreibt Code in ~/Desktop/Reparo, querie DB, triage
CC      →  git add/commit/push, lange Sprints, Builds
Netlify →  auto-deploy bei push origin main (~80s)
Cowork  →  verifiziert via Supabase-MCP / Netlify-MCP
```

---

## 2. Was Reparo ist

**B2B-SaaS für Schadensmeldung + Handwerker-Vergabe in der Immobilienverwaltung.**

### 3 Rollen
- **Mieter** → meldet Schäden (Wizard + KI-Analyse + perspektivisch Voice-AI Outbound)
- **Verwalter** → 1-Klick-Vergabe (Auktion oder Direkt)
- **Handwerker** → bekommt Einladung, nimmt System-Festpreis an, schlägt Termine vor

### Kernflow
```
Mieter meldet Schaden (Wizard/Foto/KI)
  → KI prüft Vollständigkeit, ggf. Voice-AI ruft Mieter zurück
  → Ticket geht an Verwalter (vollständig)
  → Verwalter: Auction starten (Notfall/Zeitnah/Planbar) — 1 Klick
  → System: einladungen-Zeilen mit Festpreis + E-Mails an HW im Radius
  → HW: öffnet Angebot-Seite, sieht Festpreis, nimmt an
  → HW: schlägt 3 Termine vor (Doodle)
  → Mieter: wählt einen Termin
  → Auftrag läuft
```

---

## 3. Tech-Stack (fix)

```
Frontend:   Next.js 14 App Router, TypeScript, Tailwind
Backend:    Next.js API Routes auf Netlify (Serverless)
DB:         Supabase (PostgreSQL + RLS + Auth) — Projekt-ID gkojaogdzzyuboajwyom
Deploy:     Netlify (auto-deploy bei git push origin main)
Maps:       Mapbox GL JS
Email:      Resend (fire-and-forget, 17 Routes)
KI:         OpenAI GPT-4o (Foto-Prescan, Ticket-Analyse) + Anthropic
Voice AI:   Vapi + Twilio DE-Nummer (V2 = Outbound zu Mieter, vorbereitet)
Geocoding:  Google Maps API
CalSync:    Google Calendar API für HW
```

### Repo & Zugänge
```
Repo lokal:     ~/Desktop/Reparo
Prod-URL:       https://reparo-app.netlify.app
Supabase ID:    gkojaogdzzyuboajwyom
Netlify Site:   reparo-app (b71bd232-e70c-4ede-9c76-91d24d11700c)
Git-Remote:     github.com/lenn-dev-ai/craftly (main branch)
```

---

## 4. Architektur-Entscheidungen (nicht reversibel)

### 4.1 Mieter-First-Pivot (bestätigt 25.05.2026)
- **zeitslots sind tot.** Kein proaktives Slot-Anbieten mehr.
- HW bietet sich NICHT an — er reagiert auf Einladungen.
- Auktionen sind Mieter-getriggert (über Verwalter), nicht HW-getriggert.
- `zeitslots`-Tabelle bleibt für Privat-Blöcke im Kalender, sonst deprecated.
- **Mieter bleibt** — der Pivot „Mieter raus" (`KONZEPT-pivot-mieter-raus-b2b-fokus.md`) wurde mit NEIN beantwortet. Voice-AI klärt Lücken statt Mieter zu entfernen.

### 4.2 Vollkalkulations-Modell (Sprint F11)
- HW bekommt **keinen Freitext-Preis**, sondern einen System-Festpreis.
- Formel: `(basis_stundensatz ?? basis_preis ?? 50) × estimated_stunden × surge_faktor`
- Minimum: 80 €
- Estimated-Stunden: Zeitnah = 2 h, Planbar = 3 h, Notfall = 2 h
- `einladungen.empfohlener_preis` ist das einzige Preis-Feld auf der Angebot-Seite.

### 4.3 Surge & Provision
- Surge: Notfall ×1.20, Zeitnah ×1.10, Planbar ×1.00
- Verwalter zahlt Provision (5%, 0% für Early Adopters) — HW bekommt vollen Auftragswert.
- ⚠️ **Pricing-Modell selbst ist NICHT entschieden** — siehe `CRITICAL-Pricing-Konflikt-2026-05-24.md` (Option A/B/C/D offen).

### 4.4 Stamm-HW-Routing
- Wenn Verwalter Stamm-HW für dieses Gewerk hat → Direkt-Anfrage (kein Marktplatz)
- Bei Ablehnung/Ablauf → normale Auktion öffnet sich

### 4.5 Sales-Story (bestätigt 25.05.2026)
1. **Mieter meldet** (App oder Voice-AI)
2. **Reparo prüft + ruft Mieter zurück** bei Lücken
3. **Verwalter sieht fertiges Ticket** → 1-Klick-Vergabe

→ Wertversprechen: „Verwalter macht nur noch das letzte 1%."

---

## 5. Produktprinzipien

| # | Prinzip | Konsequenz |
|---|---|---|
| 1 | **Verwalter macht nur das letzte 1%** | Jede UI/Logik die mehr als 1 Klick vom Verwalter verlangt → Red Flag |
| 2 | **Mieter ist Quelle, nicht Buyer** | Mieter-UX muss reibungsfrei sein, aber Sales-Story zielt auf Verwalter |
| 3 | **HW reagiert, bietet nicht an** | Keine HW-initiierten Slots/Angebote |
| 4 | **Festpreis statt Verhandlung** | Vollkalkulations-Modell — kein Freitext-Preis-Eingabefeld auf HW-Seite |
| 5 | **B2B-Tonalität** | Sachlich, kein Mieter-„Hey-Du" auf Verwalter/HW-Pages |
| 6 | **Fire-and-Forget für E-Mails** | Kein Blocken des Request-Pfads durch Mail-Versand |
| 7 | **KI nur als Hilfsmittel** | Verwalter/HW dürfen KI-Klassifikation überschreiben |
| 8 | **Stamm-HW = Convenience, nicht Vorbedingung** | Marktplatz muss Radius-HW UND Stamm zeigen, Auctions arbeiten auf Radius |

---

## 5b. Design-System (Source of Truth: `tailwind.config.js`)

Vollständige Token-Liste & Migration-Pattern: `DESIGN-SYSTEM.md`.

### Kern-Regeln
- **Pro Karte/Zeile nur EIN primärfarbiger Badge** (Audit-Punkt 4). Status primär, Typ + Prio subtil oder versteckt (`PrioBadge prio="normal"` rendert nichts).
- **Keine Hex-Codes inline** — nur Tailwind-Tokens (`bg-accent`, `text-ink`, `border-line`). Bulk-sed-Skript für Migrationen in `DESIGN-SYSTEM.md` Abschnitt 4.
- **Opacity-Modifier (z.B. `bg-accent/20`) manuell migrieren** — Bulk-Skript erfasst sie nicht.
- **Rollen-Akzente fix**: Verwalter green, HW warm-orange, Mieter blau, Admin lila.
- **Status-Farben fix**: offen=rot, auktion=blau, bearbeitung=warm, erledigt=grün.
- **Page-Padding-Pflicht** für Hamburger-Coexistenz: `pt-16 md:pt-8` + Zurück-Button `ml-12 md:ml-0` (siehe Sprint-R Phase 15 Regression-Pattern).

---

## 6. Definition of Done

### Feature/Bugfix DoD
- [ ] Code-Änderung committed mit konventioneller Message (`fix(scope):`, `feat(scope):`, …)
- [ ] Pushed nach `origin/main`
- [ ] Netlify-Deploy grün (manuell verifizieren via Netlify-MCP wenn kritisch)
- [ ] Smoke-Test via Supabase-MCP wenn DB-relevant (Tabelle/Spalte/Constraint geprüft)
- [ ] Wenn aus Feedback-Loop entstanden: in `LOOP-ITERATION-XX-*.md` dokumentiert + `feedback.viewed = true`

### Sprint DoD
- [ ] Alle Features im Sprint-Spec implementiert
- [ ] `npm run typecheck && npm run lint && npm run build` lokal grün
- [ ] Bei DB-Migration: in Cloud-Supabase applied + Smoke-Test-Block aus `DEPLOY-CHECKLIST.md` durchlaufen
- [ ] Bei ENV-Var-Bedarf: in Netlify gesetzt (Scope BUILD + FUNCTIONS)
- [ ] Sprint-Outcome in `SESSION_HANDOFF.md` aktualisiert

### Loop DoD
- [ ] Alle offenen `feedback.viewed = false` triagiert
- [ ] Bugs in Triage-Doc kategorisiert (BUG / FEATURE / UX / WONTFIX)
- [ ] Fixes als Commits raus
- [ ] `feedback.viewed = true` gesetzt
- [ ] Loop-Counter in `SESSION_HANDOFF.md` hochgezählt

---

## 7. Regeln — was NICHT ohne explizite Freigabe

| # | Regel | Why | How to apply |
|---|---|---|---|
| R1 | Keine Änderungen an `auth.*`-RLS-Policies | Auth-Bruch = Total-Lockout; Lennart muss reviewen | Wenn Migration `auth.users`, `auth.identities` etc. anfasst → Lennart fragen |
| R2 | Migrations-Dateien nie löschen | Cloud-DB ist source of truth, fehlende Files brechen `supabase db push` | Bei Bedarf eine neue „revert"-Migration schreiben |
| R3 | `provision_settings`-Tabelle nicht ändern | Pricing-Konflikt ist offen (siehe `CRITICAL-Pricing-Konflikt-2026-05-24.md`) | Bis Lennart Option A/B/C/D wählt → readonly |
| R4 | E-Mail-Templates nicht live ohne Test | Resend hat keinen Preview-Mode; falsche Subject-Line geht an alle HW raus | Erst auf `lennjahn@gmail.com` + Demo-Accounts senden |
| R5 | Kein `git push --force` auf `main` | Cowork/CC pushen unabhängig — Force-Push überschreibt parallele Arbeit | Bei Konflikt: `git pull --rebase` + auflösen |
| R6 | Kein Outreach mit Sales-Deck bis Pricing aufgelöst | 3 widersprüchliche Modelle live (Landing/Sales-Material/FAQ) | Bis Option A/B/C/D entschieden ist → kein Cold-Outreach |
| R7 | Cron-Functions ohne `CRON_SECRET`-Check verwerfen | Sprint A FIX-1: Fallback `"netlify-scheduled"` wurde bewusst entfernt | Neue Cron-Endpoints MÜSSEN `x-cron-secret` validieren |
| R8 | Storage-Policies auf `schadens-fotos` nur strict | Sprint B FIX-8: alle public reads sind Datenleak | Migration `20260521000000_storage_fotos_strict.sql` ist source of truth |

---

## 8. Feedback-Loop-System

Reparo hat einen **automatischen Feedback-Loop**:
- User klicken Feedback-Button → `feedback`-Tabelle in Supabase
- Stündlicher Cron (Netlify Scheduled) triagiert neue Einträge
- Manueller Loop-Durchlauf:
  ```sql
  SELECT id, created_at, rolle, kontext_url, message
  FROM feedback WHERE viewed = false
  ORDER BY created_at DESC;
  ```
- Nach Triage: `UPDATE feedback SET viewed = true WHERE id = '...'`
- Jeder Loop bekommt eine `LOOP-ITERATION-XX-YYYY-MM-DD.md` Datei

---

## 9. Demo-Accounts (Passwort: `BetaReparo2026!`)

| Rolle | E-Mail |
|---|---|
| 🏠 Mieter | demo-mieter-1@reparo-demo.de |
| 🏢 Verwalter | demo-verwalter-1@reparo-demo.de |
| 🔧 HW (Sanitär/Heizung) | demo-handwerker-1@reparo-demo.de |
| 🔧 HW (Elektro) | demo-handwerker-2@reparo-demo.de |
| 🔑 Admin (Lennart) | centavo_rechts.4q@icloud.com |
| 🔑 Google-Test-HW | lennjahn@gmail.com |

---

## 10. Key Files im Repo

```
app/dashboard-mieter/melden/page.tsx           Schadensmeldungs-Wizard
app/dashboard-verwalter/marktplatz/page.tsx    Marktplatz (Tickets + HW-Pool)
app/dashboard-handwerker/angebot/[id]/page.tsx Angebot-Seite für HW
app/dashboard-handwerker/kalender/page.tsx     HW-Kalender (Google-Cal)
app/api/auction/start/route.ts                 Auktions-Start (Notfall/Zeitnah/Planbar)
app/api/verwalter/hw-im-pool/route.ts          Pool-Read (Radius-HW)
lib/auction/auction-manager.ts                 Auktions-Config + Surge
lib/pricing/commission.ts                      Provisions-Berechnung
lib/google-cal/events.ts                       Google-Cal Integration
lib/distance.ts                                Haversine + Fahrzeit
supabase/migrations/                           Alle DB-Migrationen
```

---

## 11. Vision

```
Kurzfristig:  Verwalter macht nur noch das letzte 1% — Rest ist Reparo
Mittelfristig: Voice-AI ruft Mieter automatisch zurück bei Lücken
Langfristig:  Vollautomatische Auftragsvergabe — Verwalter bestätigt nur noch
```

**B2B-Sales-Target:** Berliner Hausverwaltungen (16 identifiziert in `Reparo-Target-Liste-Berlin.md`).

---

## 12. Obsolete Docs — NICHT mehr referenzieren

Diese Konzept-Files sind durch neuere Entscheidungen überholt. Sie haben einen `[OBSOLET]`-Banner im Header. Nicht als Quelle verwenden:

| Datei | Überholt durch | Datum |
|---|---|---|
| `KONZEPT-pivot-mieter-raus-b2b-fokus.md` | `KONZEPT-CONFIRMED-2026-05-25-mieter-first.md` (Pivot abgelehnt — Mieter bleibt) | 25.05.2026 |
| `KONZEPT-ki-voice-call-schaden.md` | `KONZEPT-CONFIRMED-2026-05-25-mieter-first.md` (Voice-AI V2 = Outbound, nicht Inbound) | 25.05.2026 |

Bei Beta-Status-Snapshots wie `STATUS-BETA-LAUNCHABLE-2026-05-18.md`: historischer Anker, kein operativer Status. Aktueller Stand → `SESSION_HANDOFF.md`.

---

*OS-Stand: 27.05.2026 · Synthese aus `CONTEXT-HANDOFF.md`, `KONZEPT-CONFIRMED-2026-05-25-mieter-first.md`, `CRITICAL-Pricing-Konflikt-2026-05-24.md`, `DEPLOY-CHECKLIST.md`, `DESIGN-SYSTEM.md`*
