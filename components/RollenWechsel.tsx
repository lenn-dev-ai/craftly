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
  { rolle: "verwaltung", label: "Verwaltung", ziel: "/dashboard-verwalter", aktivCls: "bg-[#3D8B7A] text-white" },
  { rolle: "handwerker", label: "Handwerker", ziel: "/dashboard-handwerker", aktivCls: "bg-[#C4956A] text-white" },
  { rolle: "mieter",     label: "Mieter",     ziel: "/dashboard-mieter",     aktivCls: "bg-[#5B6ABF] text-white" },
]

export function RollenWechsel() {
  const { rolle, istAdmin } = useActiveRole()
  if (!istAdmin) return null

  function wechsel(opt: typeof OPTIONEN[number]) {
    if (opt.rolle === rolle) return
    window.location.href = opt.ziel
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 bg-white border border-[#EDE8E1] rounded-full p-0.5 shadow-sm"
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
            className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
              aktiv ? opt.aktivCls : "text-[#6B665E] hover:text-[#2D2A26]"
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
