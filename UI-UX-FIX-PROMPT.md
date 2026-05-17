# Reparo — UI/UX-Fixes aus externem Audit (Mai 2026)

> **Quelle:** Externer UI/UX-Audit (manuell + Screenshot-Analyse) der Prod-App  
> **Ziel:** Mobile-Bugs, Overlay-Fehler, Overflow-Issues und UX-Inkonsistenzen fixen.  
> **Vorgehen:** 2 Sprints. Nach jedem Sprint: `npm run build && npm run typecheck && npm run lint`

---

## Kontext & Stack

- Next.js 14.2 App Router + Supabase + Tailwind CSS + TypeScript
- Mobile-first Ansatz: alle Fixes müssen bei 390px funktionieren
- Sidebar-Komponente: `components/layout/Sidebar.tsx`
- BottomNav: `components/layout/BottomNav.tsx`
- Ticket-Views: `components/ticket/TicketDetailView.tsx`
- UI-Komponenten: `components/ui/index.tsx`
- Dashboard-Layouts: `app/dashboard-*/layout.tsx`

---

## Was bereits erledigt ist (NICHT nochmal anfassen)

- ✅ Alle Fixes aus AUDIT-FIX-PROMPT.md, BRAINDUMP-FIX-PROMPT.md, LIVE-TEST-FIX-PROMPT.md
- ✅ Mieter 5-Step-Flow funktioniert
- ✅ Auktion/Vergabe-Pipeline funktioniert
- ✅ KI-Analyse funktioniert
- ✅ Kalender-Grundfunktion (Tagesansicht klickbar)
- ✅ Dringlichkeit-Enum vereinheitlicht (planbar/zeitnah/notfall)
- ✅ Error-Handling bei Supabase-Mutations
- ✅ E2E 15/15, Pen-Tests 14/14 grün

---

## SPRINT 1 — Kritische Mobile-Bugs & Overlay-Fixes (1-2h)

### UX-1: Drawer/Sidebar Overlay blockiert Klicks

**Schweregrad:** HOCH — Buttons wie "Annehmen" nicht anklickbar

**Datei:** `components/layout/Sidebar.tsx`

**Problem:** Wenn der Drawer geschlossen wird, bleibt das Backdrop-Overlay (`fixed inset-0 bg-ink/30 z-40`) manchmal aktiv und fängt alle Klick-Events ab. Das macht Buttons auf der darunter liegenden Seite unbedienbar.

**Fix:**
1. Sicherstellen, dass das Backdrop-Div nur gerendert wird wenn `isOpen === true`
2. Beim Schließen `pointer-events: none` setzen ODER das Element komplett aus dem DOM entfernen
3. Transition-End-Event nutzen statt nur CSS-Opacity

```tsx
// SCHLECHT (aktuell vermutlich):
<div className={`fixed inset-0 bg-ink/30 z-40 ${isOpen ? 'opacity-100' : 'opacity-0'}`} />

// GUT:
{isOpen && (
  <div 
    className="fixed inset-0 bg-ink/30 z-40 backdrop-blur-sm"
    onClick={() => setIsOpen(false)}
  />
)}
```

**Verifikation:**
```bash
grep -n "inset-0\|z-40\|z-50\|backdrop\|pointer-events" components/layout/Sidebar.tsx
# Erwartung: Backdrop nur bei isOpen gerendert, pointer-events korrekt
```

### UX-2: Drawer-Breite auf Mobile begrenzen

**Datei:** `components/layout/Sidebar.tsx`

**Problem:** Der Drawer nimmt bis zu 90% des Screens ein. Auf 390px bleibt kaum Platz zum Schließen.

**Fix:**
1. Drawer-Breite auf `max-w-[280px]` oder `w-4/5` begrenzen
2. Rechts mindestens 60px Platz lassen zum Tap-to-Close

**Verifikation:**
```bash
grep -n "w-\[.*\]\|max-w\|w-full\|w-64\|w-72\|w-80" components/layout/Sidebar.tsx
```

### UX-3: Chat-Modul Scroll & Eingabefeld

**Datei:** `components/ticket/TicketDetailView.tsx` (Chat-Bereich ca. Zeile 810+)

**Problem:** 
- Kein Auto-Scroll zu neuen Nachrichten
- Eingabefeld klebt am oberen Rand oder wird abgeschnitten
- "Senden"-Button manchmal nicht klickbar

**Fix:**
1. `chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })` nach jeder neuen Nachricht
2. Chat-Container: `flex flex-col` mit `justify-end` damit Nachrichten unten starten
3. Eingabefeld: `sticky bottom-0` mit `z-10` und eigenem Background
4. Mindesthöhe für den Chat-Container: `min-h-[200px]`

**Verifikation:**
```bash
grep -n "chatRef\|scrollTo\|scrollHeight\|sticky.*bottom\|overflow-y-auto" components/ticket/TicketDetailView.tsx | head -10
```

### UX-4: Kalender-Overlay "ist komplett frei" Text

**Datei:** `app/dashboard-handwerker/kalender/page.tsx` oder `zeitplan/page.tsx`

**Problem:** Der Hinweis "Fr. 15.05. ist komplett frei" überlappt das Kalender-Grid und verdeckt Zeitslots.

**Fix:**
1. Den Hinweis AUS dem Grid nehmen und ÜBER dem Grid platzieren (als eigene Row oder Banner)
2. `position: absolute` durch normalen Flex-Flow ersetzen
3. Oder als dezenten Toast-Hinweis anzeigen statt inline

**Verifikation:**
```bash
grep -rn "komplett frei\|ist.*frei\|absolute.*frei\|grid.*frei" app/dashboard-handwerker/ --include="*.tsx" | head -5
```

### UX-5: Overflow bei langen Texten

**Dateien:** `components/ticket/TicketDetailView.tsx`, diverse Dashboard-Pages

**Problem:** Freitext-Felder (Schadensbeschreibung, Kommentare) laufen über und überlagern das Layout.

**Fix:**
1. Alle Freitext-Anzeigefelder: `break-words whitespace-pre-wrap` (teilweise schon da)
2. Alle Text-Container: `overflow-hidden` oder `overflow-x-hidden`
3. Status-Chips in Ticket-Karten: `flex-wrap gap-1` damit sie umbrechen statt rauszulaufen
4. Lange Titel: `line-clamp-2` oder `truncate` je nach Kontext

**Verifikation:**
```bash
grep -rn "break-words\|whitespace-pre-wrap\|overflow-hidden\|line-clamp\|truncate" components/ticket/ --include="*.tsx" | wc -l
# Erwartung: Mindestens 10+ Stellen
```

---

## SPRINT 2 — UX-Konsistenz & Design-System (1-2h)

### UX-6: Farbschema vereinheitlichen

**Dateien:** `components/ui/index.tsx`, `components/ticket/TicketDetailView.tsx`, diverse Pages

**Problem:** Grün wird für CTAs, Status "Erledigt", Preise, Kalender-Frei gleichzeitig genutzt. 6+ verschiedene Farben ohne klare Logik.

**Fix:** Einheitliches Farbschema durchsetzen:

| Bedeutung | Farbe | Tailwind-Klasse |
|---|---|---|
| **Status: Offen** | Orange/Amber | `bg-amber-100 text-amber-800` |
| **Status: In Bearbeitung** | Blau | `bg-blue-100 text-blue-800` |
| **Status: Erledigt** | Grün | `bg-emerald-100 text-emerald-800` |
| **Status: Notfall** | Rot | `bg-red-100 text-red-800` |
| **Typ: Standard** | Grau | `bg-gray-100 text-gray-700` |
| **Typ: Diagnose** | Lila | `bg-purple-100 text-purple-800` |
| **Typ: Projekt** | Indigo | `bg-indigo-100 text-indigo-800` |
| **CTA-Buttons** | Brand-Grün | `bg-[#3D8B7A] text-white` |
| **Preise** | Neutral (kein Chip) | Inline-Text, kein farbiger Chip |

1. StatusBadge-Komponente erstellen oder erweitern in `components/ui/index.tsx`
2. TypBadge getrennt von StatusBadge
3. Alle Stellen die inline Status-Farben setzen durch die Komponente ersetzen

**Verifikation:**
```bash
# Suche nach inline Status-Farben die durch Komponente ersetzt werden sollten
grep -rn "bg-green\|bg-red\|bg-orange\|bg-yellow\|bg-purple\|bg-blue" app/dashboard-*/  components/ --include="*.tsx" | grep -v node_modules | grep -v "bg-\[#" | wc -l
# Erwartung: Deutlich weniger als vorher, alle über StatusBadge/TypBadge
```

### UX-7: Status vs. Typ visuell trennen

**Problem:** "Projekt", "Diagnose", "Auktion aktiv" stehen als gleichwertige Chips nebeneinander. User kann nicht unterscheiden was Typ und was Status ist.

**Fix:**
1. **Typ-Badge**: Kleiner, dezent, links am Titel → z.B. `Standard | Diagnose | Projekt`
2. **Status-Badge**: Prominent, rechts oben auf der Karte → z.B. `Offen | Auktion | In Bearbeitung | Erledigt`
3. Nie mehr als 2 Badges pro Ticket-Karte
4. "Smart-Auktion" und "Auktion aktiv" zu einem einzigen Status zusammenfassen: `Auktion`

**Verifikation:**
```bash
grep -rn "Smart.Auktion\|Auktion aktiv\|auktion_aktiv" app/ components/ --include="*.tsx" | head -10
# Erwartung: Vereinheitlicht zu einem "Auktion"-Status
```

### UX-8: Spacing & Typografie normalisieren

**Problem:** Inkonsistente Paddings (8px vs 16px), unterschiedliche Schriftgrößen für gleiche Elemente.

**Fix:**
1. Karten-Padding standardisieren: `p-4` (16px) für alle Karten
2. Titel: `text-lg font-semibold` einheitlich
3. Labels: `text-sm text-ink-secondary` einheitlich
4. Buttons: Mindest-Padding `px-4 py-2` (nie `px-2 py-1`)
5. Gaps zwischen Elementen: `gap-3` als Standard, `gap-2` für Chips

**Verifikation:**
```bash
# Inkonsistente Paddings finden
grep -rn "p-2\b\|p-3\b\|p-4\b\|p-5\b\|p-6\b" components/ticket/TicketDetailView.tsx | head -15
# Erwartung: Einheitlich p-4 für Karten, p-3 für Sub-Elemente
```

### UX-9: Kalender-Navigation (Vor/Zurück)

**Datei:** `app/dashboard-handwerker/kalender/page.tsx`

**Problem:** Kein Button für Monatswechsel, nur Scrollen möglich.

**Fix:**
1. Chevron-Links/Rechts-Buttons neben dem Monatstitel
2. "Heute"-Button zum schnellen Zurückspringen
3. Layout: `flex items-center justify-between` für den Header

```tsx
<div className="flex items-center justify-between mb-4">
  <button onClick={prevMonth}><ChevronLeft /></button>
  <h2 className="text-lg font-semibold">{monthName} {year}</h2>
  <button onClick={nextMonth}><ChevronRight /></button>
</div>
```

### UX-10: Bestätigungen bei Aktionen (Toast-Feedback)

**Problem:** Nach "Handwerker auswählen", "Angebot abgeben" etc. fehlt Feedback ob die Aktion geklappt hat.

**Fix:**
1. Prüfen ob die bestehende `Toast`-Komponente (`components/Toast.tsx`) überall genutzt wird
2. Nach jeder erfolgreichen Mutation: `toast.success("Handwerker wurde beauftragt")`
3. Nach jedem Fehler: `toast.error("Aktion fehlgeschlagen — bitte erneut versuchen")`
4. Insbesondere prüfen: Vergabe, Angebot, Befund, Bewertung, Profil-Speichern

**Verifikation:**
```bash
grep -rn "toast\.\|toast(" app/dashboard-*/ components/ticket/ --include="*.tsx" | wc -l
# Erwartung: Mindestens 15+ Toast-Aufrufe
```

---

## NICHT IN DIESEM PROMPT (spätere Sprints)

- **Chat Lese-Bestätigungen / Online-Status** — eigenes Feature
- **Wochenansicht Kalender-Editor** — bereits als "später" markiert
- **Vollständiges Design-System mit Tokens** — Overkill für Beta
- **Playwright/Cypress Mobile-Tests** — eigener Sprint

---

## OBLIGATORISCHE QA-CHECKLISTE

### Schritt 1: Type-Check + Build
```bash
npm run typecheck
npm run build
npm run lint
```

### Schritt 2: Mobile-Verifikation (390px)
Alle Fixes bei 390px Viewport testen:
```bash
# Browser DevTools → Responsive Mode → iPhone SE (375px) oder 390px
# Folgende Flows durchklicken:
# 1. Sidebar öffnen + schließen → Buttons darunter klickbar?
# 2. Ticket-Karte → Status + Typ klar unterscheidbar?
# 3. Chat öffnen → Auto-Scroll? Eingabefeld sichtbar?
# 4. Kalender → Vor/Zurück-Navigation? Kein Text-Overlap?
```

### Schritt 3: Grep-Verifikation
```bash
# UX-1: Kein permanentes Overlay
grep -n "opacity-0.*inset-0\|pointer-events-none.*backdrop" components/layout/Sidebar.tsx
# Erwartung: Backdrop nur bei isOpen im DOM

# UX-5: Overflow geschützt
grep -rn "break-words\|overflow-hidden" components/ticket/ --include="*.tsx" | wc -l
# Erwartung: 10+

# UX-6: StatusBadge Komponente existiert
grep -n "StatusBadge\|TypBadge\|export.*Badge" components/ui/index.tsx
# Erwartung: Exportierte Badge-Komponenten

# UX-7: Kein "Smart-Auktion" oder "Auktion aktiv" mehr
grep -rn "Smart.Auktion\|auktion_aktiv" app/ components/ --include="*.tsx"
# Erwartung: Keine Treffer

# UX-10: Toast bei Aktionen
grep -rn "toast\." components/ticket/ app/dashboard-*/ --include="*.tsx" | wc -l
# Erwartung: 15+
```

---

## Commit-Konvention

```
fix(ui-ux): [Beschreibung]
```

Beispiele:
- `fix(ui-ux): prevent drawer overlay from blocking click events`
- `fix(ui-ux): unify status/type badge colors across app`
- `fix(ui-ux): add auto-scroll to chat and fix input overlap`
- `fix(ui-ux): normalize card spacing and typography`
