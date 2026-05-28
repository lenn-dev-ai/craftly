# Loop Iteration 22 — Triage 15 Feedbacks (25.05.2026)

> Lennart hat zwischen 08:26 und 09:33 insgesamt 15 Feedbacks abgegeben,
> alle als admin-Rolle. Davon wurden 2 (a441a93c + c636f2bf) bereits in
> Iteration 20/21 behandelt. 13 sind neu.

## Kategorisierung

### ✅ Bereits erledigt (3)

| ID | Issue | Status |
|---|---|---|
| `a441a93c` | Vergabe-Bug | Sprint AA Hotfix-Spec geschrieben, wartet auf CC |
| `c636f2bf` | Mieter-First-Konzept | Bestätigt + KONZEPT-CONFIRMED-Doc |
| `09fd6f49` + `3f7e5be8` | „Alle Nutzer löschen" + „Demo-Accounts neu" | Daten-Reset durchgeführt, 9 demo-* Accounts angelegt |

### 🔴 BUGS — 8 Stück, alle für Sprint R Erweiterung (Phase R15-R22)

| # | ID | URL | Bug | Severity |
|---|---|---|---|---|
| 1 | `ae98f00a` | mieter/ticket | Mobile-Modus „nach rechts verschoben" | HIGH |
| 2 | `f28deb26` | hw/kalender | **REGRESSION**: Hamburger ☰ verdeckt „Zurück" | HIGH |
| 3 | `345cee63` | hw/zeitslots | Map auf Mobile bei Click bleibt offen + OSM veraltet | HIGH |
| 4 | `f4f19fbe` | admin | KI Health Score zeigt 30, obwohl 0 Daten — Logic-Bug | MEDIUM |
| 5 | `33ffb279` | admin/nutzer | **REGRESSION**: Container-Overflow „wie rangezoomt" | HIGH |
| 6 | `9a528680` | admin/feedback | Schriften überlappen | MEDIUM |
| 7 | `0f448aae` | admin | „Tickets gesamt" zeigt Striche statt 0 (Empty-State-Bug) | MEDIUM |
| 8 | `9337c802` | hw/zeitslots | „Warum noch zeitslots, Terminliste, Diagnosen?" — **bestätigt CC-Befund** | MEDIUM |

**2 REGRESSIONEN!** Beide waren früher gefixt:
- Hamburger-Überlagerung: war Sprint UX Phase 1 (Commit `bd8fac7`) — gefixt für Mieter-Wizard. Tritt jetzt im HW-Kalender wieder auf.
- Container-Overflow: war Feedback `f443670f` von 18.05. — gefixt? Tritt jetzt im Admin-Nutzer wieder auf.

→ **Quality-Gate nach Sprint M/N/O/P/Q hätte das fangen müssen.** Lesson: nach jedem großen Sprint manueller Regression-Test der Top-5-Häufig-Bugs.

### 🟡 Sprint-R-bestätigt (1)

| ID | Issue | Status |
|---|---|---|
| `07c7a7af` | Diagnose-Preise-Admin-Page noch da | Bestätigt: Sprint R muss die droppen (Diagnose-Aufträge sind raus) |

### 🟠 STRATEGISCHE KONZEPT-FRAGEN (3)

| ID | Issue | Bedeutung |
|---|---|---|
| `b1ad8083` | „HW-Kalender muss über Google sync" | Manuelle Kalender-Pflege ist Show-Stopper für HW-Adoption |
| `345cee63` | „Map sieht veraltet aus, brauchen state-of-the-art" | OSM ist B2B-untauglich, brauchen Mapbox oder Google Maps |
| `9ab7382d` | „Admin-Dashboard zeigt tote Accounts, will Live-Nutzung verstehen" | Designer-Audit-Bestätigung: Admin = Analytics-Playground, sollte Mission-Control sein |

## Sprint R Erweiterung — R15 bis R22 (Bug-Phasen)

Diese Phasen werden zum bestehenden Sprint R hinzugefügt:

### R15 — Hamburger-Regression überall fixen (~30 min)

Pattern aus Sprint UX Phase 1: Header braucht `pl-14 pr-6 md:px-6`, Zurück-Button `ml-12 md:ml-0`.

**Betroffene Pages (mind.):**
- `app/dashboard-handwerker/kalender/page.tsx` (bekannt)
- Systematisch: alle Detail-Pages mit Hamburger UND „Zurück"-Button checken
- E2E-Test ergänzen: auf jeder Page Hamburger UND Zurück sichtbar

Commit: `fix(layout): Hamburger-Überlagerung Regression (Sprint R Phase 15)`

### R16 — Container-Overflow Regression (~45 min)

Feedback f443670f von 18.05. ist regressiert. Container max-width / overflow-x hidden.

**Betroffene Pages:**
- `app/dashboard-admin/nutzer/page.tsx` (bekannt)
- Wahrscheinlich auch andere Admin-Pages

Globaler Layout-Fix in `app/dashboard-*/layout.tsx`: `<main className="min-w-0 overflow-x-hidden">`

Commit: `fix(layout): Container-Overflow Regression (Sprint R Phase 16)`

### R17 — Mieter-Ticket Mobile-Verschoben (~30 min)

Vermutlich auch Container/Padding-Issue. Mobile-Test 375px.

Commit: `fix(mieter-ticket): Mobile-Layout zentriert (Sprint R Phase 17)`

### R18 — Map mobile Bug (~1h)

Wenn Map auf Mobile angeklickt wird, bleibt sie offen. Vermutlich Fullscreen-Modus ohne Schließen-Button.

Quick-Fix: X-Button oben rechts ergänzen wenn Map fullscreen.

Plus: OSM-Replacement als Konzept-Sprint (siehe Memo unten) — NICHT in Sprint R, das ist zu groß.

Commit: `fix(karte): Mobile-Schließen-Button (Sprint R Phase 18)`

### R19 — KI Health Score Logic (~30 min)

Wenn 0 Tickets / 0 Angebote / 0 User: Score sollte „N/A" oder „—" anzeigen, nicht magisch „30".

In `lib/admin/health-score.ts` (oder wo das berechnet wird):
```typescript
if (totalTickets === 0 && totalAngebote === 0) return null;
```

UI: Badge „— Keine Daten" statt Zahl.

Commit: `fix(admin): Health-Score null wenn keine Daten (Sprint R Phase 19)`

### R20 — Admin-Feedback Schriften-Overlap (~20 min)

CSS-Fix, vermutlich Font-Size+Line-Height-Mismatch in Feedback-Karten.

Commit: `fix(admin-feedback): CSS-Overlap Karten (Sprint R Phase 20)`

### R21 — „Tickets gesamt" Empty-State (~20 min)

KPI-Kachel zeigt „—" statt „0" wenn keine Daten. Sollte „0" zeigen.

Wahrscheinlich `value || '—'` statt `value ?? '0'`.

Commit: `fix(admin-dashboard): Empty-State Wert „0" statt „—" (Sprint R Phase 21)`

### R22 — Diagnose-Preise Admin-Page droppen (~15 min)

Lennart bestätigt: Diagnose-Aufträge sind raus → Admin-Page obsolete.

Aus Admin-Sidebar entfernen, Route auf 410 Gone setzen.

Commit: `chore(admin): Diagnose-Preise-Page entfernt (Sprint R Phase 22)`

## 3 Konzept-Memos für nach Urlaub

### Konzept-Memo 1: Google-Kalender-Sync für HW

**Datei:** `KONZEPT-google-calendar-sync-hw.md`

Aktuelle Situation: HW pflegt seine Verfügbarkeit manuell in Reparo. Lennart sagt: „extrem manuell, so bekommen wir die Handwerker nicht."

Optionen:
- **A — Google Calendar Sync (OAuth)**: HW autorisiert Reparo, sein Cal zu lesen. Free-Slots = Reparo-Verfügbarkeit.
- **B — iCal/CalDAV-Sync**: universeller (Apple, Outlook), aber komplexer.
- **C — Manuelle Eingabe + AI-Vorschläge** aus dem aktuellen Auftrag-Pattern.

**Cowork-Empfehlung:** **A** — Google ist Marktstandard, OAuth-Flow ist bekannt, MVP in 2-3 Tagen baubar.

**Aufwand:** ~2-3 Tage CC nach Konzept-Klärung.

### Konzept-Memo 2: Map-Library-Upgrade (OSM → Mapbox/Google)

**Datei:** `KONZEPT-map-upgrade.md`

Lennart sagt: „völlig veraltete aus, das können wir nicht nutzen, da muss was modernes state of the art hin."

OSM ist gut für Hobbyisten, schwach für B2B-UX. Optionen:
- **Mapbox**: schöner, viele Templates, ~50€/Mon für 50K Loads. **Empfohlen.**
- **Google Maps**: vertrauter Look, ~7$/1000 Loads. Teurer langfristig.
- **Leaflet + besseres Tile-Set**: kostengünstig, aber Layout bleibt OSM-artig.

**Cowork-Empfehlung:** Mapbox — Cold-Outreach-tauglich, gute Free-Tier-Margen für Beta.

**Aufwand:** ~1 Tag CC.

### Konzept-Memo 3: Admin-Dashboard Redesign — Mission Control

**Datei:** `KONZEPT-admin-mission-control.md`

Lennart: „Was ziehe ich da raus? ... will live Nutzung verstehen."
Designer-Audit (24.05.): „Mission Control statt Analytics Playground."

**Konzept:**
- **Live-Metriken:** Wie viele User online JETZT, Tickets in den letzten 60 Min, aktive Auktionen
- **Operative Alerts:** Was steht still? Was eskaliert? Was braucht Admin-Eingriff?
- **Weniger:** statische Charts, Health-Bars, Aktivität-Trends
- **Mehr:** Live-Updates (Server-Sent Events oder Polling), Action-CTAs

**Aufwand:** ~2-3 Tage CC. Designer-Sketch wäre Plus.

## URLAUBS-STATUS-Update

(Wird parallel gemacht — Iteration 22 oben angefügt mit den 8 neuen Sprint-R-Phasen + 3 Konzept-Memos.)

## CC-Update-Block

Nachtrag zu vorherigem CC-Block: Sprint R hat jetzt 22 Phasen (R1-R22) statt 13.

CC sollte nach R14 weitermachen mit:
- R15-R22 (8 neue Bug-Phasen)

Reihenfolge bleibt: AA → R (alle Phasen) → AD → AB → AC → M Extension.

## Reporting in BETA-FEEDBACK.md

Eintrag: „Iteration 22 — 13 neue Feedbacks (8 Bugs darunter 2 Regressionen, 3 Konzept, 2 schon erledigt)".

## Lessons Learned

1. **Quality-Gates fehlen:** Nach jedem großen Sprint sollte ein 5-Min-Smoke-Test der häufigsten Bug-Patterns laufen. CC kann das automatisieren (Sprint J E2E erweitern).
2. **Live-Reset war erfolgreich:** Lennart hat 2× das gleiche gefordert (`09fd6f49` + `3f7e5be8`), Cowork hat zwischendurch genau das gemacht. Konvergenz Lennart-Wunsch ↔ Cowork-Action.
3. **Designer-Audit war prophetisch:** „Admin = Analytics Playground" — Lennart sieht genau das jetzt selbst und will Live-Daten.
4. **OSM/Google-Cal sind echte Adoption-Blocker:** HW würde Reparo nicht nutzen wenn er manuell Cal pflegen muss + die Map nicht überzeugt. Diese 2 Konzepte sollten vor Cold-Outreach geklärt werden.
