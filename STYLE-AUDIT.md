# Reparo Style-Audit (Sprint M)

Stand: 24. Mai 2026. Inventarisiert die Design-Tokens und identifiziert Drift,
damit künftige Sprints Konsistenz halten können.

## 1. Token-System (zentral in `tailwind.config.js`)

### Farben — vollständig benannt, keine freien Hex-Werte mehr nötig

| Kategorie | Tokens |
|---|---|
| Surface | `surface` (DEFAULT/card/muted/warm) |
| Brand | `accent` (DEFAULT/hover/light/muted) |
| Sekundär | `warm` (DEFAULT/light/dark) |
| Text | `ink` (DEFAULT/secondary/muted/faint) |
| Rollen | `rolle-verwalter` / `rolle-handwerker` / `rolle-mieter` / `rolle-admin` |
| Status | `status-offen` / `status-auktion` / `status-bearbeitung` / `status-erledigt` |
| Typ | `typ-standard` / `typ-diagnose` / `typ-projekt` |
| Semantik | `danger` / `warning` / `info` / `success` (+ light-Variante) |
| Linien | `line` (DEFAULT/strong/muted) |

**Regel**: keine neuen Hex-Werte ohne Token-Eintrag.

### Radius & Shadow

- Radius: `sm` (8px) bis `2xl` (24px) — Cards nutzen typischerweise `2xl`
- Shadow: `sm` bis `xl` — Cards `sm`, Modals `xl`

### Spacing

Tailwind-Defaults (4/8/12/16/20/24/32/40/48). Keine eigenen Tokens nötig.

## 2. Komponenten-Library (`components/ui/index.tsx`)

| Component | Status | Zweck |
|---|---|---|
| `Badge` / `TypBadge` / `PrioBadge` | ✅ konsolidiert (Sprint 2) | Status/Typ/Prio-Pills |
| `StatusDot` | ✅ | Punkt-Indikator |
| `TrustBadge` | ✅ | Sichtbarkeitsstufen Bronze/Silber/Gold |
| `Avatar` | ✅ | Initialen-Avatar pro Rolle |
| `Card` | ✅ | rounded-2xl + border-line + bg-surface-card |
| `Button` | ✅ | Primary/Secondary/Ghost, 3 Sizes |
| `Input` / `Select` / `Textarea` | ✅ | Forms mit Label-Prop |
| `MetricCard` / `Kpi` (in Verwalter-Page) | ⚠️ teils dupliziert | KPI-Kacheln |
| `EmptyState` | ✅ | icon+title+desc+action |
| `LoadingSpinner` / `Toast` | ✅ | Feedback-Mechanismen |

**Drift-Punkt: KPI-Kacheln** — es gibt drei Varianten:
- `MetricCard` (components/ui)
- `Kpi` (inline in `app/dashboard-verwalter/page.tsx`)
- `KpiTile` (inline, Sprint H — hat Icon-Prop)

Begründung der Tolerierung: `KpiTile` hat zusätzliche Icon-Funktionalität die `MetricCard` nicht hat. Eine spätere Konsolidierung wäre saubere Refactor-Aufgabe, aber visuell ist die Drift minimal (alle nutzen `border-line` + `rounded-2xl` + tabular-nums).

## 3. Roh-Buttons vs. `<Button>`-Wrapper

`grep -rcn "<button className" app/` zeigt **1** Treffer für Roh-Buttons (Empty-State-Reset in Wohnungen-Page). 28 Stellen nutzen `<Button>`-Wrapper. Verhältnis ist gesund.

Inline-`<button>` ist legitim für:
- Icon-only-Schließbuttons (`<X />`-Klick, mit `aria-label`)
- Filter-Pills (eigene Optik)
- Schnellauswahl-Chips im Mieter-Wizard

## 4. Sidebar-Konsistenz

`components/layout/Sidebar.tsx` zentralisiert pro Rolle die Items + Group-Mechanik (`gruppe="selten"` → `"Mein Bereich"`-Untersektion).

- Active-State: alle Rollen identisch (`bg-rolle-<rolle>/10`-Höhe + Text-Farbe).
- Mobile-Verhalten: Hamburger + Backdrop-Drawer, einheitlich für alle Rollen.

Keine Drift identifiziert.

## 5. Mini-Cleanups in dieser Session

| Item | Status |
|---|---|
| `wizardSteps`-Array hatte toten Eintrag `"dringlichkeit"` | ✅ entfernt (Sprint M) |
| Mehrere lokale Empty-States ohne Kontext (Tickets/Marktplatz/HW-Verzeichnis) | ✅ aufgewertet mit Filter-State + Action-CTAs (Vorab-Polish-Commit `cf2861f`) |
| Diagnose-Modal + Privat-Termin-Modal ohne `role="dialog"` | ✅ ergänzt (Vorab-Polish) |
| Toast ohne `aria-live` | ✅ ergänzt (Vorab-Polish) |

## 6. Bekannte Drift-Punkte ohne aktuellen Fix-Plan

| Drift | Wo | Empfehlung |
|---|---|---|
| `KpiTile` vs. `Kpi` vs. `MetricCard` | Verwalter-Dashboard, ui-lib | Post-Beta: konsolidieren mit Icon-Prop in MetricCard |
| Inline-Style-Werte für Status-Bars (Progress) | Mieter-Wizard, Phasen-Indikator | minor — Hex-Werte sind die selben wie die Token-Varianten |
| Box-Shadows manchmal direkt als `shadow-sm` vs. semantisch (`Card`-Default) | gemischt | low-prio |

## 7. Regeln für künftige Sprints

1. **Farben nur aus dem Token-System** — kein `bg-[#abc123]` ohne Token.
2. **Buttons über `<Button>`-Wrapper** — Roh-Buttons nur für Icon-only + aria-label.
3. **Cards über `<Card>`-Wrapper** — Border/Radius/Shadow nicht freihand.
4. **Forms über `<Input>` / `<Select>` / `<Textarea>`** — Höhe + Focus-Ring konsistent.
5. **Empty-States über `<EmptyState>`** — siehe Sprint N.
6. **Rollen-Farben** nur für rollen-spezifische Elemente (Avatar, Sidebar-Active, Wizard-Akzente).

## 8. Sprint-AB-Farb-Diät (Verwalter-Bereich Enterprise-Look)

Aus Designer-Audit (Verwalter-Design-Fit 5.5/10 → Enterprise-Ruhe):

- **`accent` (Reparo-Green)** — nur für Primary-Action pro Screen
  (Haupt-CTA-Button, primärer Link). KPI-Werte stehen in `text-ink`
  (Standard), nicht in `text-accent`.
- **`warm` (Gold)** — nur für Highlights mit echter Bedeutung:
  Early-Adopter-Banner, Sales-Pricing-„BELIEBT"-Tag, Warn-Cards.
  NICHT für KPI-Werte, nicht für sekundäre Sektion-Header.
- **`rolle-*` (Rollen-Farben)** — Avatar / Sidebar-Active / Wizard-
  Step-Indikator. NICHT als KPI-Akzent-Farbe.
- **Status-Dots** — `status-offen` rot / `status-auktion` blau /
  `status-bearbeitung` amber / `status-erledigt` grün. Klein (`w-2 h-2`).
  NICHT als Background-Fläche im Verwalter-Bereich.
- **Card-Hierarchie:** max. eine farbige Card pro Section. Mehrere
  KPIs landen in einem Inline-Strip (siehe `KpiStripItem` in
  `app/dashboard-verwalter/page.tsx`).

**Tatsächlich umgesetzt in Sprint AB:**
- AB1 Dashboard: 4 farbige KPI-Cards → ein Strip in `text-ink`,
  Chart in Akkordeon (commit `7efaeb5`)
- AB2 Tickets-Liste: Card-pro-Zeile → Tabelle (commit `462442e`)
- AB3 Marktplatz-KPIs: 3 farbige Cards → ein Strip (commit `1faf65e`)
- AB4 Reporting: Export-Button-Stub neben Zeitraum-Filter (commit `210558a`)
- AC Bronze/Silber/Gold → Partner-Stufen mit Reparo-Green-Akzent
  statt Medaillen-Optik (commit `28c9b6f`)

Marketing-Landing `/hausverwaltungen` (Sprint K) bleibt bewusst
conversion-orientiert mit Hero-Highlights — die Regeln gelten für
den Arbeitsbereich, nicht für Marketing.

## 8. Verifikation

Build grün (Next.js 14.2.35, tsc --noEmit grün). Keine visuelle Regression in den getesteten Sektionen.
