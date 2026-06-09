# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Urlaubs-Status — täglicher Reparo-Check für Lennart

> Diese Datei wird täglich von Cowork aktualisiert.
> Lennart kann sie jederzeit kurz öffnen um zu sehen: was läuft, was ist neu, gibt's Blocker.

**Letzte Aktualisierung:** 2026-05-26 morgen (Iteration 27 — alles live nach 4 Build-Fixes, commit a0696e6)

## ✅ Iteration 26/27 — ALLES LIVE (26.05.2026, früh morgens)

**Netlify-Deploy `a0696e6` ist Published.** Nach 8 Failed-Builds (4
Build-Bugs hintereinander rausgefixt) ist alle MVP-Arbeit aus
Iterationen 23-25 jetzt für User sichtbar.

### Live in der App ist:

- `/dashboard-admin` → Mission Control (Live-Status + Action-Items + 24h-Aktivität + System-Health) statt alter KI-Cards/Charts
- `/dashboard-handwerker/karte` → Mapbox Vector-Tiles statt Leaflet/OSM
- `/dashboard-mieter/melden` → dynamische Pills (saisonal + Verwalter-Stats) + Foto-Prescan-Highlight (Pill leuchtet auf nach Foto-Upload)
- `/dashboard-handwerker/profil` → echter „Mit Google verbinden"-Button (statt „Demnächst")
- `/dashboard-mieter/melden-neu` + `/dashboard-verwalter/neues-ticket-neu` → Test-Routes für refaktorierten Shared TicketWizard
- Pricing R1 Option B in 3 Quellen synchron
- 5 in-place Hotfixes (Status-Werte, transpilePackages, Button-Import-Case, AddressAutocomplete-Props, Set-Spread, KarteView-Naming-Konflikt)

### DB-seitig (alle additive, kein Breaking-Change):

- ticket_audit_log + get_ticket_audit_log RPC (Sprint T)
- admin_action_items view + count_users_online + admin_activity_24h RPCs (Sprint AH)
- 4 neue Status-Werte + ticket_reklamationen (Sprint U)
- stamm_handwerker + stamm_anfragen + RLS (Sprint V)
- eigentuemer + wohnungen.eigentuemer_id + reporting_config + reports_archive (Sprint W)
- hw_google_oauth (Sprint AE)
- rls_initplan-Helper-Functions + 3 profiles-Policies (Backlog)

### Phase 2 (Schemas leben, UI fehlt — bewusst zurückgehalten):

- Sprint U Status-Logik im Code (4 neue Werte sind erlaubt, aber kein Pfad nutzt sie aktiv)
- Sprint U Mieter-Reklamations-Button
- Sprint V Verwalter-UI für Stamm-HW-Verwaltung + Aufruf von routeNewTicket() aus auction/start
- Sprint W Eigentümer-Anlegen-UI + PDF-Engine + Quartals-Cron
- Sprint T Audit-Trail-Tab im Ticket-Detail + mehr Event-Logger (aktuell nur auktion_geschlossen)
- Sprint AI Wizard auf /melden swappen (Lennart hatte „nicht swappen" gesagt)

### Wartet auf Lennart-Action:

- Sprint AE Live-Aktivierung: 15 Min Google-Cloud-Console-OAuth-Setup (Anleitung in PROMPTS/google-oauth-setup-anleitung.md)
- Twilio-Identity (für Voice-AI V2)
- HIBP-Toggle (braucht Supabase-Pro)
- Resend-Domain (Domain noch nicht registriert)
- Impressum-ENVs
- Netlify-Credit-Banner ist nur Warnung (Auto-Recharge läuft)

## 🌌 NEU heute Nacht (Iteration 25 — 4 weitere Sprints, alle MVP-Schemas LIVE)

CC hat die 3 Vorgänger committet + gepushed:
- `b1e15e5` Sprint AG Mapbox
- `94f0f03` Sprint AF Phase 1 Pills
- `85079a2` Sprint AH Mission Control

Cowork hat danach **6 weitere Supabase-Migrationen** via MCP applied:
1. `sprint_ah_admin_action_items_fix_status_values` (Bug-Fix: 'auktion' statt 'auktion_offen')
2. `sprint_t_mvp_audit_trail` (ticket_audit_log + RLS + get_ticket_audit_log RPC)
3. `sprint_u_mvp_status_erweiterung` (additive 4 neue Status + ticket_reklamationen Tabelle)
4. `sprint_v_mvp_stamm_handwerker` (stamm_handwerker + stamm_anfragen + RLS)
5. `sprint_w_mvp_eigentuemer_schema` (eigentuemer + wohnungen.eigentuemer_id + reporting_config + reports_archive)
6. `sprint_ae_hw_google_oauth` (hw_google_oauth Tabelle für Calendar-Tokens)

Und **9 Code-Files** geschrieben (warten auf CC-Commit, Anleitung in `PROMPTS/cc-master-block-2-2026-05-25-spaeter-abend.md`):
- Sprint T: `lib/audit/logTicketEvent.ts` + Integration in `auction/close`
- Sprint AE: `lib/google-cal/oauth.ts` + 3 Routes (connect/callback/disconnect)
- Sprint AF Phase 2: `app/api/ki/foto-prescan/route.ts`
- Sprint AI: `components/wizard/TicketWizard.tsx` + 2 Parallel-Routes (`/melden-neu`, `/neues-ticket-neu`)

**Status pro Sprint:**

| Sprint | DB | Code | Commit | Beta-Ready |
|---|---|---|---|---|
| R1 Pricing | — | ✅ | ✅ | ✅ |
| AG Mapbox | — | ✅ | ✅ | ✅ |
| AF Phase 1 Pills | — | ✅ | ✅ | ✅ |
| AF Phase 2 Prescan | — | ✅ Disk | ⏳ CC | ✅ |
| AH Mission Control | ✅ + Hotfix | ✅ | ✅+⏳ | ✅ |
| T MVP Audit-Trail | ✅ | ✅ Disk | ⏳ CC | ✅ |
| U MVP Status+Reklamation | ✅ | — | — | additive, kein Code-Break |
| V MVP Stamm-HW | ✅ + Helper | ✅ Disk | ⏳ CC | Routing-Integration in Phase 2 |
| W MVP Eigentümer | ✅ | — | — | PDF in Phase 2 |
| AE Google-Cal | ✅ + Routes | ✅ Disk | ⏳ CC | wartet auf OAuth-Setup von Lennart |
| AI Wizard | — | ✅ Disk | ⏳ CC | Parallel-Routes, Original unangetastet |

CC's nächster Run: Master-Block lesen → 5 Commits + Push → Smoke-Tests.

## 🚀 NEU heute Nacht (Iteration 24 — 3 Sprints von Cowork-Code live geschrieben)

**DB-Migration applied (via Supabase-MCP):**
- `sprint_ah_admin_mission_control` — RPC `count_users_online_last_5min`, view `admin_action_items`, RPC `admin_get_action_items`, RPC `admin_activity_24h`

**Code auf Disk geschrieben, wartet auf Commit/Push** (Sandbox-Git war
durch stale `.git/index.lock` blockiert):

- **Sprint AG (Mapbox):** `package.json` umgehängt (leaflet → mapbox-gl + react-map-gl), `components/handwerker/KarteView.tsx` komplett auf react-map-gl
- **Sprint AF Phase 1 (KI-Pills):** neuer Endpoint `app/api/melden/pills/route.ts` mit Saison-Logic + Verwalter-Stats; `app/dashboard-mieter/melden/page.tsx` zieht Pills jetzt dynamisch (Fallback auf statische 5)
- **Sprint AH (Mission Control):** 4 neue Endpoints (`/api/admin/live`, `/action-items`, `/activity`, `/health`) + neue Page `/dashboard-admin/mission-control`. Alte `/dashboard-admin` bleibt unangetastet → A/B-Vergleich möglich.

**Was du tun musst:** Terminal öffnen, `cd ~/Desktop/Reparo`, dann den Bash-Block aus `PROMPTS/cc-commit-ag-af-ah-2026-05-25-abend.md` ausführen — entfernt die stale Lock-Datei, commitet die 3 Sprints einzeln, pusht. Netlify baut automatisch.

## 🆕 NEU heute Abend (Iteration 23 — 10 Items autonom umgesetzt)

> Lennart-Autorisierung: „1, 2, 3, 5, 6(optimieren), 7, 8, 10, 11, 12, 13
> kannst du doch umsetzen und wenn du entscheidungen brauchst frag mich halt"

**9 neue Sprint-Specs geschrieben** (alle in `PROMPTS/`):

1. **Sprint R1** (`sprint-r1-pricing-vereinheitlichung.md`) — Pricing Option B
   (per Wohnung: 1,29 € / 0,89 € / Custom) für Landing + Startseite + lib/pricing.ts
2. **Sprint AE** (`sprint-ae-google-calendar-sync-hw.md`) — OAuth + free/busy + write-back
3. **Sprint AG** (`sprint-ag-mapbox-migration.md`) — Leaflet/OSM → Mapbox via react-map-gl
4. **Sprint AF** (`sprint-af-ki-schnellauswahl-smarter.md`) — Dynamische Pills + Foto-Prescan + KI-Round-Trip
5. **Sprint AH** (`sprint-ah-admin-mission-control.md`) — Admin-Dashboard-Redesign
6. **Sprint AI** (`sprint-ai-wizard-refactor.md`) — Mieter+Verwalter-Wizard zu shared Component (Sprint R3 nachgeholt)
7. **Sprint T** (`sprint-t-b2b-trust-package.md`) — Audit-Trail + Freigabegrenzen + RBAC (MVP 3-5 Tage)
8. **Sprint U** (`sprint-u-verwalter-statuslogik.md`) — 4 → 11 Status-Werte + Reklamations-Flow
9. **Sprint V** (`sprint-v-stamm-hw-marktplatz-hybrid.md`) — Stamm-HW pro Wohnung/Gewerk
10. **Sprint W** (`sprint-w-eigentuemer-reporting.md`) — Quartals-PDFs für WEG-Verwaltung

**1 Step-by-Step Anleitung geschrieben:**
- `PROMPTS/google-oauth-setup-anleitung.md` — Google-Cloud-Console-Setup für Lennart (15 Min)

**1 Migration sicher applied:**
- `rls_initplan_helpers_and_profiles` via Supabase-MCP: 3 Helper-Functions
  (`is_admin/is_handwerker/is_verwalter`) + 3 profiles-Policies auf `(SELECT auth.uid())`
- Rest (47 weitere Policies in 17 Tables + 43 unused indexes) als Lennart-Review-Aufgabe
  dokumentiert: `PROMPTS/lennart-review-rls-rest-und-unused-indexes.md`

## ⏳ Warten auf Lennart-Aktion (post-Urlaub)

- Pricing R1 deployen (CC schreibt Code, dann commit/push)
- Sprint AE: Google-Cloud-Console OAuth-Setup (15 Min, Anleitung liegt bereit)
- Sprint AG: Mapbox-Token ist schon in Netlify — nur noch Code-Migration starten
- Sprint T/U/V/W: brauchen Beta-Daten vor Implementation (Cowork-Empfehlung: Sprint X (Notfall-Flow) zuerst, das ist klein und Sales-Wert hoch)
- Twilio-Identity (post-Urlaub, Voice-AI V2 ist post-Beta)
- Resend-Domain (Domain existiert noch nicht — DNS-Setup nötig)
- HIBP-Toggle (braucht Supabase-Pro-Plan)

## ⚠️ NEU heute morgen (Loop-Run + 4. Audit)

1. **🚨 BUG-Regression** (`a441a93c`): Vergabe schlägt wieder fehl — gleich wie `f4d86912` 18.05. → Sprint AA Hotfix-Spec (`PROMPTS/sprint-aa-hotfix-vergabe-regression.md`)
2. **🧭 STRATEGISCHES KONZEPT-UPDATE** (`c636f2bf`): „auf jeden fall setzt nicht die HV das ticket ab" — Mieter ist immer der Eingeber, Voice-AI ruft Mieter zurück für Klärung. Sprint G + Voice-AI-Spec überholt! Doku in `KONZEPT-mieter-first-workflow-voice-ai-dreht-sich.md`. **Wartet auf deine Bestätigung.**
3. **🎨 4. AUDIT (Senior UX Designer)** verarbeitet. Quad-Konvergenz: „Nicht mehr Features, Reduktion + Enterprise-Ruhe". **Verwalter-Design-Fit nur 5.5/10** = größtes UX-Problem. Neue Specs:
   - Sprint M erweitert um Design-System + Karten-Reduktion (Phase M6+M7)
   - **Sprint AB** (`PROMPTS/sprint-ab-verwalter-bereich-beruhigen.md`) — Enterprise-Look statt Startup
   - **Sprint AC** (`PROMPTS/sprint-ac-partner-stufen-rebrand.md`) — Bronze/Silber/Gold → Partner-Stufen
   - Triangulations-Doc von 3 auf 4 Audits erweitert

4. **✅ MIETER-FIRST-KONZEPT BESTÄTIGT** (`KONZEPT-CONFIRMED-2026-05-25-mieter-first.md`) — KI-Anrufe für Schadens-Steuerung sind die Roadmap. Sprint G obsolet, Voice-AI V2 (Outbound zu Mieter) ist der Fokus. Pivot-Konzept überholt.

5. **🔄 DATEN-RESET DURCHGEFÜHRT** (`DEMO-ACCOUNTS-2026-05-25.md`):
   - 24 Tickets / 16 Angebote / 62 Zeitslots / 5 Einladungen → 0
   - 6 Test/Demo-User gelöscht
   - **9 neue Demo-Accounts** (Demo-Mieter-1/2/3, Demo-Verwalter-1/2/3, Demo-Handwerker-1/2/3) mit Standard-Passwort `BetaReparo2026!`
   - Lennart's 4 eigene Accounts (3 Admin + lennjahn Verwalter) unangetastet

6. **🔄 LOOP ITERATION 22** — 15 Feedbacks triagiert (`LOOP-ITERATION-22-2026-05-25.md`):
   - 8 BUGS (davon 2 Regressionen) → Sprint R erweitert um Phasen R15-R22
   - 1 Sprint-R-Bestätigung (Diagnose-Preise-Page raus)
   - 3 strategische Konzept-Memos:
     - `KONZEPT-google-calendar-sync-hw.md` (Adoption-Blocker für HW)
     - `KONZEPT-map-upgrade-mapbox.md` (OSM → Mapbox)
     - `KONZEPT-admin-mission-control.md` (Designer-Audit-Bestätigung)
   - 2 Feedbacks schon erledigt durch Reset
   - **2 REGRESSIONEN** zeigen: Quality-Gate fehlt nach großen Sprints

7. **🎉 EXTERNE SERVICES TEILWEISE LIVE** (25.05.):
   - **Vapi**: Account angelegt, Outbound-Agent „Lead Follow-up Agent (DE)" erstellt (Assistant ID `1abe7829-...`), API-Key in Netlify (`VAPI_API_KEY` Secret + `VAPI_ASSISTANT_ID`)
   - **Mapbox**: Public Token in Netlify (`NEXT_PUBLIC_MAPBOX_TOKEN`) → Karten-Upgrade-Sprint sofort baubar
   - **Twilio**: Account angelegt, aber Identity-Verification + Tax-ID + Credit-Card noch ausstehend → kann nach Urlaub gemacht werden (NICHT Beta-blockierend, Voice-AI V2 ist post-Beta-Feature)
   - **5 Migrationen via Supabase-MCP nachgezogen** (Vergabe-Bug endgültig gefixt + 13 Indexe + Funktions-Security + Cleanup + Sprint G aktiviert)



---

## TL;DR Status (heute)

🟢 **Production:** stabil, alle 9 Sprints (C/D/E/L/M/N/O/P/Q1/Q2) live
🟢 **CC Tag 4+5:** Polish-Block komplett, 7 Code-Commits + Docs, Build/TypeScript/Lint clean
🟢 **Cowork:** 16 Tasks geliefert, Sprint-L Migration nachgezogen
🟢 **A11Y-AUDIT.md + STYLE-AUDIT.md:** beide von CC im Repo
🟡 **Blocker:** keine kritischen. Vapi-Account-Anlage wartet auf Lennart (nicht zeitkritisch)
⚠️ **Audit-Drift:** xlsx-CVE (Prototype Pollution, GHSA-4r6h-8v6p-xvw6) ist über Sprint I reingekommen. Mitigation: xlsx-Parsing läuft client-side, API nimmt nur geprüftes JSON-Array. Lennart hatte das via "Sprint I Greenlight" implizit akzeptiert. Bei Bedarf nach Urlaub: alternative CSV-only-Variante prüfen.
⚪ **Beta:** bewusst NICHT gestartet (Urlaub)

## Audit-Validation (von zwei externen Audits 22.+23.05.2026)

**6 Stärken die als Sales-Argumente verstärkt werden sollten** (Quelle: Audit-2):

1. **HW-Karte mit Notfall/Zeitnah/Planbar-Filter + Routenplanung** — wirkt wie professionelle Logistik-App, Demo-WOW-Effekt
2. **Dashboard-Kacheln + farbige Labels** — schnelle Erfassung wichtiger KPIs, mental gut
3. **Mehrstufiger Mieter-Wizard mit KI-Auswertung** — wirkt durchdacht, nicht hingeklatscht
4. **Smart-Scores + Sichtbarkeitsstufen (Bronze/Silber/Gold)** für HW — Gamification-Mechanik die Marktplatz lebendig macht
5. **Einkommens-Dashboard mit Yield-Management** für HW — transparent + handlungsorientiert, kein „Black Box"
6. **Filter + Suche in Nutzerlisten + Feedback-Karten** — Admin-Tools fühlen sich nicht halbgar an

Diese Punkte gehören in Sales-Demos prominent gezeigt (Demo-Skript-Update sinnvoll nach Beta-Start).

---

## CC-Sprint-Tracker

| Sprint | Subject | Commit | Status |
|---|---|---|---|
| F | Mieter-Profil + Location-per-Klick | `b1c9b6e` | ✅ Tag 1 |
| Test-Refactor | E2E + Live-Sim auf /api/auftraege/* | `517e039` | ✅ Tag 1 |
| G | Verwalter-Wizard | `09b5f8a` | ✅ Tag 2 |
| H | KPI-Karten + Throughput-Chart | `455ff82` | ✅ Tag 2 |
| J | Playwright E2E (3 Flows) | `d175a70` | ✅ Tag 2 |
| Side-Quest | Security-Definer Fix handwerker_bewertungen | im Branch | ✅ Tag 2 |
| I | Bulk-Wohnungs-Import | `2cd80f2` | ✅ Tag 3 (Migration applied by Cowork) |
| K | Landing-B2B-Polish (`/hausverwaltungen`) | `482c5f2` | ✅ Tag 3 (SSR, 97 KB First-Load) |
| Docs | Iteration 16 in BETA-FEEDBACK.md | `c0fba5a` | ✅ Tag 3 |
| **Voice-AI Backend** | Webhook + HMAC + Twilio + Migration | `55b0898` + `474558d` | ✅ Tag 3 BONUS (CC vorgegriffen, Migration von Cowork nachgezogen) |
| C | Diagnose+Auftrag-Merge | — | ⏸ in Queue (Tag 4) |
| D | Wording+RLS-Cleanup | — | ⏸ in Queue (Tag 4) |
| E | Mieter-Vorgang-Card inline | — | ⏸ in Queue (Tag 4) |
| L | HW-Gewerk aus Profil-Stamm | live | ✅ Tag 4 (Migration `20260605000080_sprint_l_handwerker_gewerke.sql` von Cowork applied, 1/2 HW per Backfill) |
| C/D/E | Diagnose-Merge + Wording-Cleanup + Mieter-Card | live | ✅ Tag 4 |
| M | UI-Konsistenz + Design-Tokens + STYLE-AUDIT.md | live | ✅ Tag 5 |
| N | Empty-States + Success-Toasts + Tooltips | live | ✅ Tag 5 (alle 7 Phasen) |
| O | Rollen-Switcher Dropdown (A11y konform) | live | ✅ Tag 5 |
| P | WCAG 2.1 AA + Mobile + A11Y-AUDIT.md | live | ✅ Tag 5 |
| Q1+Q2 | Filter-Persistence (URL-Params) + Stufenweise Dashboards (Accordion) | live | ✅ Tag 5 |

---

## Was seit gestern passiert ist

### Cowork-Outputs (Vacation-Plan)
- ✅ MASTER-VACATION-PLAN-2026-05-22.md
- ✅ 3 Sprint-Specs für Verwalter-Hardening (G/H/I)
- ✅ Voice-AI Spec V1 (detailliert)
- ✅ Sprint-J E2E-Playwright-Spec
- ✅ Sales-Deck (PPTX, 12 Slides, Reparo-Branded)
- ✅ One-Pager (PDF, A4)
- ✅ Pricing-Calculator (HTML, interaktiv)
- ✅ Sales-Playbook (E-Mails + Demo-Skript + Objections)

### CC-Outputs (live deployed)
- ✅ Sprint F: Mieter-Profil + Wohnungs-Pflege (`b1c9b6e`)
- ✅ E2E-Test-Refactor: neue `/api/auftraege/*`-Pfade (`517e039`)

### Netlify
- ✅ `RESEND_API_KEY` als Secret-ENV gesetzt
- ✅ 2 Deploys grün, durchschnittlich ~1m 16s Build-Zeit
- ⚠️ Credit-Limit-Warning angezeigt (Top-Up ist erfolgt, aber Banner bleibt)

### Supabase
- ✅ Keine neuen Migrationen heute
- ✅ Alle Tabellen RLS-aktiv, Defense-in-Depth-Policies live

---

## Was als nächstes ansteht

### Diese Woche (Mai 22–28)
| Aufgabe | Owner | Status |
|---|---|---|
| Sprint G (Verwalter-Wizard) | CC | Spec ready, pasten |
| Sprint H (Verwalter-KPIs) | CC | Spec ready, pasten |
| Sprint I (Bulk-Import) | CC | Spec ready, pasten |
| Sprint J (E2E Playwright) | CC | Spec ready, CC arbeitet bereits dran |
| Landing-Page B2B-Refresh | Cowork | Pending Lennart-OK |

### Nächste Woche (Mai 29 – Juni 4)
| Aufgabe | Owner | Status |
|---|---|---|
| Voice-AI PoC (sobald Vapi-Account) | CC | Spec ready, wartet auf Lennart |
| Sprint C/D/E (Diagnose-Merge etc.) | CC | Specs existieren, pasten |
| Cold-Outreach-Vorbereitung | Lennart | Sales-Playbook abarbeiten |

---

## Was Lennart erledigen sollte (wenn er kurz Zeit hat)

Nicht zeitkritisch, aber blockiert sonst Weiter-Arbeit:

- [ ] **Vapi-Account anlegen** (5 Min, vapi.ai → Stripe-Card hinzufügen)
- [ ] **Twilio-Account anlegen** + DE-Nummer kaufen (~10 € Setup, 5 €/Mon)
- [ ] **Echte E-Mail-Adresse einrichten** (z.B. lennart@reparo-app.de via Resend-Domain)
- [ ] **Resend-Domain verifizieren** (sobald Domain existiert)
- [ ] **Demo-Daten polishen** (3-5 Vorzeige-Tickets mit Demo-Angeboten)

Wenn alles davon erledigt: Cowork kann den Voice-AI-PoC ohne weitere Lennart-Eingaben durchziehen.

---

## Production-Health-Check

| Metric | Status |
|---|---|
| Letzter Deploy | `517e039` ✅ |
| Test-Logins funktional | ✅ test.mieter / test.verwalter / test.handwerker |
| Auto-Feedback-Loop | ✅ stündlich, schreibt ins Admin-Dashboard |
| Auto-Loop letzter Run | siehe `/dashboard-admin/feedback` |
| Letzter SQL-Error im Log | keine |

---

## Wenn etwas Schlimmes passiert (Eskalation)

### Production ist down
1. Netlify-Deploys-Page öffnen: https://app.netlify.com/projects/reparo-app/deploys
2. Rollback auf letzten grünen Deploy via „Lock to stop auto publishing"
3. Cowork in Chat informieren: „Production down, Rollback auf [Commit]"

### CC pusht broken Code
1. `git log` checken — letzter problematischer Commit
2. `git revert <commit>` lokal + push
3. Cowork-Chat: „CC hat falsch gepusht, Revert ist drauf"

### Supabase-Connectivity-Issue
1. https://status.supabase.com checken
2. Reparo-Projekt in https://supabase.com/dashboard/project/gkojaogdzzyuboajwyom prüfen
3. Cowork-Chat: „Supabase-Issue, hier der Status-Link"

---

## Verfügbare Tools für Cowork während du weg bist

Cowork kann autonom:
- ✅ Sprint-Specs schreiben (war bisher schon so)
- ✅ Sales/Marketing-Material erstellen (PPTX, PDF, HTML)
- ✅ Supabase-Migrations anwenden (eigenständig per Lennart-Mandat)
- ✅ Netlify-ENVs setzen
- ✅ Production-Status via Netlify+Chrome prüfen
- ✅ CC's Commits beobachten + verifizieren
- ✅ Bug-Reports + Iteration-Specs schreiben

Cowork kann NICHT (braucht Lennart):
- ❌ Accounts erstellen (Vapi, Twilio, Domain-Registrar)
- ❌ Passwörter eingeben
- ❌ Zahlungen durchführen
- ❌ Beta-Tester einladen / Sales-Mails verschicken
- ❌ Rechtliche Entscheidungen (Pivot, Pricing-Änderung, Domain-Wahl)

---

## Cowork-Empfehlung für die Urlaubs-Zeit

**Soft-Tasks die ich autonom durchziehen würde, wenn du nicht antwortest:**
- Sprint-G/H/I/J an CC weitergeben (sobald CC frei ist)
- QA-Loops nach jedem CC-Commit
- Bug-Triage wenn Auto-Feedback was findet
- Iteration auf Sales-Material wenn ich neue Insights habe

**Tasks die ich AUF EIS lege bis du Yes/No sagst:**
- Pivot-Entscheidung (auch nach Urlaub)
- Pricing-Änderung
- Größere Architektur-Refactors
- Public-Communication (LinkedIn-Posts, Twitter)

---

## Letzter Stand der Beta-Vorbereitung

**Beta-Tester-Liste:** noch leer (du wolltest sie selbst zusammenstellen)
**BETA-WELCOME.pdf:** ✅ existiert, 4 Seiten, branded
**Demo-Accounts:** ✅ 3 Stück (Mieter/Verwalter/HW) bereit, Passwort `BetaReparo2026!`
**Auto-Feedback-Loop:** ✅ läuft stündlich, schreibt ins Admin-Dashboard

**Wenn du nach Urlaub Beta starten willst:**
1. Beta-Tester-Liste schreiben (5-10 Vertraute)
2. BETA-WELCOME.pdf + Demo-Logins per Mail rausschicken
3. Cowork startet Auto-Loop-Reporting-Cadence (täglich)
4. Wir machen Sprint-Reviews basierend auf Feedback

---

**Schönen Urlaub.** Wenn du Cowork brauchst: einfach kurz hier reinschreiben, ich antworte sofort.
