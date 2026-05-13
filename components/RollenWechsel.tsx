"use client"

import { useRouter } from "next/navigation"
import { useActiveRole } from "@/lib/context/ActiveRoleContext"

// Toggle zwischen Verwaltungs- und Handwerker-Sicht. Sichtbar nur für
// Admins (profiles.rolle === 'admin'). Beim Wechsel wird auf die
// passende Dashboard-Route navigiert und die Rolle im Query gemerkt.
export function RollenWechsel() {
  const router = useRouter()
  const { rolle, setRolle, istAdmin } = useActiveRole()
  if (!istAdmin) return null

  function wechsel(neu: "verwaltung" | "handwerker") {
    if (neu === rolle) return
    setRolle(neu)
    router.push(neu === "handwerker" ? "/dashboard-handwerker" : "/dashboard-verwalter")
  }

  return (
    <div
      className="inline-flex items-center gap-1 bg-white border border-[#EDE8E1] rounded-full p-1 shadow-sm"
      role="radiogroup"
      aria-label="Aktive Sicht"
    >
      <button
        type="button"
        role="radio"
        aria-checked={rolle === "verwaltung"}
        onClick={() => wechsel("verwaltung")}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          rolle === "verwaltung"
            ? "bg-[#3D8B7A] text-white"
            : "text-[#6B665E] hover:text-[#2D2A26]"
        }`}
      >
        Verwaltung
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={rolle === "handwerker"}
        onClick={() => wechsel("handwerker")}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          rolle === "handwerker"
            ? "bg-[#C4956A] text-white"
            : "text-[#6B665E] hover:text-[#2D2A26]"
        }`}
      >
        Handwerker
      </button>
    </div>
  )
}
