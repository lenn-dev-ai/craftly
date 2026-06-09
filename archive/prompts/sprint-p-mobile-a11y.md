# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint P — Mobile-Optimierung + A11y-Compliance

> Aus Audit-Empfehlung 5: „Seiten sollten responsive und mit ARIA-Attributen versehen sein für barrierefreie Nutzung."
>
> Aufwand: ~6-8h Claude Code. Eigenständig.
> Pflicht vor Public-Launch (rechtliche Anforderungen BGG/BFSG).

## Ziel

Reparo erfüllt **WCAG 2.1 AA** und ist auf Mobile (375px-Breite) voll bedienbar:
- Keyboard-Navigation komplett
- Screenreader-tauglich (ARIA, semantische HTML)
- Kontrast-Verhältnisse ≥4.5:1 für Text
- Touch-Targets ≥44×44px
- Responsive 320px–2560px

## Hintergrund — rechtlicher Rahmen

Ab 28.06.2025 gilt das **Barrierefreiheitsstärkungsgesetz (BFSG)** für B2C-Apps. B2B-Tools sind formal nicht verpflichtet aber:
- Verwaltungen sind oft öffentlich-rechtlich (Genossenschaften) → Barrierefreiheit ist Vergabe-Kriterium
- Mieter-App könnte als B2C eingestuft werden
- Pre-Launch konform sein ist günstiger als später retrofitten

## Implementations-Plan

### Phase P1 — Audit (~1h)

Tools:
- **axe-core DevTools** (Chrome-Extension) — automatisierter A11y-Scan pro Page
- **Lighthouse** (Chrome) — Accessibility-Score
- **Browser-DevTools** Mobile-Emulation (iPhone SE 375px)

CC scannt jede Hauptseite, dokumentiert in `A11Y-AUDIT.md`:
- Pro Page: Lighthouse-Score, axe-Issues, manuelle Tab-Reihenfolge-Test
- Schweregrad: Critical (blockiert Nutzung) / Serious / Moderate / Minor

### Phase P2 — Semantik-Fixes (~1.5h)

Häufige Findings die zu erwarten sind:
- `<div onClick>` → `<button>` (mit korrektem Type)
- Listen als `<ul><li>` statt `<div><div>`
- Headings hierarchisch (h1→h2→h3, kein Skipping)
- `<label>` an jedes Input gebunden (htmlFor)
- `<main>`, `<nav>`, `<aside>` Landmarks
- `lang="de"` auf `<html>`

### Phase P3 — ARIA-Polish (~1.5h)

- Dropdowns: `aria-haspopup="menu"`, `aria-expanded`
- Buttons mit nur Icon: `aria-label`
- Loading-Spinner: `role="status"` + `aria-live="polite"`
- Toasts: `role="alert"` für Errors, `role="status"` für Info
- Tabellen: `<caption>` + `<th scope>`
- Form-Errors: `aria-invalid` + `aria-describedby` auf Error-Text

### Phase P4 — Keyboard-Navigation (~1h)

- Tab-Reihenfolge logisch (Reading-Order)
- Focus-Visible auf alle Interaktiven (Tailwind: `focus-visible:ring-2 ring-primary`)
- Modals: Focus-Trap (focus bleibt drin solange offen)
- ESC schließt Modals/Dropdowns
- Skip-to-Main-Content-Link für Screenreader

### Phase P5 — Mobile-Responsive-Fixes (~1.5h)

Auf 375px-Breite testen:
- Sidebar wird zu Bottom-Nav oder Hamburger
- Tabellen scrollen horizontal oder werden zu Cards
- Buttons mind. 44×44px Touch-Target
- Schriftgröße min 14px
- Forms full-width
- Modals nehmen ganzen Screen ein

Bekannte Issues aus Beta-Feedback `f443670f` (Mai): „Häufig wird in den einzelnen Seiten leicht rangezoomt sodass das dann nicht mehr links und rechts richtig abschließt." → Container-Max-Width prüfen.

### Phase P6 — Kontrast-Fixes (~30 min)

axe-Issues abarbeiten:
- `ink-faint` (#9CA3AF) auf weiß = 3.0:1 — failed → ersetzen durch ink-muted (#6B7280) = 5.0:1
- Disabled-Buttons müssen 3:1 zu Background haben
- Sand/Cream-Backgrounds auf Light Text → Kontrast checken

### Phase P7 — Tests + Commit (~30 min)

- Lighthouse Accessibility ≥95 auf 4 Haupt-Pages
- axe-core 0 Critical, 0 Serious
- Manuelle Keyboard-Tour durchspielen
- Commit: `feat(a11y): WCAG 2.1 AA-Compliance + Mobile-Pass (Sprint P)`

## Constraints

- Pricing-Engine nicht anfassen
- Visuell darf NICHTS schlechter aussehen — A11y soll subtle sein
- Performance darf nicht leiden (kein Bloat durch unnötige ARIA)

## Erfolg

- Lighthouse A11y-Score ≥95 auf Login + 4 Dashboards
- axe-DevTools: 0 Critical Issues
- Keyboard-only Bedienung möglich
- BFSG-konform (intern dokumentiert)

## Erster Schritt

Phase P1: A11Y-AUDIT.md schreiben mit Lighthouse-Scores pro Page.
