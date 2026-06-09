# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint M — UI-Konsistenz-Audit + Fixes

> Aus Audit-Empfehlung 1: „Farbschemata und Interaktionsmuster sollten über alle Rollen hinweg identisch sein, um die Lernkurve zu reduzieren."
>
> Aufwand: ~3-4h Claude Code. Eigenständig.

## Ziel

Über die 4 Rollen (Admin, Verwalter, Handwerker, Mieter) konsistente:
- Farben (Reparo-Grün, Gold, Cream, Sand) — keine Drift
- Spacing-Tokens (4/8/16/24/32px) — kein freies Padding
- Button-Stile (Primary, Secondary, Ghost, Destructive) — eine Quelle
- Card-Stile (Border, Shadow, Radius) — einheitlich
- Form-Inputs (Höhe, Border, Focus-Ring) — einheitlich

## Code-Lokationen

- `tailwind.config.ts` — zentrale Tokens
- `components/ui/*` — sollen alle Komponenten verwenden
- `app/dashboard-*/page.tsx` — Audit ob lokal abgewichen
- `app/marketing/*` + `app/hausverwaltungen/page.tsx` (Sprint K) — bereits konsistent?

## Implementations-Plan

### Phase M1 — Audit-Run (~45 min)

Cowork hat geliefert, was im Reparo-Audit auffällt:
- **Card-Spacing** unterschiedlich auf Admin-Dashboard vs. Verwalter-Dashboard
- **Sidebar-Item-Style** im HW-Dashboard hat anderen Active-State als Mieter-Dashboard
- **Empty-State-Karten** haben mal Border, mal kein Border
- **Button-Heights** schwanken zwischen `h-10`, `h-11`, `py-2`, `py-3`

CC soll dokumentieren in `STYLE-AUDIT.md`:
- Welche Stile/Tokens kommen wie oft vor
- Wo ist die Drift am größten

### Phase M2 — Design-Tokens konsolidieren (~1h)

In `tailwind.config.ts`:

```ts
extend: {
  colors: {
    primary: { DEFAULT: '#1A7A5A', dark: '#0F4D39', light: '#C8E6D8' },
    accent: { DEFAULT: '#D4A93B' },
    bg: { DEFAULT: '#FAF7F0', muted: '#EDE6D3' },
    ink: { DEFAULT: '#1F2937', muted: '#6B7280', faint: '#9CA3AF' },
    line: { DEFAULT: '#D1D5DB' },
  },
  spacing: { /* nur 4/8/12/16/24/32/48 nutzen, dokumentieren */ },
  borderRadius: { card: '1rem', button: '0.75rem' },
}
```

### Phase M3 — Shared-Components erzwingen (~1h)

`components/ui/Button.tsx`, `Card.tsx`, `Input.tsx` müssen die zentrale Quelle sein.

Alle `<button>`-Elemente direkt im JSX (ohne `<Button>`-Wrapper) durchsuchen + ersetzen:

```bash
grep -r '<button className' app/ | wc -l   # wie viele „roh"-Buttons?
```

### Phase M4 — Per-Rolle Konsistenz-Check (~45 min)

CC navigiert (mental, via Code-Read) durch jede Rolle:
- Admin-Dashboard → Admin-Feedback → Admin-Users
- Verwalter-Dashboard → Tickets → Marktplatz → Properties → Reporting
- HW-Dashboard → Zeitslots → Kalender → Profil
- Mieter-Dashboard → Melden → Tickets → Profil

Pro Drift: Fix mit Verweis auf den Token aus M2.

### Phase M5 — Mini-Cleanups aus Audit

- Mieter-Wizard `wizardSteps`-Array: toten Eintrag `"dringlichkeit"` entfernen (Cowork-Befund 2026-05-23)
- HW-Dashboard: konsistent „Aktuelle Ausschreibungen" vs. anderer Wording auf Marktplatz

### Phase M6 — State-Design-System bauen (Designer-Audit, ~1.5h)

Vom Designer-Audit:
> „Loading / Errors / Empty States / Warnings / Konflikte / Eskalationen / Success Moments — alles als professionelles System."

Shared Components in `components/ui/states/`:
- `<LoadingSkeleton variant="card|table|page" />` — einheitliches Pulse-Skelett
- `<ErrorCard title description retryFn supportLink />` — Error-State mit Action
- `<WarningBanner level="info|warn|critical" dismissable />` — non-blocking Hinweis
- `<ConflictModal />` — z.B. „2 Verwalter bearbeiten gleichzeitig"
- `<EscalationMarker />` — rot, prominent, für Notfälle / Reklamationen
- `<SuccessToast variant="success|info" autoDismiss={3000} />` — schon teilweise da (Sprint N), Hierarchie nachziehen

Plus Doku in `STYLE-AUDIT.md`: Wann welcher State.

### Phase M7 — Karten-Reduktion (Designer-Audit, ~1h)

Vom Designer-Audit:
> „Zu viele Inhalte sitzen in separaten Cards. Dadurch entstehen visuelle Fragmentierung, fehlende Ruhe."

Regel: **Nicht alles braucht eine Card.**
- KPI-Zahlen: nur die Top 3 als Card, der Rest als Inline-Text
- Sekundäre Aktionen: als Text-Buttons statt Card-Tiles
- Listen: Tabellen-Look statt Card-pro-Zeile (insbesondere Verwalter-Bereich)

CC soll pro Dashboard-Page prüfen: welche Cards sind wirklich nötig, welche kann man entkarteln?

Konkrete Hot-Spots:
- HW-Dashboard: 4 Aktions-Tiles als Card → könnten als horizontale Icon+Text-Leiste
- Verwalter-Dashboard: Throughput-Chart-Card + KPI-Cards → in 1 Sektion verschmelzen
- Admin-Dashboard: weniger Anomalie-Cards, mehr List-Items

### Phase M8 — Smoke-Test + Commit

`feat(ui): Konsistenz-Pass + State-System + Karten-Reduktion (Sprint M)`

## Constraints

- Pricing-Engine nicht anfassen
- KEINE Breaking-Visual-Changes (Beta-Tester wären verwirrt) — nur subtile Harmonisierung
- Kein neues CSS-Framework, nur Tailwind-Tokens

## Erfolg

- Verwalter sagt nicht mehr „warum sieht das HW-Dashboard so anders aus?"
- STYLE-AUDIT.md dokumentiert Konventionen für künftige Sprints

## Erster Schritt

Phase M1: STYLE-AUDIT.md schreiben, Drift dokumentieren.
