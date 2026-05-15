# Reparo Designsystem (Sprint 2)

**Stand:** 2026-05-15
**Quelle der Wahrheit:** `tailwind.config.js`
**Begleit-Doku:** dieser File

Sprint 2 aus dem App-Audit hat die wichtigsten Tokens etabliert,
`components/ui/index.tsx` migriert und die zentrale `Sidebar.tsx`
exemplarisch umgestellt. Der Rest der Pages migriert sich nach diesem
Cheatsheet (oder via dem Bulk-Skript unten).

---

## 1. Color-Tokens

Alle in `tailwind.config.js` unter `theme.extend.colors` definiert,
verwendbar als `bg-<token>`, `text-<token>`, `border-<token>`.

### Surfaces / Hintergründe
| Token | Hex | Wofür |
|---|---|---|
| `surface` | `#FAF8F5` | Page-Background |
| `surface-card` | `#FFFFFF` | Cards, Drawer, Modals |
| `surface-muted` | `#F5F3F0` | dezente Bereiche, Filter-Tabs |
| `surface-warm` | `#FAF1DE` | Warm-getönte Hinweis-Boxen |

### Text (ink)
| Token | Hex | Wofür |
|---|---|---|
| `ink` | `#2D2A26` | Primary text, Headings |
| `ink-secondary` | `#6B665E` | Sekundär-Labels, sub-text |
| `ink-muted` | `#8C857B` | Captions, Meta-Infos |
| `ink-faint` | `#B5AEA4` | Disabled, Placeholder |

### Brand & Accent
| Token | Hex | Wofür |
|---|---|---|
| `accent` | `#3D8B7A` | Primary brand (== verwalter green) |
| `accent-hover` | `#2D6B5A` | Hover-State Primary-Button |
| `accent-light` | `#E8F4F1` | Soft Background für Akzent |
| `warm` | `#C4956A` | Sekundärer Akzent (== handwerker) |
| `warm-light` | `#FAF1DE` | Warm Block-Background |
| `warm-dark` | `#854F0B` | Dark warm text auf hellem Background |

### Rollen-Akzente
| Token | Hex |
|---|---|
| `rolle-verwalter` | `#3D8B7A` |
| `rolle-handwerker` | `#C4956A` |
| `rolle-mieter` | `#5B6ABF` |
| `rolle-admin` | `#7C6CAB` |

### Status (Workflow-Stufen)
| Token | Hex | Wofür |
|---|---|---|
| `status-offen` | `#C4574B` | Bedarf Aktion |
| `status-auktion` | `#5B6ABF` | Läuft |
| `status-bearbeitung` | `#C4956A` | In Arbeit |
| `status-erledigt` | `#3D8B7A` | Done |

### Typ (subtiler als Status)
| Token | Hex |
|---|---|
| `typ-standard` | `#6B665E` |
| `typ-diagnose` | `#7C6CAB` |
| `typ-projekt` | `#3D8B7A` |

### Semantic
| Token | Hex | Wofür |
|---|---|---|
| `danger` / `danger-light` | `#C4574B` / `#FDEEEC` | Errors, Destructive |
| `warning` / `warning-light` / `warning-dark` | `#F59E0B` / `#FAF1DE` / `#854F0B` | Warnings |
| `info` / `info-light` | `#5B6ABF` / `#E8EAF6` | Informational |
| `success` / `success-light` | `#3D8B7A` / `#E8F4F1` | Confirmations |

### Borders
| Token | Hex | Wofür |
|---|---|---|
| `line` | `#EDE8E1` | Standard-Border |
| `line-strong` | `#D5CFC7` | Hervorgehobene Trennung |
| `line-muted` | `#F5F3F0` | dezente Trennung |

---

## 2. Spacing / Radius / Shadow

### Border-Radius
- `rounded-sm` = 8px (Mini-Chips, Inputs in dichten Listen)
- `rounded-md` = 12px (Buttons, Standard-Inputs)
- `rounded-lg` = 16px (Cards-Standard)
- `rounded-xl` = 20px (Hero-Cards, Modals)
- `rounded-2xl` = 24px (Top-Level-Container)

### Shadows
- `shadow-sm` (default cards)
- `shadow` (subtle pop)
- `shadow-md` (hover-state)
- `shadow-lg` (dropdowns, popovers)
- `shadow-xl` (modals)

### Spacing-Convention
Tailwind-Default-Skala. Empfohlen:
- Card-Padding: `p-4` mobile, `p-5 sm:p-6` desktop
- Page-Padding: `p-6 max-w-* mx-auto pt-16 md:pt-8` (pt-16 für Hamburger)
- Stack-Gap: `space-y-3` (dichte Liste) / `space-y-6` (sektioniert)

---

## 3. Komponenten-Library (`components/ui/index.tsx`)

| Komponente | Wofür |
|---|---|
| `<Badge status>` | **Status-Chip** — primär hervorgehoben, eine Farbe pro Stufe |
| `<TypBadge typ>` | **Typ-Chip** — subtiler outline, kein gefüllter Hintergrund |
| `<PrioBadge prio>` | **Prio-Chip** — versteckt sich bei `prio="normal"` |
| `<StatusDot status>` | Mini-Indikator für dichte Listen |
| `<Avatar name rolle?>` | Initialen-Bubble; mit `rolle` wird sie rolle-farbig |
| `<Card>` | Standard-Card mit shadow-sm + line-border |
| `<Button variant size>` | primary/secondary/ghost/danger × sm/md/lg |
| `<Input>` `<Select>` `<Textarea>` | Form-Standards mit Label-Slot |
| `<MetricCard label value sub onClick?>` | KPI-Tile, klickbar als Drill-Down |
| `<EmptyState icon title desc action?>` | Konsistenter Empty-Block |
| `<LoadingSpinner>` | Globaler Spinner |

### Audit-Punkt 4: Status/Typ/Priorität trennen

**Faustregel:** Pro Karte/Zeile **nur EIN** primär-farbiger Badge.

```tsx
// Gut: Status primär, Typ + Prio subtil/versteckt
<Badge status="auktion" />
<TypBadge typ="diagnose" />
<PrioBadge prio="normal" />  // rendert nichts

// Falsch: drei gefüllte Chips konkurrieren visuell
```

---

## 4. Migration eines bestehenden Files

### Ersetzungen (häufigste Muster)

| Vorher | Nachher |
|---|---|
| `bg-[#FAF8F5]` | `bg-surface` |
| `bg-white` | `bg-surface-card` |
| `bg-[#F5F0EB]` / `bg-[#F5F3F0]` | `bg-surface-muted` |
| `text-[#2D2A26]` | `text-ink` |
| `text-[#6B665E]` | `text-ink-secondary` |
| `text-[#8C857B]` | `text-ink-muted` |
| `text-[#B5AEA4]` | `text-ink-faint` |
| `bg-[#3D8B7A]` | `bg-accent` |
| `text-[#3D8B7A]` | `text-accent` |
| `hover:bg-[#2D6B5A]` | `hover:bg-accent-hover` |
| `border-[#EDE8E1]` | `border-line` |
| `bg-[#EDE8E1]` | `bg-line` |
| `bg-[#C4574B]` | `bg-danger` (oder `bg-status-offen`) |
| `text-[#C4574B]` | `text-danger` |
| `bg-[#C4956A]` | `bg-warm` (oder `bg-status-bearbeitung`) |
| `text-[#854F0B]` | `text-warm-dark` |
| `bg-[#5B6ABF]` | `bg-rolle-mieter` (oder `bg-info`) |
| `bg-[#7C6CAB]` | `bg-rolle-admin` |

### Bulk-Skript (find&replace)

```bash
# Backup zuerst!
git status  # alles committed?

# Häufigste Ersetzungen, keine Edge-Cases
sed -i '' \
  -e 's|bg-\[#FAF8F5\]|bg-surface|g' \
  -e 's|bg-\[#F5F3F0\]|bg-surface-muted|g' \
  -e 's|bg-\[#F5F0EB\]|bg-surface-muted|g' \
  -e 's|text-\[#2D2A26\]|text-ink|g' \
  -e 's|text-\[#6B665E\]|text-ink-secondary|g' \
  -e 's|text-\[#8C857B\]|text-ink-muted|g' \
  -e 's|text-\[#B5AEA4\]|text-ink-faint|g' \
  -e 's|bg-\[#3D8B7A\]|bg-accent|g' \
  -e 's|text-\[#3D8B7A\]|text-accent|g' \
  -e 's|border-\[#EDE8E1\]|border-line|g' \
  -e 's|bg-\[#EDE8E1\]|bg-line|g' \
  -e 's|text-\[#C4574B\]|text-danger|g' \
  -e 's|bg-\[#FDEEEC\]|bg-danger-light|g' \
  -e 's|text-\[#854F0B\]|text-warm-dark|g' \
  $(find app components -name "*.tsx")

# Danach checken:
npx tsc --noEmit && npm run build && npm run test:e2e
```

**Achtung:** Opacity-Modifier (`bg-[#3D8B7A]/20` etc.) werden nicht
automatisch ersetzt — die müssen manuell auf `bg-accent/20` umgestellt
werden, sonst bleibt der Hex.

---

## 5. Was wurde in Sprint 2 NICHT erledigt

Noch offen für inkrementelle Migration:
- Alle Dashboard-Pages (`app/dashboard-*`, ~20 Dateien)
- `components/ticket/TicketDetailView.tsx` (groß, viel Logik)
- Marketing-Pages (`app/page.tsx`, Landing)
- Globale CSS-Variablen in `app/globals.css` sind noch nicht 1:1 mit
  Tailwind-Tokens synchronisiert — falls eine Komponente eine
  `var(--color-*)` nutzt, sollte sie auf Tailwind-Token umstellen.

Pro File ~5-15 Min mit dem Bulk-Skript + manueller Opacity-Sweep.
