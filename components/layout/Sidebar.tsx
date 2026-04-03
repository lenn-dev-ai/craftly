"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Rolle } from "@/types"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const menus: Record<Rolle, { href: string; label: string; icon: string }[]> = {
  verwalter: [
    { href: "/dashboard-verwalter", label: "Dashboard", icon: "â¬¡" },
    { href: "/dashboard-verwalter/tickets", label: "Tickets", icon: "â" },
    { href: "/dashboard-verwalter/neues-ticket", label: "Neues Ticket", icon: "ï¼" },
    { href: "/dashboard-verwalter/marktplatz", label: "Marktplatz", icon: "â¡" },
    { href: "/dashboard-verwalter/handwerker", label: "Handwerker", icon: "â­" },
    { href: "/dashboard-verwalter/reporting", label: "Reporting", icon: "â" },
  ],
  handwerker: [
    { href: "/dashboard-handwerker", label: "Dashboard", icon: "â¬¡" },
    { href: "/dashboard-handwerker/einnahmen", label: "Einnahmen", icon: "â¬" },
    { href: "/dashboard-handwerker/zeitslots", label: "Zeitslots", icon: "â¦" },
    { href: "/dashboard-handwerker/auftraege", label: "AuftrÃ¤ge", icon: "â" },
    { href: "/dashboard-handwerker/kalender", label: "Kalender", icon: "â¤" },
    { href: "/dashboard-handwerker/profil", label: "Mein Profil", icon: "â" },
  ],
  mieter: [
    { href: "/dashboard-mieter", label: "Ãbersicht", icon: "â¬¡" },
    { href: "/dashboard-mieter/melden", label: "Schaden melden", icon: "ï¼" },
    { href: "/dashboard-mieter/tickets", label: "Meine Tickets", icon: "â" },
  ],
  admin: [
    { href: "/dashboard-admin", label: "Dashboard", icon: "â¬¡" },
    { href: "/dashboard-verwalter", label: "Verwaltung", icon: "â" },
  ],
}

const rolleLabels: Record<Rolle, string> = {
  verwalter: "Verwaltung",
  handwerker: "Handwerker",
  mieter: "Mieter",
  admin: "Admin",
}

const dashboardLinks: Record<Rolle, string> = {
  verwalter: "/dashboard-verwalter",
  handwerker: "/dashboard-handwerker",
  mieter: "/dashboard-mieter",
  admin: "/dashboard-admin",
}

export default function Sidebar({ rolle }: { rolle: Rolle }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const items = menus[rolle] || []

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const sidebarContent = (
    <>
      <Link
        href={dashboardLinks[rolle]}
        className="block p-5 pb-4 hover:opacity-80 transition-opacity cursor-pointer"
        onClick={() => setMobileOpen(false)}
      >
        <div className="logo text-2xl">
          <span className="text-white">Craft</span>
          <span className="gradient-text">ly</span>
        </div>
        <div className="text-[11px] text-gray-600 mt-1 font-medium uppercase tracking-widest">
          {rolleLabels[rolle]}
        </div>
      </Link>

      <div className="px-3 mb-2">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      <nav className="flex-1 px-2 py-1">
        {items.map(item => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard-" + rolle && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-medium rounded-xl mb-0.5 transition-all ${
                active
                  ? "text-white bg-gradient-to-r from-[#00D4AA]/15 to-[#00B4D8]/10 border border-[#00D4AA]/20 shadow-sm shadow-[#00D4AA]/5"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
              }`}
            >
              <span className={`w-5 text-center text-sm ${active ? "text-[#00D4AA]" : ""}`}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 mb-2">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      <div className="p-4">
        <button
          onClick={handleLogout}
          className="w-full text-left text-xs text-gray-600 hover:text-gray-400 py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-all font-medium"
        >
          â Abmelden
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-[#12121a] border border-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all"
        aria-label="Menu"
      >
        {mobileOpen ? (
          <span className="text-lg">â</span>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="w-4 h-0.5 bg-white rounded-full" />
            <div className="w-3 h-0.5 bg-white/60 rounded-full" />
            <div className="w-4 h-0.5 bg-white rounded-full" />
          </div>
        )}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-[#08080d] border-r border-white/[0.04] flex-col min-h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar (slide-in) */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-full w-64 bg-[#08080d] border-r border-white/[0.04] flex flex-col z-50 transform transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
