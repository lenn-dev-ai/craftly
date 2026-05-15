"use client"

import { useActiveRole, type ActiveRolle } from "@/lib/context/ActiveRoleContext"

// Toggle zwischen Verwaltungs-, Handwerker- und Mieter-Sicht. Sichtbar
// nur für Admins (profiles.rolle === 'admin').
//
// Hard-Navigation via window.location: Soft-Navigation mit router.push
// hatte beim Sibling-Layout-Wechsel (verwalter ↔ handwerker) den Effekt,
// dass Sidebar/ActiveRoleProvider den alten State behielt. Hard-Reload
// mountet alles frisch — Auth ist via Cookie, daher kein Round-Trip-Kost.

const OPTIONEN: Array<{
  rolle: ActiveRolle
  label: string
  ziel: string
  aktivCls: string
}> = [
  { rolle: "admin",      label: "Admin",      ziel: "/dashboard-admin",     aktivCls: "bg-rolle-admin text-white" },
  { rolle: "verwaltung", label: "Verwaltung", ziel: "/dashboard-verwalter", aktivCls: "bg-accent text-white" },
  { rolle: "handwerker", label: "Handwerker", ziel: "/dashboard-handwerker", aktivCls: "bg-warm text-white" },
  { rolle: "mieter",     label: "Mieter",     ziel: "/dashboard-mieter",     aktivCls: "bg-rolle-mieter text-white" },
]

export function RollenWechsel() {
  const { rolle, istAdmin } = useActiveRole()
  if (!istAdmin) return null

  function wechsel(opt: typeof OPTIONEN[number]) {
    if (opt.rolle === rolle) return
    window.location.href = opt.ziel
  }

  return (
    <div className="w-full">
      <div className="text-[9px] font-bold uppercase tracking-wider text-ink-muted mb-1.5 px-1">
        Sicht wechseln
      </div>
      <div
        className="grid grid-cols-2 gap-1 bg-white border border-line rounded-xl p-1 shadow-sm"
        role="radiogroup"
        aria-label="Aktive Sicht"
      >
        {OPTIONEN.map(opt => {
          const aktiv = rolle === opt.rolle
          return (
            <button
              key={opt.rolle}
              type="button"
              role="radio"
              aria-checked={aktiv}
              onClick={() => wechsel(opt)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all text-center ${
                aktiv ? opt.aktivCls : "text-ink-secondary hover:text-ink hover:bg-surface-muted"
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
