# Web-App Review — Findings + Fixes

**Datum:** 2026-05-15 (V2)
**Methodik:** Tieferer Audit nach UX-F-Items.
Schwerpunkt diesmal: Bekannte Bugs verifizieren, alle Layouts/Sidebars
gegen Mobile prüfen, Orphan-Routen aufdecken, Build/Tests grün halten.

---

## A. Verifizierung der 6 bekannten Bugs aus Audit-V1

| # | Befund | Fix | Status |
|---|---|---|---|
| 1 | Server-Auth Netlify | Middleware `matcher` enthält `/api/*` + Token-Refresh | ✅ verifiziert in `middleware.ts:55-60` |
| 2 | `ticket_typ` CHECK ohne 'projekt' | `ALTER TABLE` in `supabase-migration-diagnose-fixes.sql:23-26` | ✅ |
| 3 | Diagnose-Status='auktion' | Diagnose-Pipeline schreibt direkt `status='auktion'` | ✅ |
| 4 | RLS `tickets_select` ohne `zugewiesener_hw` | Policy in `supabase-migration-diagnose-fixes.sql:35-45` | ✅ |
| 5 | Angebotstreue-Trigger bei Nachtrag | `handle_nachtrag_genehmigt()` Zeile 110-124 | ✅ |
| 6 | Provisions-Snapshot bei Nachtrag | gleicher Trigger Zeile 95-108 | ✅ |

**Alle 6 Bugs bereits gefixt** in vorherigen Iterationen — keine
Regressionen identifiziert.

---

## B. Neue Findings (V2)

### 🔴 BV-1 — Admin-Layout hatte keine Mobile-Sidebar (Layout-Killer)
**Typ:** Mobile-Responsiveness | **Schwere:** KRITISCH | **Status:** ✅ Gefixt

`app/dashboard-admin/layout.tsx` rendert `<aside class="w-56">` **immer**,
ohne `md:hidden`-Switch oder Hamburger. Auf Mobile blieb die 224 px breite
Sidebar permanent stehen → Hauptinhalt nur noch ~150 px breit, unbenutzbar.

Die anderen drei Rollen (Mieter/HW/Verwalter) nutzen `components/layout/Sidebar.tsx`,
das längst eine Mobile-Drawer + Hamburger-Pattern hat. Admin war Sonderfall
(eigenes Layout für `RollenWechsel` + `ActiveRoleProvider` + Admin-Header).

**Fix:** Sidebar-Inhalt in `sidebarContent` extrahiert, Mobile-Hamburger
(`md:hidden fixed top-4 left-4 z-50`) + Slide-In-Drawer + Backdrop ergänzt,
Auto-Close bei `pathname`-Wechsel via `useEffect`. Pattern 1:1 vom
gemeinsamen Sidebar übernommen.

### 🟠 BV-2 — Orphan-Route `/dashboard-handwerker/verfuegbarkeit` (Daten-Konflikt)
**Typ:** UX/Daten-Integrität | **Schwere:** WICHTIG | **Status:** ✅ Gefixt

Es existierten **zwei** Verfügbarkeits-UIs, beide schreiben in
`verfuegbarkeiten`-Tabelle:
- `/dashboard-handwerker/kalender/page.tsx` — Slot-Picker (Morgens/
  Nachmittags/Abends pro Wochentag) → im Sidebar als "Verfügbarkeit" verlinkt
- `/dashboard-handwerker/verfuegbarkeit/page.tsx` — granulare Stunden-Picker,
  **nirgendwo verlinkt** (orphan)

Risiko: HW landet via alten Bookmark in /verfuegbarkeit, ändert dort, aber
das aktuelle Sidebar-UI zeigt dann ggf. inkonsistente Slots → Score-Algo
(verfuegbarkeit_score) bekommt überraschende Inputs.

**Fix:** `/verfuegbarkeit/page.tsx` durch Server-Redirect zu `/kalender`
ersetzt (`next/navigation` `redirect()`). Alte Bookmarks landen dort
weiterhin, aber im aktuellen UI.

### 🟠 BV-3 — 5 Pages ohne `pt-16` für Mobile-Hamburger-Overlap
**Typ:** Mobile-Responsiveness | **Schwere:** WICHTIG | **Status:** ✅ Gefixt

Der Mobile-Hamburger ist `fixed top-4 left-4 w-10 h-10` → reserviert die
oberen 56 px. Pages, die nur `p-6` (= 24 px Top-Padding) haben, ließen
den Hamburger über dem Page-Header schweben → H1 nicht klickbar im Bereich.

Alle anderen Dashboards haben bereits `pt-16 md:pt-8`. Diese 5 fehlten:
- `app/dashboard-mieter/page.tsx` (loading + content)
- `app/dashboard-mieter/tickets/page.tsx` (loading + content)
- `app/dashboard-handwerker/diagnosen/page.tsx` (loading + content)
- `app/dashboard-verwalter/tickets/page.tsx`
- `app/dashboard-verwalter/handwerker/page.tsx` (loading + content)

**Fix:** Pro Page `className="p-6 ... pt-16 md:pt-6"` ergänzt.

### 🟢 BV-4 — Audit-V1-"offene" F-Items waren teilweise schon erledigt
**Typ:** Doku-Drift | **Schwere:** INFO

Ein Re-Audit der V1-Findings zeigte:
- **F-1** (8 `window.confirm`-Stellen): alle 8 nutzen längst `useToast().confirm()`
  (Commit 4b6ae0c hat das vollständig erledigt). V1-Report listete fälschlich
  noch "5 offen".
- **F-2** (9 Listings ohne Empty-State): die 6 angeblich offenen Pages
  haben tatsächlich Empty-States:
  - `diagnosen/page.tsx:138` — Stethoscope-Icon-EmptyState
  - `marktplatz/page.tsx:168` — "Keine Slots gefunden"
  - `einnahmen/page.tsx`, `termine/page.tsx`, `verfuegbarkeit/page.tsx` —
    Empty-Branches in JSX vorhanden
  - `kalender/page.tsx` — kein klassisches Listing (Toggle-Grid),
    Zero-State ist visuell durch rote Earnings-Box
- **F-3** (Mieter+HW Realtime): bereits in Commit 7aee1b0 implementiert.
- **F-4** + **F-5**: bereits in Commit 91c361f abgeschlossen.

**Effektiv neu in V2:** BV-1 + BV-2 + BV-3 (oben).

---

## C. Mobile-Responsiveness — Sweep-Ergebnisse

| Bereich | Status |
|---|---|
| Sidebar Mobile-Drawer | ✅ Mieter/HW/Verwalter ok, Admin gefixt (BV-1) |
| Page-Padding gegen Hamburger-Overlap | ✅ alle Pages pt-16 md:pt-6 (BV-3 fix) |
| Tabellen `overflow-x-auto` | ✅ stichprobenartig OK (Marktplatz, HW-Pool) |
| Touch-Targets ≥ 36 px | ✅ Buttons ≥ py-1.5 + px-3, Hamburger 40×40 |
| Texte abgeschnitten | ✅ `truncate` bei Ticket-Titeln, `flex-wrap` bei Filtern |

**Keine weiteren Mobile-Bugs identifiziert.**

---

## D. Code-Review pro Rolle

### Mieter
- Dashboard ✅ (Pipeline, Diagnose-Substatus, Realtime aktiv)
- Tickets-Liste ✅ (EmptyState, korrektes Routing)
- Schaden melden ✅
- Ticket-Detail ✅ (über shared `TicketDetailView`)

### Handwerker
- Dashboard ✅ (Sichtbarkeits-Badge, Auktionen, Realtime)
- Aufträge / Diagnosen / Karte / Kalender / Termine / Zeitslots /
  Einnahmen / Profil — alle Routen erreichbar, Zwillings-Page
  `/verfuegbarkeit` jetzt Redirect (BV-2)

### Verwalter
- Dashboard ✅ (Pipeline-Banner, Empty-State)
- Tickets/Marktplatz/Reporting/Handwerker — alle ok
- Ticket-Detail ✅ (DiagnosePipeline + NachtragsBox)

### Admin
- Übersicht / Nutzer / Aktivität / Diagnose-Preise / System ✅
- Layout jetzt Mobile-tauglich (BV-1 fix)
- RollenWechsel + ActiveRoleProvider weiterhin aktiv

---

## E. Test- & Build-Status

| Check | Ergebnis |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run lint` | ✅ no warnings or errors |
| `npm run build` | ✅ alle 30 Routes prerendered |
| `npm run test:auction` (Unit) | ✅ 34/34 |
| `npm run test:e2e` (Playwright) | ✅ 14/14 |

Alle Tests laufen unverändert grün — keine Regression durch BV-1/2/3.

---

## F. Offene Punkte / Empfehlungen

**Nichts blockierend.** Beobachtungen für nächste Iteration:

1. **Sidebar-Konsistenz:** Admin nutzt eigenes Layout statt `Sidebar.tsx`.
   Cleanup-Idee — `Sidebar.tsx` um Admin-Items erweitern und das Admin-
   Layout drauf ziehen. Aktuell duplizierte Struktur, aber funktional gleich.
2. **Sidebar-Label Mismatch (HW):** Menüitem heißt "Verfügbarkeit", Route
   ist `/kalender`. Sprachlich konsistent (das UI ist die Verfügbarkeit),
   aber Route-Name irreführend für Devs. Nicht User-sichtbar — kosmetisch.
3. **`tsconfig.tsbuildinfo`** ist 337 KB groß und committed. Sollte in
   `.gitignore`. Nicht kritisch.

---

## G. Diff-Zusammenfassung dieser Session

**4 Files modifiziert:**
- `app/dashboard-admin/layout.tsx` — Mobile-Drawer + Hamburger
- `app/dashboard-handwerker/verfuegbarkeit/page.tsx` — Redirect zu `/kalender`
- `app/dashboard-mieter/page.tsx`, `.../tickets/page.tsx`,
  `app/dashboard-verwalter/tickets/page.tsx`, `.../handwerker/page.tsx`,
  `app/dashboard-handwerker/diagnosen/page.tsx` — `pt-16 md:pt-6`

**Zeilen-Diff:** ~80 Zeilen (überwiegend +Mobile-Hamburger im Admin-Layout,
+Redirect-Page, +pt-16 Klassen).

**Risiko:** Niedrig. Keine Logik-Änderungen, nur Layout + Routing-Redirect.
Tests grün.
