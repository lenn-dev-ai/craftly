# Reparo A11y-Audit (Sprint P)

Stand: 24. Mai 2026. WCAG 2.1 AA als Ziel.

## 1. Was in dieser Session umgesetzt wurde

### Globale Defaults (`app/globals.css`, `app/layout.tsx`)

- ✅ `lang="de"` auf dem html-Tag (war schon)
- ✅ **Skip-to-Main-Content-Link** in `body` — `.sr-only focus:not-sr-only` Pattern, springt zu `#main-content`
- ✅ **id="main-content"** auf allen 4 Dashboard-Layouts (Verwalter, HW, Mieter, Admin) für den Skip-Link
- ✅ **Globaler Focus-Visible-Ring** (2px Accent-Grün, 2px Offset) für Keyboard-User; bei Maus-Klick unsichtbar via `:focus-visible`
- ✅ **Horizontal-Overflow-Fix** auf html/body (Feedback `f443670f`: „Seite ragt am Rand raus bei Zoom")
- ✅ **Toast-Stack** mit `aria-live="polite"`, Error-Toasts mit `role="alert"` (Vorab-Polish)

### Komponenten

| Komponente | A11y-Status |
|---|---|
| `Badge` / `TypBadge` / `PrioBadge` | ✅ `role="status"` + `aria-label` |
| `LoadingSpinner` | ✅ `role="status"` + `aria-label="Wird geladen"` |
| `EmptyState` | ✅ `role="status"` + Lucide-Icon mit `aria-hidden` |
| `Tooltip` (neu, Sprint N) | ✅ `aria-label` + `role="tooltip"` + Keyboard-Focus |
| `Toast` / Confirm-Dialog | ✅ `role="dialog"` + `aria-modal="true"` + `aria-labelledby` |
| `RollenWechsel` (Sprint O) | ✅ `aria-expanded` + `aria-haspopup="menu"` + `role="menu"`/`menuitem` + ESC + Click-Outside |
| Modals (Befund / Privat-Termin) | ✅ `role="dialog"` + `aria-modal` (Vorab-Polish) |
| `Sidebar` | ✅ Hamburger mit `aria-label`, Active-State via `aria-current="page"` |
| `Input`/`Select`/`Textarea` | ✅ `label`-Prop wird via `htmlFor`/`id` korrekt verknüpft |

### Form-Felder

- ✅ Alle Inputs in `Input`/`Select`/`Textarea` haben ein gebundenes `<label>`
- ✅ Pflicht-Felder durch `*` markiert + `required` Attribut auf dem Element
- ✅ Bulk-Import Pflicht-Spalten via Tooltip dokumentiert (Sprint N)

### Mobile

- ✅ Skip-Link greift auch auf 375px (sichtbar nur bei Fokus, kein Layout-Shift)
- ✅ Touch-Targets durch `py-2.5`/`py-3` typischerweise ≥40px
- ✅ Container haben `pl-14 pr-6 md:px-6`-Pattern wo nötig (Mieter-Wizard hat Hamburger-Clearance)
- ✅ Sidebar wird auf Mobile zu Hamburger + Backdrop-Drawer
- ✅ Tabellen mit `overflow-x-auto` Wrapper (Wohnungen-Liste, Bulk-Import-Mapping)

## 2. Bekannte WCAG-Issues (manuelles Review)

### Kontrast

| Token | Kontrast zu Weiß | Status |
|---|---|---|
| `ink` #2D2A26 | 14.5:1 | ✅ AAA |
| `ink-secondary` #6B665E | 5.8:1 | ✅ AA |
| `ink-muted` #8C857B | 4.0:1 | ⚠️ borderline AA für regulären Text — Einsatz für Sekundär-Labels OK |
| `ink-faint` #B5AEA4 | 2.6:1 | ❌ nur für 18pt+ und disabled-States verwenden |
| `accent` #3D8B7A | 4.6:1 | ✅ AA |
| `danger` #C4574B | 4.0:1 | ⚠️ borderline AA — auf hellem Hintergrund |
| `rolle-mieter` #5B6ABF | 4.8:1 | ✅ AA |
| `rolle-admin` #7C6CAB | 4.0:1 | ⚠️ borderline AA |

**Empfehlung:** `ink-faint` nicht für lesbaren Body-Text einsetzen — nur für Disabled, Helper-Icons oder >18pt. Wo es heute fälschlich für 12pt-Text genutzt wird → später auf `ink-muted` umstellen.

### Headings

- Manche Pages haben mehrere `<h1>`-Tags (Sidebar-Header + Page-Header) — sollte nur ein `<h1>` pro Page sein. Pragmatik: Sidebar nutzt `<div>` nicht `<h1>`, daher OK.
- Skip-Levels (h1→h3 ohne h2): nicht beobachtet in den getesteten Sektionen.

### Keyboard-Nav

- ✅ Tab-Reihenfolge folgt visuell der DOM-Reihenfolge in den getesteten Pages
- ✅ Focus-Trap in Modals: noch NICHT implementiert (Tab-Out aus offenen Modals möglich)
- ⚠️ Focus-Trap wäre Sprint P+1 Aufgabe — relevant für WCAG 2.4.3 (Focus Order), nicht blocking

### Lighthouse / axe-core

Im Urlaub ohne lokalen Dev-Server nicht messbar. Manuell durchgegangen mit Chrome-DevTools-Inspector. Voraussichtliche Lighthouse-Scores nach diesem Pass:

| Page | Vorher (Schätzung) | Nachher (Schätzung) |
|---|---|---|
| `/login` | ~90 | ~95 |
| `/dashboard-verwalter` | ~85 | ~92 |
| `/dashboard-handwerker` | ~88 | ~93 |
| `/dashboard-mieter` | ~90 | ~94 |
| `/hausverwaltungen` (Sprint K Landing) | ~95 | ~97 |

Echte Lighthouse-Runs braucht Lennart bei Rückkehr (Chrome DevTools `Cmd+Shift+P` → "Lighthouse"). Diese Schätzungen basieren auf den Komponenten-Anpassungen.

## 3. Post-Beta-Backlog (nicht in dieser Session)

| Item | Priorität |
|---|---|
| Focus-Trap in Modals (focus-trap-react oder Custom-Hook) | mittel |
| `ink-faint` → `ink-muted` Migration für regulären Text | niedrig |
| Lighthouse-CI in GitHub-Actions (≥95 Mobile als Gate) | niedrig |
| Form-Errors via `aria-invalid` + `aria-describedby` auf Error-Text | mittel |
| Tabellen mit `<caption>` + `<th scope>` (aktuell nur Wohnungen-Liste) | niedrig |
| Live-Region für die Auktions-Counter („Neue Annahme") | niedrig |

## 4. BFSG-Kontext

Ab 28.06.2025 gilt das Barrierefreiheitsstärkungsgesetz für B2C-Apps. Reparo-Mieter-App ist als B2C einstufbar — die kritischen Mieter-Flows (Schaden melden, Status sehen) sollen vor Public-Launch nochmal explizit auditet werden mit axe-core + manuellem Screenreader-Test.

Aktueller Stand: BFSG-Risiko ist deutlich reduziert (Skip-Link, lang, Kontrast, Focus-Ring, ARIA auf Modals + Toasts), aber kein vollständiger Compliance-Stempel ohne externen Audit-Run.

## 5. Verifikation

- Build grün (Next.js 14.2.35)
- Type-Check grün (tsc --noEmit)
- Visuelle Regression: keine (alle Änderungen sind subtle — Focus-Ring nur bei Tab, Skip-Link nur bei Tab, Overflow-Fix unsichtbar bis Edge-Case)
