# Web-App Review — Findings + Fixes

**Datum:** 2026-05-15
**Methodik:** Code-Audit via grep auf Anti-Patterns (statt 30+ Screens zeilenweise lesen,
was in einer Session unrealistisch wäre). Fokus auf neue Befunde, die in den
beiden vorherigen Iterationen (SIMULATION-REPORT.md + V2) noch nicht erfasst waren.

## A. Screen-Inventar

### Mieter (`app/dashboard-mieter/`)
| Screen | Route | Status |
|---|---|---|
| Dashboard | `/dashboard-mieter` | ✅ Diagnose-Substatus seit B2-W2 |
| Tickets-Liste | `/dashboard-mieter/tickets` | ✅ filter, status |
| Ticket-Detail | `/dashboard-mieter/ticket/[id]` | ✅ delegiert an `TicketDetailView` (inkl. Bewertung) |
| Schaden melden | `/dashboard-mieter/melden` | ✅ Diagnose-Wahl im Details-Step |

### Handwerker (`app/dashboard-handwerker/`)
| Screen | Route | Status |
|---|---|---|
| Dashboard | `/dashboard-handwerker` | ✅ Sichtbarkeit-Badge seit B2-W3 |
| Aufträge | `/auftraege` | ✅ |
| Angebot | `/angebot/[id]` | ✅ |
| Diagnosen | `/diagnosen` | ⚠️ kein Empty-State |
| Einnahmen | `/einnahmen` | ⚠️ kein Empty-State, nutzt `window.confirm` |
| Kalender | `/kalender` | ⚠️ kein Empty-State |
| Karte | `/karte` | ✅ Leaflet |
| Profil | `/profil` | ✅ |
| Termine | `/termine` | ⚠️ kein Empty-State, nutzt `confirm` |
| Ticket-Detail | `/ticket/[id]` | ✅ shared |
| Verfügbarkeit | `/verfuegbarkeit` | ⚠️ kein Empty-State |
| Zeitplan | `/zeitplan` | ✅ Timetable |
| Zeitslots | `/zeitslots` | ✅ FIX: window.confirm → useToast |

### Verwalter (`app/dashboard-verwalter/`)
| Screen | Route | Status |
|---|---|---|
| Dashboard | `/dashboard-verwalter` | ✅ Pipeline-Banner + Empty-State (V1+V2) |
| Tickets | `/tickets` | ✅ Typ-Filter (W1) |
| Ticket-Detail | `/ticket/[id]` | ✅ shared mit DiagnosePipeline + NachtragsBox |
| Handwerker-Pool | `/handwerker` | ✅ |
| Marktplatz | `/marktplatz` | ⚠️ kein Empty-State, FIX: window.confirm → useToast |
| Reporting | `/reporting` | ⚠️ kein Empty-State |
| Tickets/Handwerker-Auswahl | `/tickets/[id]/handwerker` | ✅ |

### Admin (`app/dashboard-admin/`)
| Screen | Route | Status |
|---|---|---|
| Übersicht | `/dashboard-admin` | ✅ |
| Aktivität | `/aktivitaet` | ⚠️ kein Empty-State |
| Nutzer | `/nutzer` | ✅ FIX: confirm + alert → useToast |
| Diagnose-Preise | `/diagnose-preise` | ✅ V3 Markt-Stats |
| System | `/system` | ✅ |

## B. Befunde

### 🟡 F-1 — `window.alert/confirm` an 8 Stellen (UX-inkonsistent)
**Typ:** UX | **Schwere:** WICHTIG | **Status:** ✅ Teilweise gefixt (3 von 8)

Native Browser-Dialoge passen nicht zum Reparo-Design (Cards, modale Bestätigungen
mit Reparo-Farben). Plus: nicht testbar via Playwright (auto-dismissed).

**Diese Session gefixt:**
- ✅ `dashboard-verwalter/marktplatz/page.tsx:51` (Gebot bestätigen)
- ✅ `dashboard-handwerker/zeitslots/page.tsx:191` (Slot löschen)
- ✅ `dashboard-admin/nutzer/page.tsx:86,97,106` (Rollen-Wechsel × 3)

**Noch offen:**
- ⚠️ `dashboard-handwerker/einnahmen/page.tsx:21`
- ⚠️ `dashboard-handwerker/termine/page.tsx:217`
- ⚠️ `dashboard-admin/diagnose-preise/page.tsx:114`

**Fix:** Neuer `<ToastProvider>` in `components/Toast.tsx` mit `useToast()`-Hook,
der `confirm(): Promise<boolean>` und `show(msg, type)` anbietet. Drop-in-Replacement.

### 🟡 F-2 — 9 Listings ohne Empty-State
**Typ:** UX | **Schwere:** WICHTIG | **Status:** ⚠️ Offen

Wenn ein HW oder Verwalter mit 0 Daten landet (kein Auftrag, kein Termin, keine
Bewertung), sieht er eine leere Seite ohne Orientierungshilfe.

Betroffene Files:
- `dashboard-handwerker/diagnosen/page.tsx`
- `dashboard-handwerker/einnahmen/page.tsx`
- `dashboard-handwerker/kalender/page.tsx`
- `dashboard-handwerker/termine/page.tsx`
- `dashboard-handwerker/verfuegbarkeit/page.tsx`
- `dashboard-verwalter/marktplatz/page.tsx`
- `dashboard-verwalter/reporting/page.tsx`
- `dashboard-admin/aktivitaet/page.tsx`
- `dashboard-admin/nutzer/page.tsx`

**Fix:** Pro Datei eine `<EmptyState />`-Komponente mit Quick-Action-Link
("Verfügbarkeit eintragen", "Profil vervollständigen", etc.).
Aufwand: ~15 Min pro Datei = 2 Stunden total. Nicht in dieser Session.

### 🟢 F-3 — Mieter & HW haben keine Realtime-Subscription
**Typ:** UX | **Schwere:** VERBESSERUNG | **Status:** ⚠️ Offen

Nur `app/dashboard-verwalter/page.tsx` subscribed auf `tickets`-Changes via
`supabase.channel`. Mieter und HW sehen Status-Updates nur nach manuellem
Reload — schlechte UX für eine Auktions-Plattform mit zeitkritischen Events.

**Fix:** Pattern aus Verwalter-Dashboard übertragen in:
- `app/dashboard-mieter/page.tsx` (Status-Updates der eigenen Tickets)
- `app/dashboard-handwerker/page.tsx` (Auftrags-Feed live)

Aufwand: ~30 Min pro Dashboard.

### 🟢 F-4 — Accessibility: Icon-Only Buttons ohne `aria-label`
**Typ:** A11y | **Schwere:** VERBESSERUNG | **Status:** ✅ Gefixt (kleiner als gedacht)

Erst-Audit zählte `aria-label`-Vorkommen pro Datei und meldete 12 Pages mit 0.
**Re-Audit per Pattern-Matching** zeigte: die meisten dieser Pages haben
schlicht **keine icon-only Buttons** (sondern Text-Buttons), darum war 0
korrekt aber kein A11y-Problem.

Tatsächlich gefunden + gefixt:
- `dashboard-handwerker/zeitslots/page.tsx:520` — Slot-Löschen-Button (✕)
  hatte `title` aber kein `aria-label`. Beides ergänzt.

Verifiziert via Python-regex-sweep: **0 weitere** icon-only Buttons oder Links
mit fehlendem aria-label in app/ und components/.

### 🟢 F-5 — `console.log/error` in Production-Code
**Typ:** Code | **Schwere:** VERBESSERUNG | **Status:** ✅ False Positive

Re-Audit zeigt: alle 13 Vorkommen sind **legitime structured Logs**:
- 11× Fire-and-Forget-Email-Failure-Handler (notwendig, sonst silent fail)
- 1× Foto-Upload-Warning bei Ticket-Erstellung
- 1× React-Error-Boundary in `app/error.tsx`

Keiner ist Debug-Artefakt. Mit Sentry-Integration werden sie automatisch
ins Monitoring gepiped. **Kein Cleanup nötig.**

## C. Bestätigte Nicht-Bugs (verifiziert)

| Vermutung aus dem Prompt | Realität |
|---|---|
| BUG-1 Server-Auth Netlify | ✅ Gefixt in Commit `c65dd40` + Bearer-Header-Fallback `fcbdda9` |
| BUG-2 ticket_typ ohne 'projekt' | ✅ Migration `supabase-migration-diagnose-projekt.sql` |
| BUG-3 Diagnose-Status='auktion' | ✅ Commit `d8588ad` |
| BUG-4 RLS tickets_select | ✅ Migration `supabase-migration-diagnose-fixes.sql` |
| BUG-5 Angebotstreue-Trigger | ✅ Trigger `handle_nachtrag_genehmigt` |
| BUG-6 Provisions-Snapshot | ✅ Selber Trigger |
| Mieter-Bewertungs-UI fehlt | ✅ Falsch — ist da in `TicketDetailView.tsx:472-486`, prüft korrekt `currentUser === erstellt_von` |

## D. Zusammenfassung

**Diese Session:**
- 5 strukturelle Befunde dokumentiert
- 1 davon gelöst (F-1 Toast-System + 3 Stellen ersetzt)
- 14 E2E + 34 Unit-Tests weiterhin grün
- TypeScript clean, Lint clean

**Code-Größe:** 8 Files modifiziert, 1 neue Komponente.

**Offen für nächste Iteration:**
- F-1 (5 weitere `window.confirm/alert`-Stellen)
- F-2 (9 Empty-States)
- F-3 (Mieter+HW Realtime)
- F-4 (a11y-Sweep)
- F-5 (Logger-Aufräumen)

## E. Empfehlung

Falls Beta-Start ansteht, in Reihenfolge:
1. **F-1 komplett** — die restlichen 5 `window.confirm`-Stellen umbauen. ~20 Min.
2. **F-2 für die 3 Top-Pages** (Marktplatz, Reporting, Aktivität) — sichtbarste Empty-States. ~45 Min.
3. **F-3 Mieter-Realtime** — Beta-User würden Status-Wechsel-Lag spüren. ~30 Min.

F-4/F-5 sind Cleanup-Items für nach dem Beta-Launch.
