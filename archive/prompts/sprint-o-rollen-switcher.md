# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint O — Rollen-Switcher als Dropdown

> Aus Audit-Empfehlung 3: „Die Navigation zwischen Admin, Verwalter, Handwerker und Mieter könnte intuitiver gestaltet werden (z. B. Dropdown statt Chip-Buttons)."
>
> Aufwand: ~1.5h Claude Code. Eigenständig.

## Ziel

Statt mehrere Chip-Buttons / verstreute Links: ein einziger Dropdown oben im Header der zwischen den verfügbaren Rollen des aktuellen Users wechselt.

**Wichtig:** Nur für User mit `multiRole = true` oder Admins die mehrere Dashboards sehen dürfen. Normale Mieter sehen keinen Switcher.

## Code-Lokationen

- `components/layout/Header.tsx` oder `Sidebar.tsx` — wo aktuell Rolle gezeigt wird
- `app/dashboard-*/layout.tsx` — Layout-Wrapper pro Rolle
- DB: `profiles.rollen text[]` falls multi-role schon vorgesehen, sonst nur Admin
- Auth-Context: aktuelle effektive Rolle

## Spec

### Header-Komponente

Oben rechts neben Avatar:

```
[Rolle ▼]   [Avatar]
   |
   v (offen)
   ┌────────────────┐
   │ ● Verwalter    │  (aktiv)
   │   Handwerker   │
   │   Admin        │
   └────────────────┘
```

Bei Klick auf eine andere Rolle: navigiert zu `/dashboard-[rolle]`.

### Multi-Role-Mechanik

Aktuell hat jeder User exakt 1 Rolle (profiles.rolle). Aber:
- **Admin** sollte ALLE Dashboards sehen können (für Support / Debug)
- Künftig: Verwalter der gleichzeitig HW ist (gibt's in der Realität)

Empfohlene Umsetzung Phase O1:
- Wenn `user.rolle === 'admin'` → Dropdown zeigt alle 4 Rollen
- Sonst → kein Dropdown (oder disabled mit Tooltip „Nur 1 Rolle")
- Künftig: `profiles.weitere_rollen text[]` ergänzen, dann Union zeigen

## Implementations-Plan

### Phase O1 — Komponente bauen (~45 min)

`components/layout/RollenSwitcher.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check } from 'lucide-react'

const ROLLEN = [
  { key: 'admin', label: 'Admin', href: '/dashboard-admin' },
  { key: 'verwalter', label: 'Verwalter', href: '/dashboard-verwalter' },
  { key: 'handwerker', label: 'Handwerker', href: '/dashboard-handwerker' },
  { key: 'mieter', label: 'Mieter', href: '/dashboard-mieter' },
] as const

export function RollenSwitcher({ aktuelleRolle, verfuegbareRollen }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (verfuegbareRollen.length <= 1) return null // kein Switcher wenn nur 1 Rolle

  const aktuell = ROLLEN.find(r => r.key === aktuelleRolle)!

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-button bg-primary-light text-primary-dark hover:bg-primary/10"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {aktuell.label}
        <ChevronDown className="w-4 h-4" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-1 bg-white border border-line rounded-card shadow-lg min-w-[180px]">
          {ROLLEN.filter(r => verfuegbareRollen.includes(r.key)).map(r => (
            <button
              key={r.key}
              role="menuitem"
              onClick={() => { router.push(r.href); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-bg-muted"
            >
              {r.key === aktuelleRolle && <Check className="w-4 h-4 text-primary" />}
              <span className={r.key === aktuelleRolle ? 'font-semibold' : ''}>{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Phase O2 — In Header integrieren (~15 min)

Im globalen Layout (oder pro dashboard-* layout):

```tsx
const verfuegbareRollen = user.rolle === 'admin'
  ? ['admin', 'verwalter', 'handwerker', 'mieter']
  : [user.rolle]

<RollenSwitcher aktuelleRolle={user.rolle} verfuegbareRollen={verfuegbareRollen} />
```

### Phase O3 — Existing Chip-Buttons entfernen (~15 min)

Im Admin-Dashboard oder wo immer aktuell „Verwalter | HW | Mieter"-Chips sind: raus.

### Phase O4 — A11y-Polish (~15 min)

- ESC schließt Dropdown
- Click outside schließt Dropdown
- Keyboard-Navigation (Pfeil-runter, Enter)

### Phase O5 — Smoke-Test + Commit

Login als Admin → Dropdown sichtbar → Wechsel zu Verwalter → URL ändert sich → Reload-festigkeit (Dropdown zeigt Verwalter aktiv).
Login als HW → kein Dropdown sichtbar (nur 1 Rolle).

`feat(layout): Rollen-Switcher als Dropdown (Sprint O)`

## Constraints

- Auth-Context nicht anfassen — nur Display-Switch
- Für non-Admin: Switcher unsichtbar (kein angedeutetes „du hättest Zugriff aber nicht"-Erlebnis)
- Pricing-Engine nicht anfassen

## Erfolg

- Admin wechselt in 1 Klick zwischen den 4 Dashboards
- Normale User sehen die Komplexität nicht
- A11y vollständig (Keyboard + ARIA)

## Erster Schritt

Phase O1: Komponente bauen + lokal mit Mock-Props testen.
