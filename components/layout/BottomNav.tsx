"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { type ComponentType } from "react"
import { Rolle } from "@/types"
import {
  LayoutDashboard, Briefcase, Stethoscope, Map, UserCircle,
  Plus, FileText, Ticket, Zap, Wrench, BarChart3, Settings, Activity, Users,
  type LucideProps,
} from "lucide-react"

// Mobile-Bottom-Nav — Audit-Punkt 9.
// 4 Hauptactions pro Rolle direkt erreichbar, ohne Hamburger zu öffnen.
// Sichtbar nur unter md (sonst sitzt die Sidebar links).

type LucideIcon = ComponentType<LucideProps>

const items: Record<Rolle, { href: string; label: string; Icon: LucideIcon }[]> = {
  verwalter: [
    { href: "/dashboard-verwalter",            label: "Start",       Icon: LayoutDashboard },
    { href: "/dashboard-verwalter/tickets",    label: "Tickets",     Icon: Ticket },
    { href: "/dashboard-verwalter/marktplatz", label: "Markt",       Icon: Zap },
    { href: "/dashboard-verwalter/handwerker", label: "Handwerker",  Icon: Wrench },
  ],
  handwerker: [
    { href: "/dashboard-handwerker",           label: "Start",     Icon: LayoutDashboard },
    { href: "/dashboard-handwerker/auftraege", label: "Aufträge",  Icon: Briefcase },
    { href: "/dashboard-handwerker/diagnosen", label: "Diagnose",  Icon: Stethoscope },
    { href: "/dashboard-handwerker/karte",     label: "Karte",     Icon: Map },
  ],
  mieter: [
    { href: "/dashboard-mieter",         label: "Start",     Icon: LayoutDashboard },
    { href: "/dashboard-mieter/melden",  label: "Melden",    Icon: Plus },
    { href: "/dashboard-mieter/tickets", label: "Tickets",   Icon: FileText },
  ],
  admin: [
    { href: "/dashboard-admin",                 label: "Start",      Icon: LayoutDashboard },
    { href: "/dashboard-admin/nutzer",          label: "Nutzer",     Icon: Users },
    { href: "/dashboard-admin/aktivitaet",      label: "Aktivität",  Icon: Activity },
    { href: "/dashboard-admin/system",          label: "System",     Icon: Settings },
  ],
}

const aktivBg: Record<Rolle, string> = {
  verwalter:  "text-rolle-verwalter",
  handwerker: "text-rolle-handwerker",
  mieter:     "text-rolle-mieter",
  admin:      "text-rolle-admin",
}

export default function BottomNav({ rolle }: { rolle: Rolle }) {
  const pathname = usePathname()
  const list = items[rolle] || []
  const aktivColor = aktivBg[rolle]

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-card border-t border-line shadow-lg pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Hauptnavigation"
    >
      <div className={`grid ${list.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
        {list.map(item => {
          const aktiv =
            pathname === item.href ||
            (item.href !== "/dashboard-" + rolle && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                aktiv ? `${aktivColor} font-semibold` : "text-ink-muted hover:text-ink"
              }`}
              aria-current={aktiv ? "page" : undefined}
            >
              <item.Icon size={20} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
