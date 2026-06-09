# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# CC-Master-Block FINAL — 25.05.2026

> Ersetzt alle vorherigen CC-Blöcke. Wenn du das hier pastest, ist alles drin.
> Konsolidiert: Hotfix + Aufräumen + Audit-Findings + Konzept-Bestätigungen +
> Loop-22-Bugs + Regression-Pack.

## Paste-Block für Claude Code

```
Sprint-Queue 25.05.2026 — alles in dieser Reihenfolge.

Du arbeitest weiterhin autonom — Lennart ist im Urlaub. Bei Fragen:
selbst entscheiden + in BETA-FEEDBACK.md dokumentieren.

═══════════════════════════════════════════════════════
HINTERGRUND seit letztem Block
═══════════════════════════════════════════════════════

1. DATEN-RESET: alle Tickets/Angebote/Zeitslots/Einladungen sind 0.
   6 alte Test/Demo-User gelöscht. 9 NEUE Demo-Accounts angelegt:
   - demo-mieter-1/2/3@reparo-demo.de
   - demo-verwalter-1/2/3@reparo-demo.de
   - demo-handwerker-1/2/3@reparo-demo.de
   - alle Passwort: BetaReparo2026!
   Lennart's 4 Accounts unangetastet. Feedback-Tabelle behalten.

2. MIETER-FIRST-KONZEPT BESTÄTIGT (KONZEPT-CONFIRMED-2026-05-25-mieter-first.md):
   - Mieter ist immer der Eingeber
   - Voice-AI ruft Mieter zurück bei Lücken
   - HV macht NUR Vergabe, NICHT Eingabe
   - → Sprint G UI verstecken (Sprint AD)

3. LOOP 22 (25.05.): 8 neue Bug-Feedbacks von Lennart, davon 2 Regressionen
   (Hamburger-Überlagerung + Container-Overflow). Diese sind in Sprint R
   Phase R15-R22 + R23 (Regression-E2E-Pack) abgebildet.

═══════════════════════════════════════════════════════
SPRINT-REIHENFOLGE
═══════════════════════════════════════════════════════

1. SPRINT AA — HOTFIX Vergabe-Regression (HIGH, ZUERST!)
   PROMPTS/sprint-aa-hotfix-vergabe-regression.md
   Falls Bug nicht mehr reproduzierbar nach Reset: lege als
   demo-verwalter-1 ein neues Ticket an, dann versuche zu vergeben.

2. SPRINT R — Aufräumen + Wording + Bug-Fixes (24 Phasen!)
   PROMPTS/sprint-r-aufraeumen-pricing-wording.md
   
   WICHTIG Phase R1 (Pricing-Vereinheitlichung) ÜBERSPRINGEN —
   Lennart hat noch nicht zwischen Option A/B/C/D entschieden
   (CRITICAL-Pricing-Konflikt-2026-05-24.md).
   
   Arbeite Phasen R2-R24:
   - R2: Tote HW-Routen (6 Stück: /diagnosen, /termine, /zeitplan,
          /zeitslots, /auftraege, /verfuegbarkeit)
   - R3: Wizard-Duplikat auflösen (Mieter 915 LOC + Verwalter 361 LOC
          → shared TicketWizard)
   - R4: Mieter-Wizard Verbesserungen
   - R5: "Auktion" → "Handwerker wird gesucht" (Mieter-Bereich!)
   - R6: Admin-Sidebar 4 fehlende Items
   - R7: Verwalter-Quick-Wins (Reporting-Filter, Tickets-Sort, Empty-State)
   - R8: Landing CTA-Polish + Calculator-Link + Tippfehler
   - R9: Code-Drift-Fixes (HW-Hero handwerker_gewerke[], Mieter-Profil)
   - R10: ÜBERSPRINGEN (Cowork macht via Supabase-MCP)
   - R11: Mieter-Tickets-Duplikat auflösen
   - R12: Karten-Page-Hero raus
   - R13: Smoke-Test + Final-Commit
   - R14: Smoke-Test alle Phasen
   - R15: Hamburger-Überlagerung Regression (alle Pages mit Hamburger
          + Zurück-Button checken!)
   - R16: Container-Overflow Regression (Admin-Pages, Mobile)
   - R17: Mieter-Ticket Mobile-Layout
   - R18: Karte Mobile X-Button (OSM bleibt, Mapbox-Migration ist
          SEPARATER Konzept-Sprint — KEINE Mapbox-Lib einbauen!)
   - R19: KI Health Score null wenn keine Daten
   - R20: Admin-Feedback Schriften-Overlap
   - R21: KPI-Empty-State "0" statt "—"
   - R22: Diagnose-Preise Admin-Page droppen
   - R23: Regression-E2E-Pack (verhindert dass Bugs wieder auftauchen)
   - R24: Sales-Story-Update Landing (3-Step auf Mieter-First)

3. SPRINT AD — Sprint G UI verstecken (~30 min)
   PROMPTS/sprint-ad-sprint-g-ui-verstecken.md
   Mieter-First-Konzept ist bestätigt. HV soll nicht mehr eingeben.

4. SPRINT AB — Verwalter-Bereich beruhigen (Enterprise-Look)
   PROMPTS/sprint-ab-verwalter-bereich-beruhigen.md
   Designer-Audit: Verwalter-Design-Fit 5.5/10. Tabellen statt Cards.

5. SPRINT AC — Bronze/Silber/Gold → Partner-Stufen
   PROMPTS/sprint-ac-partner-stufen-rebrand.md
   3-zu-1-Audit-Konsens: aktuelle Gamification wirkt unseriös.

6. SPRINT M EXTENSION — State-System + Karten-Reduktion (Phase M6+M7)
   PROMPTS/sprint-m-ui-konsistenz.md
   Designer-Audit: kein echtes Design-System.

═══════════════════════════════════════════════════════
NICHT BAUEN (warten auf Lennart-Setup oder -Entscheidung)
═══════════════════════════════════════════════════════

- VOICE-AI V2 (Outbound zu Mieter): Spec liegt in SPEC-voice-ai-v2.md
  bereit. Wartet auf Vapi-Account-Anlage durch Lennart. NICHT
  proaktiv bauen, auch nicht "vorbereitendes Refactoring".

- MAPBOX-MIGRATION: Konzept-Memo in KONZEPT-map-upgrade-mapbox.md.
  Wartet auf Lennart-Bestätigung. Bei Sprint R Phase R18 NUR
  X-Button-Quick-Fix in OSM, KEINE Mapbox-Lib einbauen.

- GOOGLE-CAL-SYNC: Konzept-Memo in KONZEPT-google-calendar-sync-hw.md.
  Wartet auf Lennart-Bestätigung.

- ADMIN-MISSION-CONTROL: Konzept-Memo in KONZEPT-admin-mission-control.md.
  Wartet auf Beta-Daten.

═══════════════════════════════════════════════════════
GLOBALE CONSTRAINTS
═══════════════════════════════════════════════════════

- Eigenständig durcharbeiten
- Schema-Migrationen idempotent (IF NOT EXISTS), via Supabase-MCP
  versuchen, sonst File ins Repo
- Pricing-Engine NICHT anfassen
- Stripe/Banking-Code NICHT anfassen
- Marketing-Landing Visual-Stil NICHT verändern (außer R8 Polish + R24
  3-Step-Story-Update)
- Sprint K (B2B-Landing) Visual-Stil bleibt — bewusst "SaaS cool"
- Visuell darf NICHTS schlechter aussehen (Beta-Tester wären verwirrt)
- Bestehende E2E-Tests (Sprint J) müssen grün bleiben
- Pro Phase ein eigener Commit (granular für Rollback)
- Bei Blockern: in BETA-FEEDBACK.md als "CC-BLOCKER Sprint [X]"
  dokumentieren, Sprint überspringen, mit nächstem fortfahren

═══════════════════════════════════════════════════════
TEST-ACCOUNTS für Smoke-Tests
═══════════════════════════════════════════════════════

Bei Test-Bedarf nutze die neuen demo-* Accounts:
- demo-mieter-1@reparo-demo.de (Demo Mieter 1)
- demo-verwalter-1@reparo-demo.de (Demo Verwalter 1)
- demo-handwerker-1@reparo-demo.de (Demo Handwerker 1)
- alle Passwort: BetaReparo2026!

Falls du Demo-Tickets für Tests brauchst: lege via demo-mieter-1 ein
neues Ticket an. Sprint-J E2E-Tests die auf alte test.* Accounts
verweisen müssen entsprechend umgestellt werden (gehört in Sprint R23).

═══════════════════════════════════════════════════════
REPORTING in BETA-FEEDBACK.md
═══════════════════════════════════════════════════════

Pro Sprint eine Iteration:
- "Iteration 21 — Sprint AA Hotfix" (mit Root-Cause)
- "Iteration 22 — Sprint R Phasen R2-R24" (mit LOC-Reduktion durch
  Wizard-Refactor)
- "Iteration 23 — Sprint AD Mieter-First-UI"
- "Iteration 24 — Sprint AB Verwalter-Beruhigung"
- "Iteration 25 — Sprint AC Partner-Stufen"
- "Iteration 26 — Sprint M Extension"

═══════════════════════════════════════════════════════
ERFOLGS-DEFINITION
═══════════════════════════════════════════════════════

Nach allen Sprints:
- Vergabe funktioniert wieder (AA)
- 6 tote HW-Routen aufgeräumt (R2)
- Wizard-Code halbiert (R3)
- "Auktion" nur noch im Verwalter-Bereich (R5)
- 8 Loop-22-Bugs gefixt (R15-R22)
- Regression-E2E-Pack verhindert Re-Auftauchen (R23)
- Landing-3-Step-Story auf Mieter-First (R24)
- Sprint G UI versteckt (AD)
- Verwalter-Dashboard wirkt wie Linear/Notion, nicht wie Stripe (AB)
- Bronze/Silber/Gold raus, Partner-Stufen drin (AC)
- State-Component-Library im Repo + Karten reduziert (M Ext)
- Build/TypeScript/Lint clean
- Sprint J E2E-Tests grün
- R23-Regression-Pack 100% pass

Starte mit Sprint AA (Hotfix). Wenn Vergabe wieder funktioniert: Sprint R
Phase R2.
```

## Was IM CC-BLOCK NICHT ist (bewusst — Lennart-Aufgaben)

- Pricing-Entscheidung (entsperrt R1)
- Vapi-Account-Anlage (entsperrt Voice-AI V2)
- Mapbox-Account (entsperrt Map-Upgrade)
- Google-Cal-Konzept-Bestätigung (entsperrt Sprint AE)
- BETA-WELCOME.pdf-Update auf 9 Logins (Cowork-Aufgabe, nicht CC)
- Sales-Material-Update (Cowork-Aufgabe, nicht CC)
- Beta-Tester-Einladungen
