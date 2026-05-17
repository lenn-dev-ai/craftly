# Reparo — Kritische Fixes aus Agenten-Review (Mai 2026)

> **Quelle:** Externer Agenten-Review der Prod-App (17. Mai 2026)  
> **Priorität:** KRITISCH — Ticket-Detailseiten crashen bei ALLEN Rollen  
> **Vorgehen:** Fixes in Reihenfolge abarbeiten. Nach jedem Fix: `npm run build && npm run typecheck && npm run lint`

---

## Kontext & Stack

- Next.js 14.2 App Router + Supabase + Tailwind CSS + TypeScript
- Ticket-Detail-Komponente: `components/ticket/TicketDetailView.tsx`
- Mieter-Wizard: `app/dashboard-mieter/melden/page.tsx`
- Diagnose-Preise: `app/dashboard-admin/diagnose-preise/page.tsx`
- Error Boundary: `app/error.tsx`

---

## Was bereits erledigt ist (NICHT nochmal anfassen)

- ✅ Alle Fixes aus AUDIT-FIX-PROMPT.md, BRAINDUMP-FIX-PROMPT.md, LIVE-TEST-FIX-PROMPT.md
- ✅ UI-UX-FIX-PROMPT.md Sprint 1 + Sprint 2 (UX-1 bis UX-10)
- ✅ Mieter 5-Step-Flow Grundfunktion
- ✅ Auktion/Vergabe-Pipeline Grundfunktion
- ✅ KI-Analyse funktioniert
- ✅ E2E 15/15, Pen-Tests 16/16 grün

---

## BUG-1: Ticket-Detailseiten crashen bei ALLEN Rollen (KRITISCH)

**Schweregrad:** BLOCKER — App ist ohne funktionierende Ticket-Details nicht nutzbar

**Datei:** `components/ticket/TicketDetailView.tsx`, Zeile 151–184

**Problem:** Die `load()` Funktion hat KEIN Error-Handling um die Supabase-Queries. Wenn eine Query fehlschlägt (RLS-Block, Netzwerk, fehlendes FK-Relation), werden die Daten `null` und der Code crasht beim Zugriff auf Properties. Der Fehler propagiert zum globalen Error Boundary (`app/error.tsx`) → "Ein Fehler ist aufgetreten".

**Konkrete Crash-Vektoren:**
1. `Promise.all()` in Zeile 158 — keine `.error`-Checks auf den Supabase-Responses
2. Zeile 179: `einladungen`-Query mit Resource Embedding `handwerker:handwerker_id(...)` — crasht wenn FK fehlt
3. Zeile 315: `ticket.angebote?.some(a => a.handwerker_id === currentUser?.id)` — crasht wenn `angebote` ein unerwartetes Shape hat

**Fix:**
1. Die gesamte `load()` Funktion in try-catch wrappen
2. Auf JEDEM Supabase-Response `.error` prüfen BEVOR `.data` verwendet wird
3. Component-Level Error-State einführen statt globales Error Boundary

```tsx
// SCHLECHT (aktuell):
const [{ data: profile }, { data: t }, { data: msgs }] = await Promise.all([...])
// Kein Error-Check — wenn t null ist, crasht alles danach

// GUT:
try {
  const [profileRes, ticketRes, msgsRes] = await Promise.all([...])
  
  if (profileRes.error || ticketRes.error) {
    console.error("Ticket laden fehlgeschlagen:", ticketRes.error?.message)
    setError("Ticket konnte nicht geladen werden")
    return
  }
  
  const profile = profileRes.data
  const t = ticketRes.data
  const msgs = msgsRes.data ?? []
  
  if (!t) {
    setError("Ticket nicht gefunden")
    return
  }
  
  // ... Rest der Logik
} catch (err) {
  console.error("Unerwarteter Fehler:", err)
  setError("Ein unerwarteter Fehler ist aufgetreten")
}
```

4. Error-State im Component rendern:
```tsx
const [error, setError] = useState<string | null>(null)

if (error) {
  return (
    <div className="p-6 text-center">
      <p className="text-red-600 font-medium">{error}</p>
      <button onClick={() => { setError(null); load() }} className="mt-4 text-brand underline">
        Erneut versuchen
      </button>
    </div>
  )
}
```

**Verifikation:**
```bash
grep -n "Promise.all\|\.error\|catch\|setError" components/ticket/TicketDetailView.tsx | head -20
# Erwartung: try-catch um load(), .error Checks auf allen Queries, setError State
```

---

## BUG-2: Einladungen RLS-Policy blockiert Verwalter

**Schweregrad:** HOCH — Verwalter sieht keine Einladungen/Angebote für Mieter-Tickets

**Problem:** Die `einladungen_select_hw` Policy prüft nur `erstellt_von = auth.uid()`. Wenn ein MIETER das Ticket erstellt hat, kann der zuständige VERWALTER die Einladungen nicht sehen.

**Fix:** SQL-Migration erstellen:

```sql
-- Migration: fix_einladungen_rls_verwalter.sql
-- Verwalter sollen Einladungen für Tickets sehen können, die ihnen zugewiesen sind

DROP POLICY IF EXISTS "einladungen_select_hw" ON public.einladungen;

CREATE POLICY "einladungen_select_alle_beteiligten" ON public.einladungen
  FOR SELECT USING (
    auth.uid() = handwerker_id
    OR EXISTS (
      SELECT 1 FROM public.tickets t 
      WHERE t.id = ticket_id 
      AND (t.erstellt_von = auth.uid() OR t.verwalter_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.rolle IN ('admin', 'verwalter')
    )
  );
```

**Verifikation:**
```bash
grep -rn "einladungen_select" supabase/migrations/ --include="*.sql"
# Erwartung: Neue Policy mit verwalter_id Check
```

---

## BUG-3: Nachträge RLS-Policy blockiert Verwalter

**Schweregrad:** HOCH — Verwalter kann Nachträge nicht genehmigen

**Problem:** Gleiche Ursache wie BUG-2. Die `nachtraege_select_beteiligte` Policy prüft `t.erstellt_von = auth.uid()` aber nicht `t.verwalter_id`.

**Fix:** SQL-Migration erstellen:

```sql
-- Migration: fix_nachtraege_rls_verwalter.sql

DROP POLICY IF EXISTS "nachtraege_select_beteiligte" ON public.nachtraege;

CREATE POLICY "nachtraege_select_beteiligte" ON public.nachtraege
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets t 
      WHERE t.id = ticket_id 
      AND (
        t.erstellt_von = auth.uid() 
        OR t.verwalter_id = auth.uid()
        OR t.handwerker_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.rolle IN ('admin', 'verwalter')
    )
  );
```

---

## BUG-4: Mieter-Wizard Zurück-Button bricht Prozess ab

**Schweregrad:** MITTEL — Mieter verliert alle eingegebenen Daten

**Datei:** `app/dashboard-mieter/melden/page.tsx`, Zeile 305

**Problem:** Der Header-Zurück-Button nutzt `router.back()` statt die Wizard-Steps zurückzugehen. Der User landet auf dem Dashboard und alle Eingaben sind verloren. Außerdem haben die mittleren Steps (details, ort) KEINE eigenen Zurück-Buttons.

**Fix:**
1. Header-Zurück-Button step-aware machen:

```tsx
// SCHLECHT (aktuell, Zeile 305):
<button onClick={() => router.back()}>&larr; Zurück</button>

// GUT:
<button onClick={() => {
  const steps: Step[] = ["foto", "details", "ort", "zusammenfassung"]
  const currentIndex = steps.indexOf(step)
  if (currentIndex > 0) {
    setStep(steps[currentIndex - 1])
  } else {
    router.back() // Nur auf Step 0 zum Dashboard zurück
  }
}}>
  &larr; Zurück
</button>
```

2. Zurück-Buttons zu ALLEN mittleren Steps hinzufügen:
   - Step "details" → Zurück zu "foto"
   - Step "ort" → Zurück zu "details"
   - Step "zusammenfassung" hat bereits einen Zurück-Button (Zeile 718) ✅

3. Step-Indicator im Header zeigen (z.B. "Schritt 2 von 4")

**Verifikation:**
```bash
grep -n "router.back\|setStep\|step ===" app/dashboard-mieter/melden/page.tsx | head -20
# Erwartung: router.back() nur noch auf Step 0, setStep für alle anderen Steps
```

---

## BUG-5: UTF-8 Encoding "SanitÃ¤r" in Diagnose-Preise

**Schweregrad:** NIEDRIG — Kosmetisch aber unprofessionell

**Datei:** `app/dashboard-admin/diagnose-preise/page.tsx`

**Problem:** Der Anzeige-Label wird direkt aus der DB genommen statt über `formatGewerk()`. Oder es wurde ein Eintrag mit dem Display-Namen statt dem ASCII-Key eingefügt.

**Fix:**
1. Prüfen ob `formatGewerk(row.gewerk)` konsistent verwendet wird (Zeile ~204)
2. Falls ja: Das Problem liegt in der DB-Daten. Der `gewerk`-Wert in der `diagnose_preise`-Tabelle ist vermutlich `"Sanitär"` statt `"sanitaer"`. Fix:

```sql
-- In Supabase SQL Editor ausführen:
UPDATE public.diagnose_preise SET gewerk = 'sanitaer' WHERE gewerk LIKE '%anit%' AND gewerk != 'sanitaer';
```

3. Sicherstellen dass ÜBERALL `formatGewerk()` statt raw DB-Werte genutzt wird

**Verifikation:**
```bash
grep -rn "\.gewerk\b" app/dashboard-admin/diagnose-preise/ --include="*.tsx" | head -10
# Erwartung: Immer formatGewerk(x.gewerk), nie x.gewerk direkt als Label
```

---

## BUG-6: Fehlende Tooltips bei Icons

**Schweregrad:** NIEDRIG — UX-Verbesserung

**Problem:** Icons (Mülltonne, Bearbeiten etc.) haben keine `title`- oder `aria-label`-Attribute.

**Fix:**
1. Alle Icon-Buttons in Diagnose-Preise und Nutzerverwaltung mit `title="..."` versehen
2. Pattern: `<button title="Eintrag löschen" aria-label="Eintrag löschen">🗑</button>`

**Verifikation:**
```bash
grep -rn "title=\|aria-label=" app/dashboard-admin/ --include="*.tsx" | wc -l
# Erwartung: Mindestens 10+ Stellen
```

---

## BUG-7: Filterchips in Nutzerverwaltung — Klick auf Zahl funktioniert nicht

**Schweregrad:** NIEDRIG — UX

**Datei:** `app/dashboard-admin/nutzer/page.tsx`

**Problem:** Die Filterchips haben den onClick nur auf dem Text-Label, nicht auf dem gesamten Chip inkl. Zahl.

**Fix:** Den onClick auf das äußere Chip-Element setzen, nicht auf ein inneres `<span>`:

```tsx
// SCHLECHT:
<div className="chip">
  <span onClick={...}>Verwalter</span>
  <span className="count">12</span>
</div>

// GUT:
<div className="chip cursor-pointer" onClick={...}>
  <span>Verwalter</span>
  <span className="count">12</span>
</div>
```

---

## BUG-8: Bessere Fehlermeldungen statt generischer Fehlerseite

**Schweregrad:** MITTEL — Debugging und UX

**Datei:** `app/error.tsx`

**Problem:** Alle Fehler zeigen nur "Ein Fehler ist aufgetreten" ohne Details.

**Fix:**
1. In `app/error.tsx` den Error-Message anzeigen (nur in Dev/Staging)
2. Logging verbessern: `console.error` mit Stack-Trace bei jedem gefangenen Fehler
3. Differenzierte Fehlermeldungen: "Ticket nicht gefunden", "Keine Berechtigung", "Netzwerkfehler"

```tsx
// In app/error.tsx:
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("App Error:", error)
  }, [error])
  
  return (
    <div className="p-6 text-center">
      <h2 className="text-lg font-semibold text-red-600">Ein Fehler ist aufgetreten</h2>
      <p className="text-sm text-ink-secondary mt-2">
        {error.message || "Bitte versuche es erneut oder lade die Seite neu."}
      </p>
      <button onClick={reset} className="mt-4 px-4 py-2 bg-brand text-white rounded-lg">
        Erneut versuchen
      </button>
    </div>
  )
}
```

---

## NICHT IN DIESEM PROMPT (spätere Sprints)

- **Interaktive Routenplanung** — eigenes Feature
- **Chat-System** zwischen Rollen — bereits teilweise vorhanden
- **Cross-Browser-Tests** — eigener Sprint
- **MFA / Passwort-Reset** — Supabase Auth bietet das bereits, nur UI fehlt
- **Vollständige Lokalisierung** (de/en) — nach Beta

---

## OBLIGATORISCHE QA-CHECKLISTE

### Schritt 1: Build + Type-Check
```bash
npm run typecheck
npm run build
npm run lint
```

### Schritt 2: Ticket-Detail Test (WICHTIGSTER TEST)
```bash
# Folgende URLs im Browser testen:
# 1. /dashboard-verwalter/tickets → Ticket anklicken → Details müssen laden
# 2. /dashboard-handwerker/auftraege → Auftrag anklicken → Details müssen laden
# 3. /dashboard-mieter → Ticket anklicken → Details müssen laden
# 4. Bei JEDEM: "Handwerker buchen" / "Annehmen" / "Ablehnen" muss funktionieren
```

### Schritt 3: Wizard-Test
```bash
# /dashboard-mieter/melden
# 1. Schritt 1 ausfüllen → Weiter
# 2. Schritt 2 ausfüllen → Zurück → Daten noch da?
# 3. Alle Schritte durchklicken → Zurück-Button geht immer nur 1 Schritt zurück?
# 4. Auf Schritt 1: Zurück → Dashboard
```

### Schritt 4: Grep-Verifikation
```bash
# BUG-1: Error-Handling in TicketDetailView
grep -n "try\|catch\|setError\|\.error" components/ticket/TicketDetailView.tsx | head -15
# Erwartung: try-catch um load(), .error Checks

# BUG-4: Wizard-Navigation
grep -n "router.back\|setStep" app/dashboard-mieter/melden/page.tsx | head -15
# Erwartung: router.back() nur auf Step 0

# BUG-5: formatGewerk konsistent
grep -rn "\.gewerk" app/dashboard-admin/diagnose-preise/ --include="*.tsx"
# Erwartung: Immer über formatGewerk()

# BUG-8: Bessere Fehlermeldung
grep -n "error.message\|console.error" app/error.tsx
# Erwartung: error.message wird angezeigt
```

---

## SQL-MIGRATIONEN (manuell im Supabase SQL Editor)

Die folgenden SQL-Statements müssen NICHT von dir ausgeführt werden. Schreib sie als Migration-Dateien, wir führen sie manuell im Browser aus:

1. `supabase/migrations/20260527000000_fix_einladungen_rls.sql` → BUG-2
2. `supabase/migrations/20260527100000_fix_nachtraege_rls.sql` → BUG-3
3. `supabase/migrations/20260527200000_fix_diagnose_encoding.sql` → BUG-5

---

## Commit-Konvention

```
fix(critical): [Beschreibung]
```

Beispiele:
- `fix(critical): add error handling to ticket detail view`
- `fix(ux): make wizard back-button step-aware`
- `fix(a11y): add tooltips to icon buttons`
