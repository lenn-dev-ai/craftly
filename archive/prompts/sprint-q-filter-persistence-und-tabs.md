# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint Q — Filter-Persistence + Stufenweise Dashboards

> Aus Audit-2 (23.05.2026): 2 echte Issues die in M/N/O/P nicht abgedeckt waren.
>
> Aufwand: ~3-4h Claude Code. Eigenständig.

## Ziel

**Q1 — Filter-Persistence:** Filter & Suchkriterien überleben Page-Wechsel.
Konkret: wenn ein Verwalter im Handwerker-Verzeichnis nach „Sanitär in Mitte"
sucht und dann zum Marktplatz wechselt, ist der Filter noch da.

**Q2 — Stufenweise Dashboards:** Informationsdichte reduzieren via Tabs oder
Akkordeons — vor allem im Admin-Panel und HW-Dashboard. Nutzer sieht zuerst
das Wesentliche, kann optional „mehr anzeigen".

## Q1 — Filter-Persistence

### Code-Lokationen

- `app/dashboard-verwalter/handwerker/page.tsx` — Verzeichnis (Quelle)
- `app/dashboard-verwalter/marktplatz/page.tsx` — Marktplatz (Ziel)
- Cross-page-state via URL-Search-Params oder Zustand-Store

### Spec

**Variante A — URL-Search-Params (empfohlen, kein State-Lib nötig):**

```tsx
// In beiden Seiten: nutze useSearchParams + Router
const params = useSearchParams()
const gewerkFilter = params.get('gewerk') ?? ''
const ortFilter = params.get('ort') ?? ''

// Beim Wechsel-Button: query-string mitnehmen
<Link href={`/dashboard-verwalter/marktplatz?gewerk=${encodeURIComponent(gewerk)}&ort=${encodeURIComponent(ort)}`}>
  Zum Marktplatz
</Link>
```

**Variante B — sessionStorage (für komplexere Filter mit vielen Feldern):**

```tsx
// In source-Seite: vor Navigation speichern
sessionStorage.setItem('reparo:filter:verwalter', JSON.stringify({gewerk, ort, rating}))

// In target-Seite: beim Mount lesen + anwenden
useEffect(() => {
  const saved = sessionStorage.getItem('reparo:filter:verwalter')
  if (saved) setFilter(JSON.parse(saved))
}, [])
```

**Cowork-Empfehlung:** Variante A (URL-Search-Params) — shareable Links,
Browser-Back funktioniert, kein localStorage-Cleanup nötig.

### Implementations-Phase Q1 (~1.5h)

1. Filter-State auf URL-Params umstellen in beiden Pages (~45 min)
2. „Zum Marktplatz"-Buttons im Verzeichnis: Query mitschicken (~15 min)
3. „Zum Verzeichnis"-Buttons im Marktplatz: umgekehrt (~15 min)
4. Filter-Reset-Button („Filter zurücksetzen") in beiden Pages prominent (~15 min)
5. Smoke-Test mit test-Accounts

**Commit:** `feat(ux): Filter-Persistence Verzeichnis ↔ Marktplatz (Sprint Q1)`

## Q2 — Stufenweise Dashboards

### Hintergrund

Audit-2: „Die Seiten sind voll gepackt mit Informationen; für neue Nutzer
könnte die Vielzahl an KPIs und Optionen überfordernd wirken, vor allem
im Admin-Panel und im Handwerker-Dashboard."

Lösung: Dashboards in **2 Zonen** teilen:

```
┌──────────────────────────────────────┐
│ ÜBERSICHT (immer sichtbar)            │
│ • 3-4 Top-KPIs                        │
│ • aktuell wichtigste Aktion           │
├──────────────────────────────────────┤
│ DETAILS (klappbar/Tab)                │
│ • alle anderen KPIs                   │
│ • Charts + Drilldowns                 │
│ • System-Health, Logs etc.            │
└──────────────────────────────────────┘
```

### Konkrete Pages

**Admin-Dashboard** (`/dashboard-admin`):
- Übersicht: Anzahl Nutzer, offene Tickets, ungesichtete Feedbacks
- Details (Akkordeon): KI-Anomalien, Wöchentliche Charts, System-Health-Bars

**HW-Dashboard** (`/dashboard-handwerker`):
- Übersicht: Sichtbarkeitsstufe, offene Ausschreibungen, Bewertung
- Details (Tabs): Kennzahlen, KI-Tipps, alle Aktionstiles
- ABER: aktuelle Liste „Aktuelle Ausschreibungen" bleibt prominent

### Implementations-Phase Q2 (~2h)

1. Shared Akkordeon-Component bauen (~30 min)
   ```tsx
   // components/ui/Accordion.tsx
   <Accordion title="Mehr Details" defaultOpen={false}>
     {/* Inhalt */}
   </Accordion>
   ```
   Mit smooth-animation, Persist-State in localStorage (User-Präferenz).

2. Admin-Dashboard refaktoren (~45 min)
   - Top 3 KPIs bleiben oben
   - „Anomalien & Empfehlungen" + „Wöchentliche Charts" in Akkordeon
   - System-Health-Bars als separater Tab/Klappe

3. HW-Dashboard refaktoren (~45 min)
   - Sichtbarkeits-Stufe + 3 Haupt-Kennzahlen bleiben oben
   - „Aktuelle Ausschreibungen" bleiben prominent (Kern-Feature)
   - Aktionstiles in Akkordeon „Weitere Funktionen"

**Commit:** `feat(ux): Stufenweise Dashboards (Sprint Q2)`

## Constraints

- Pricing-Engine nicht anfassen
- Bestehende URL-Routes nicht ändern (nur Query-Params ergänzen)
- Default-State der Akkordeons: geschlossen (außer Top-Section)
- Mobile-First: auf 375px alles lesbar
- A11y: Akkordeon mit `aria-expanded`, Keyboard-Nav

## Erfolg

- Verwalter behält Filter beim Wechsel (kein Re-Eintippen)
- Admin-Dashboard wirkt nicht mehr „überladen" beim ersten Öffnen
- HW-Dashboard fokussiert auf die nächste sinnvolle Aktion

## Erster Schritt

Q1 zuerst (URL-Params-Migration), dann Q2 (Akkordeon-Component + Refactor).
