# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint R — Aufräumen + Pricing + Wording-Cleanup

> Konsolidierter Sprint aus 3-Audits-Triangulation 24.05.2026.
> Adressiert alle 🚨 CRITICAL + 🔴 HIGH-Quick-Fixes + Konvergenz-Findings.
> **Voraussetzung:** Lennart hat Pricing-Modell entschieden (Option A/B/C/D).
>
> Aufwand: ~6-8h Claude Code. Eigenständig.

## Pricing-Vereinheitlichung (Phase R1, ~1h)

⚠️ **Lennart-Input nötig:** welches Pricing-Modell? Siehe `CRITICAL-Pricing-Konflikt-2026-05-24.md`.

CC sucht und ersetzt in dieser Reihenfolge:

1. `app/hausverwaltungen/page.tsx` — Landing-Pricing-Sektion auf gewähltes Modell
2. `app/page.tsx` (Startseite) — falls FAQ-Bereich existiert, Pricing-Statement updaten
3. Footer-Pricing-Links wenn vorhanden
4. Meta-Tag „price" o.ä. für SEO

**Empfehlung-Cowork:** wenn Lennart unsicher → Option B (per Wohnung), Sales-Material ist schon konsistent damit, nur Landing muss umgebaut werden.

## Tote HW-Routen aufräumen (Phase R2, ~30 min)

CC's Finding (Audit Punkt CC1): 6 tote Routen unter `app/dashboard-handwerker/`:
- `/diagnosen`
- `/termine`
- `/zeitplan`
- `/zeitslots` (645 LOC, funktional aber unerreichbar!)
- `/auftraege`
- `/verfuegbarkeit`

**Pro Page entscheiden:**

| Route | Aktion | Begründung |
|---|---|---|
| `/zeitslots` | In Sidebar aufnehmen oder unter `/kalender` mergen | 645 LOC = wichtiger Code, nicht wegschmeißen |
| `/zeitplan` (alte TimetableView) | Droppen + Redirect auf `/kalender` | Drift, neue Version ist `/kalender` |
| `/termine` | In Sidebar aufnehmen | 589 LOC = funktional |
| `/diagnosen` | Wenn Sprint C (Diagnose-Auftrag-Merge) durch: droppen. Sonst: in Sidebar | abhängig von Sprint C |
| `/auftraege` | Droppen + Redirect auf `/dashboard-handwerker` | Dashboard hat „Meine Aufträge" schon |
| `/verfuegbarkeit` | Redirect auf `/kalender` | doppelt mit Kalender |

Commit: `chore(handwerker): tote Routen aufräumen, Sidebar konsolidiert (Sprint R Phase 2)`

## Wizard-Duplikat auflösen (Phase R3, ~2h)

CC's Finding C3: Mieter-Wizard (915 LOC) + Verwalter-Wizard (361 LOC) sind Code-Duplikate.

**Refactor:**

1. Extrahiere Shared-Logic in `components/wizard/TicketWizard.tsx`:
   - Foto-Step
   - KI-Analyse-Step (mit `variant: "mieter" | "verwalter"`)
   - Details-Step
   - Ort-Step (mit Profil-Default für Mieter)
   - Dringlichkeit + Zusammenfassung
   - Submit

2. `app/dashboard-mieter/melden/page.tsx`: nur noch `<TicketWizard variant="mieter" />` rendern
3. `app/dashboard-verwalter/neues-ticket/page.tsx`: nur noch `<TicketWizard variant="verwalter" mit Anrufer-Daten-Felder />`

**Acceptance:**
- Mieter-Wizard von 915 LOC auf <200 LOC
- Verwalter-Wizard von 361 LOC auf <100 LOC
- Beide nutzen identischen KI-Klassifikator
- Tests grün (Sprint J E2E muss durch)

Commit: `refactor(wizard): TicketWizard als shared Component (Sprint R Phase 3)`

## Mieter-Wizard Verbesserungen (Phase R4, ~1h)

Aus Konvergenz CC + ChatGPT:

1. **Foto-Hinweis prominenter:** Über dem Foto-Upload-Button stehen: „💡 Mit Foto wird die KI-Analyse deutlich genauer. Ohne Foto klassifizieren wir nur per Text-Regex."
2. **KI-Animation parallelisieren:** Statt 5 Sek Loading vor dem Submit, KI-Klassifikation parallel zum Save laufen lassen. Mieter sieht „Ticket angelegt — wir analysieren das Bild noch" → Update später.
3. **Dringlichkeits-Buttons mit Tooltip:** „Notfall = sofortige Auktion, ~15 Min bis erstes Angebot. Zeitnah = innerhalb 24h. Planbar = nächste Woche."

Commit: `feat(mieter-wizard): Foto-Hinweis + KI-Parallelisierung + Dringlichkeits-Tooltips (Sprint R Phase 4)`

## „Auktion"-Wording für Mieter ersetzen (Phase R5, ~30 min)

ChatGPT-Finding: „Auktion" wirkt für Mieter befremdlich („mein Schaden wird versteigert").

**Suche und Ersetze in Mieter-Bereich nur:**

| Alt | Neu |
|---|---|
| „Auktion läuft" | „Handwerker wird gesucht" |
| „Auktion-Ende" | „Antwort erwartet bis" |
| „Vergabe" | „Auswahl" |

**WICHTIG:** Nur im Mieter-Bereich (`app/dashboard-mieter/*`). Verwalter-Bereich behält „Auktion" weil es dort Geschäfts-Vokabular ist und richtig den Marktplatz beschreibt.

Phasen-Indikator anpassen: „Gemeldet → Handwerker wird gesucht → Reparatur → Fertig"

Commit: `feat(mieter): Wording „Auktion" → „Handwerker wird gesucht" (Sprint R Phase 5)`

## Admin-Sidebar erweitern (Phase R6, ~15 min)

CC-Finding H1: Sidebar hat 4 Items, Code hat 8 Pages. 4 unerreichbar.

In `components/layout/Sidebar.tsx` (Admin-Variante) ergänzen:
- Nutzer-Verwaltung
- Diagnose-Preise
- Aktivität
- System

Plus „Verwaltung"-Item umlabeln zu „Als Verwalter testen" (es ist semantisch ein Rollen-Switch, kein Admin-Tool).

Commit: `feat(admin): Sidebar um 4 fehlende Items erweitert (Sprint R Phase 6)`

## Verwalter-Quick-Wins (Phase R7, ~1h)

CC-Findings H4, H5:

1. **Reporting Zeitraum-Filter:** Select über der Page: Diese Woche / Dieser Monat / Dieses Quartal / Dieses Jahr / Custom
2. **Tickets-Liste Sort-Toggle:** Sort-Select: Neueste / Älteste / Höchste Prio / Niedrigste Prio
3. **Empty-State „Wartet auf deine Entscheidung":** Wenn `hatPipelineAction === false`, zeige „🎉 Alle Tickets entschieden. Lass dir mit ‚+ Neues Ticket' den nächsten anlegen."

Commits:
- `feat(verwalter-reporting): Zeitraum-Filter (Sprint R Phase 7a)`
- `feat(verwalter-tickets): Sort-Toggle (Sprint R Phase 7b)`
- `feat(verwalter-dashboard): Empty-State für leere Pipeline (Sprint R Phase 7c)`

## Landing-Page-Verbesserungen (Phase R8, ~30 min)

CC + ChatGPT-Konvergenz:

1. **CTA-Wording:** „Bereits Kunde? Anmelden" → „Schon ein Test-Account? Anmelden"
2. **Tippfehler-Fix:** „kein Kreditkartendaten" → „keine Kreditkartendaten"
3. **Pricing-Calculator verlinken:** unter Pricing-Sektion „Eigene Kosten berechnen →" Link auf `https://reparo-app.de/Reparo-Pricing-Calculator.html` (oder wo immer die HTML-Datei zugänglich ist; ggf. in `public/` deployen)
4. **„Bereits 5 Verwaltungen testen Reparo"-Trust-Indikator** unter Hero (sobald Beta läuft mit 5+ Testern — vorher leer lassen)

Commit: `feat(marketing): CTA-Polish + Pricing-Calculator-Link + Trust-Indikator (Sprint R Phase 8)`

## Code-Drift fixes (Phase R9, ~30 min)

CC-Findings M1, M3:

1. **HW-Hero-Begrüßung:** Statt `profile.gewerk` (single) → `handwerker_gewerke[].slice(0,2).map(formatGewerk).join(' · ')`
2. **Mieter-Profil-Adresse:** Wenn `wohnungen`-Tabelle einen Eintrag für diesen Mieter hat (via `mieter_id`), Adresse aus Wohnung lesen statt Freitext
3. **HW-Hero zeigt Standort-Banner UND Gewerke-Banner gleichzeitig:** Priorität: zuerst Gewerke (wichtiger), dann Standort, nicht beides parallel

Commit: `fix(drift): HW-Hero, Mieter-Profil, doppelte Banner (Sprint R Phase 9)`

## DB-Cleanup (Phase R10, ~5 min Cowork)

CC-Finding M7: 2 Profile mit `rolle = null` (`demo.hw2`, `demo.hw3`).

**Cowork macht via Supabase-MCP** (nicht CC):
```sql
UPDATE public.profiles 
SET rolle = 'handwerker' 
WHERE email IN ('demo.hw2@reparo-demo.de', 'demo.hw3@reparo-demo.de') 
  AND rolle IS NULL;
```

Oder löschen wenn nicht mehr benötigt.

## Mieter-Tickets-Duplikat auflösen (Phase R11, ~20 min)

CC-Finding M5: Mieter-Dashboard + `/tickets` zeigen beide die gleichen Cards.

**Refactor:** `/dashboard-mieter/tickets` raus, Dashboard übernimmt alle Cards. Plus „Alle Tickets anzeigen"-Button am Ende der Liste der gleichen Page.

Commit: `refactor(mieter): Dashboard + tickets-Page zusammenführen (Sprint R Phase 11)`

## Karten-Page Cleanup (Phase R12, ~10 min)

CC-Finding M2: Hero über der Karte redundant („Reparo organisiert deinen Tag" — die Karte zeigt das ja schon).

Hero raus oder durch knappes Page-Titel „Karte & Route" ersetzen.

Commit: `chore(karte): redundanten Hero raus (Sprint R Phase 12)`

## Phase R15-R22 — Bug-Fixes aus Loop Iteration 22 (25.05.)

Lennart hat 8 neue Bugs gemeldet (davon 2 Regressionen). Alle als
einzelne Phasen mit eigenem Commit.

### R15 — Hamburger-Überlagerung Regression überall (~30 min)

Feedback `f28deb26`: HW-Kalender hat Hamburger ☰ verdeckt „Zurück".
Pattern aus Sprint UX Phase 1 (Commit `bd8fac7`): Header braucht
`pl-14 pr-6 md:px-6`, Zurück-Button `ml-12 md:ml-0`.

Systematisch: alle Detail-Pages mit Hamburger + „Zurück"-Button checken
(nicht nur Kalender). E2E-Test ergänzen.

Commit: `fix(layout): Hamburger-Überlagerung Regression (Sprint R Phase 15)`

### R16 — Container-Overflow Regression Admin (~45 min)

Feedback `33ffb279`: „Ränder laufen über Bildschirm weg, wie rangezoomt."
War alter Feedback `f443670f` von 18.05., ist regressiert.

In `app/dashboard-*/layout.tsx` global ergänzen:
`<main className="min-w-0 overflow-x-hidden">`

Plus prüfen ob Tabellen `table-layout: fixed` brauchen.

Commit: `fix(layout): Container-Overflow Regression (Sprint R Phase 16)`

### R17 — Mieter-Ticket Mobile-Verschoben (~30 min)

Feedback `ae98f00a`: Mieter-Ticket-Page mobile „nach rechts verschoben".
Vermutlich Container-Issue oder absolute Positioning.

Mobile-Test 375px. Container-Klassen prüfen.

Commit: `fix(mieter-ticket): Mobile-Layout zentriert (Sprint R Phase 17)`

### R18 — Karte Mobile-Bug (~1h)

Feedback `345cee63`: Map auf Mobile, wenn angeklickt bleibt sie auf
(vermutlich Fullscreen ohne Schließen-Knopf).

Quick-Fix: X-Button oben rechts ergänzen wenn Map fullscreen.
Plus Touch-Outside-Listener.

OSM-Replacement (Mapbox/Google) ist SEPARATER Sprint (Konzept-Memo),
nicht hier.

Commit: `fix(karte): Mobile-Schließen-Button (Sprint R Phase 18)`

### R19 — KI Health Score Logic-Bug (~30 min)

Feedback `f4f19fbe`: Health-Score zeigt 30, obwohl 0 Tickets / 0 User
nach Reset.

In `lib/admin/health-score.ts` (oder wo berechnet):
```typescript
if (totalTickets === 0 && totalAngebote === 0 && totalUsers === 0) {
  return null
}
```

UI: Badge „— Keine Daten" statt magischer Zahl.

Commit: `fix(admin): Health-Score null wenn keine Daten (Sprint R Phase 19)`

### R20 — Admin-Feedback Schriften-Overlap (~20 min)

Feedback `9a528680`: CSS-Overlap in Feedback-Karten.

Vermutlich Font-Size+Line-Height-Mismatch. Quick-CSS-Fix.

Commit: `fix(admin-feedback): CSS-Overlap Karten (Sprint R Phase 20)`

### R21 — „Tickets gesamt" Empty-State (~20 min)

Feedback `0f448aae`: KPI-Kachel „Tickets gesamt" zeigt Striche statt 0.

In Admin-Dashboard-KPI-Komponente:
```tsx
value: value ?? 0  // statt: value || '—'
```

Commit: `fix(admin-dashboard): Empty-State Wert „0" statt „—" (Sprint R Phase 21)`

### R22 — Diagnose-Preise Admin-Page droppen (~15 min)

Feedback `07c7a7af`: „Brauchen wir das überhaupt noch?"
Lennart bestätigt: Diagnose-Aufträge sind raus → Admin-Page obsolet.

- Aus Admin-Sidebar entfernen
- Route droppen oder 410 Gone
- Verwandte unused Code-Pfade markieren

Commit: `chore(admin): Diagnose-Preise-Page entfernt (Sprint R Phase 22)`

### R23 — Regression-Smoke-Test als E2E-Erweiterung (~45 min)

Pflicht nach allen Refactor-Phasen.

Lennart hat 2 REGRESSIONEN in Loop 22 gemeldet (Hamburger-Überlagerung +
Container-Overflow), beide waren früher gefixt. Diese müssen jetzt
E2E-getestet sein damit sie nie wieder durchrutschen.

In `e2e/regression-pack.spec.ts` (NEU):

```typescript
test('Hamburger und Zurück-Button überlappen nie', async ({ page }) => {
  for (const url of ['/dashboard-handwerker/kalender', '/dashboard-mieter/melden', ...]) {
    await page.goto(url)
    const hamburger = page.locator('[aria-label="Menu"]')
    const zurueck = page.locator('text=Zurück').first()
    if (await zurueck.isVisible()) {
      // beide müssen sichtbar, dürfen nicht überlappen
      const hb = await hamburger.boundingBox()
      const zb = await zurueck.boundingBox()
      expect(hb.x + hb.width).toBeLessThan(zb.x)
    }
  }
})

test('Mobile-Container nie über Viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  for (const url of ['/dashboard-admin/nutzer', '/dashboard-mieter/ticket/[id]', ...]) {
    await page.goto(url)
    const body = await page.evaluate(() => document.body.scrollWidth)
    expect(body).toBeLessThanOrEqual(375)
  }
})

test('Admin-KPIs zeigen 0 statt — bei leeren Daten', async ({ page }) => {
  await page.goto('/dashboard-admin')
  const kpiTickets = page.locator('[data-testid="kpi-tickets-gesamt"]')
  await expect(kpiTickets).not.toContainText('—')
})
```

Plus weitere Quick-Checks für die anderen Bug-Patterns aus Loop 22.

Commit: `test(e2e): Regression-Pack gegen Loop-22-Bugs (Sprint R Phase 23)`

### R24 — Sales-Story-Update für Mieter-First (~30 min)

Konzept-Bestätigung `c636f2bf` von Lennart (25.05.): „auf jeden fall
setzt nicht die HV das ticket ab."

Landing-Page `/hausverwaltungen` 3-Step-Sektion umschreiben:

**Alt:**
1. Verwalter trägt ein (Mieter ruft an, Sie tippen 30 Sekunden)
2. Reparo macht den Marktplatz
3. Sie vergeben mit 1 Klick

**Neu:**
1. **Mieter meldet selbst** (App-Wizard oder KI-Voice-Anruf)
2. **Reparo prüft + ruft Mieter zurück** bei Lücken
3. **Verwalter vergibt mit 1 Klick** — Sie machen nur noch das letzte 1%

Plus Headline-Update wenn nötig: „Verwalter macht nur noch das letzte 1%."

Konsistenz-Check: Sales-Deck Slide 4 + One-Pager 3-Step machen Cowork
nach (nicht CC).

Commit: `feat(marketing): 3-Step-Story auf Mieter-First (Sprint R Phase 24)`

## Smoke-Test + Final-Commit (Phase R13, ~30 min)

Lokaler Test:
1. Mieter-Flow: Wizard durchklicken → Status „Handwerker wird gesucht" sichtbar
2. Verwalter-Flow: Neues-Ticket-Wizard → Auktion → Marktplatz
3. HW-Flow: Hero zeigt mehrere Gewerke wenn gesetzt
4. Admin-Flow: alle 4 neuen Sidebar-Items klickbar
5. Landing: Pricing konsistent mit Sales-Material

Final-Commit: `chore(sprint-r): Aufräumen + Pricing + Wording — alle Phasen durch`

## Reporting in BETA-FEEDBACK.md

Nach Sprint R: „Iteration 19 — Sprint R Konsolidierung" mit:
- Commit-Hashes pro Phase
- Welches Pricing-Modell live ist
- Welche Routen gedroppt wurden
- LOC-Reduktion durch Wizard-Refactor

## Constraints

- Pricing-Engine NICHT anfassen (war immer rote Linie)
- Stripe/Banking-Code NICHT anfassen
- Visuell darf nichts schlechter aussehen
- Tests dürfen nicht failen (Sprint J Playwright muss grün bleiben)
- Pro Phase ein eigener Commit (granular für Rollback)
- Bei Phase 1 (Pricing): WARTE auf Lennart-Antwort. Nicht raten.

## Erfolg

- 3 Pricing-Quellen konsistent
- 6 tote HW-Routen aufgeräumt
- Wizard-LOC halbiert (1276 → ~300)
- Mieter sieht keine „Auktion" mehr
- Admin-Sidebar vollständig
- Verwalter-Reporting filterbar
- Build/TypeScript/Lint clean

## Erster Schritt

**Phase R1 = WARTET auf Lennart-Pricing-Entscheidung.**
Wenn Lennart nicht innerhalb von 24h antwortet:
- Cowork-Empfehlung folgen (Option B — per Wohnung) und Sprint starten
- In BETA-FEEDBACK.md transparent dokumentieren dass das eine implizite Annahme war

Dann mit Phase R2 (tote Routen) anfangen — die ist Pricing-unabhängig.
