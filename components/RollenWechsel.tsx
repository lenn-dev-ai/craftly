"use client"

import { useActiveRole, type ActiveRolle } from "@/lib/context/ActiveRoleContext"
import { useEffect, useRef, useState } from "react"
import { ChevronDown, Check } from "lucide-react"

// Sprint O — Rollen-Switcher als Dropdown (vorher: 2×2-Grid Chips).
//
// Sichtbar nur für Admins (profiles.rolle === 'admin'). Normale User
// haben nur 1 Rolle → kein Switcher.
//
// Hard-Navigation via window.location: Soft-Navigation mit router.push
// hatte beim Sibling-Layout-Wechsel (verwalter ↔ handwerker) den Effekt,
// dass Sidebar/ActiveRoleProvider den alten State behielt. Hard-Reload
// mountet alles frisch — Auth ist via Cookie, daher kein Round-Trip-Kost.
//
// A11y: aria-expanded/haspopup auf Trigger, role="menu" auf Liste,
// role="menuitem" pro Eintrag. ESC + Click-Outside schließen. Erste
// Auswahl per Auto-Focus erhält initial den Tastatur-Fokus.

const OPTIONEN: Array<{
  rolle: ActiveRolle
  label: string
  ziel: string
  dotCls: string
}> = [
  { rolle: "admin",      label: "Admin",      ziel: "/dashboard-admin",      dotCls: "bg-rolle-admin" },
  { rolle: "verwaltung", label: "Verwaltung", ziel: "/dashboard-verwalter",  dotCls: "bg-accent" },
  { rolle: "handwerker", label: "Handwerker", ziel: "/dashboard-handwerker", dotCls: "bg-warm" },
  { rolle: "mieter",     label: "Mieter",     ziel: "/dashboard-mieter",     dotCls: "bg-rolle-mieter" },
]

export function RollenWechsel() {
  const { rolle, istAdmin } = useActiveRole()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)

  // Click-Outside + ESC schließen
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    // Fokus auf ersten Menüpunkt beim Öffnen
    firstItemRef.current?.focus()
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  if (!istAdmin) return null

  const aktuell = OPTIONEN.find(o => o.rolle === rolle) ?? OPTIONEN[0]

  function wechsel(opt: typeof OPTIONEN[number]) {
    setOpen(false)
    if (opt.rolle === rolle) return
    window.location.href = opt.ziel
  }

  return (
    <div className="w-full" ref={containerRef}>
      <div className="text-[9px] font-bold uppercase tracking-wider text-ink-muted mb-1.5 px-1">
        Sicht wechseln
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Aktive Sicht: ${aktuell.label}. Klick zum Wechseln.`}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-line shadow-sm hover:border-accent/30 transition focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-ink truncate">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${aktuell.dotCls}`} aria-hidden="true" />
            {aktuell.label}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-ink-muted flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        {open && (
          <div
            role="menu"
            aria-label="Rollen-Auswahl"
            className="absolute left-0 right-0 mt-1 bg-white border border-line rounded-xl shadow-lg z-50 overflow-hidden"
          >
            {OPTIONEN.map((opt, idx) => {
              const aktiv = opt.rolle === rolle
              return (
                <button
                  key={opt.rolle}
                  ref={idx === 0 ? firstItemRef : undefined}
                  role="menuitem"
                  type="button"
                  onClick={() => wechsel(opt)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-surface-muted focus:bg-surface-muted focus:outline-none ${
                    aktiv ? "font-semibold text-ink" : "text-ink-secondary"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dotCls}`} aria-hidden="true" />
                  <span className="flex-1">{opt.label}</span>
                  {aktiv && <Check className="w-4 h-4 text-accent" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
