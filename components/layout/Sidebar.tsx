"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Rolle } from "@/types"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const menus: Record<Rolle, { href: string; label: string; icon: string }[]> = {
  verwalter: [
    { href: "/dashboard-verwalter", label: "Dashboard", icon: "⬡" },
    { href: "/dashboard-verwalter/tickets", label: "Tickets", icon: "◉" },
    { href: "/dashboard-verwalter/neues-ticket", label: "Neues Ticket", icon: "＋" },
    { href: "/dashboard-verwalter/marktplatz", label: "Marktplatz", icon: "⚡" },
    { href: "/dashboard-verwalter/handwerker", label: "Handwerker", icon: "⛭" },
    { href: "/dashboard-verwalter/reporting", label: "Reporting", icon: "◈" },
  ],
  handwerker: [
    { href: "/dashboard-handwerker", label: "Dashboard", icon: "⬡" },
    { href: "/dashboard-handwerker/einnahmen", label: "Einnahmen", icon: "€" },
    { href: "/dashboard-handwerker/zeitslots", label: "Zeitslots", icon: "▦" },
    { href: "/dashboard-handwerker/auftraege", label: "Aufträge", icon: "◉" },
    { href: "/dashboard-handwerker/termine", label: "Termine & Route", icon: "📍" },
    { href: "/dashboard-handwerker/kalender", label: "Verfügbarkeit", icon: "▤" },
    { href: "/dashboard-handwerker/profil", label: "Mein Profil", icon: "◎" },
  ],
  mieter: [
    { href: "/dashboard-mieter", label: "Übersicht", icon: "⬡" },
    { href: "/dashboard-mieter/melden", label: "Schaden melden", icon: "＋" },
    { href: "/dashboard-mieter/tickets", label: "Meine Tickets", icon: "◉" },
  ],
  admin: [
    { href: "/dashboard-admin", label: "Dashboard", icon: "⬡" },
    { href: "/dashboard-verwalter", label: "Verwaltung", icon: "◈" },
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
        <div className="text-2xl font-bold tracking-tight">
          <span className="text-[#2D2A26]">Re</span>
          <span className="text-[#3D8B7A]">paro</span>
        </div>
        <div className="text-[11px] text-[#8C857B] mt-1 font-medium uppercase tracking-widest">
          {rolleLabels[rolle]}
        </div>
      </Link>

      <div className="px-3 mb-2">
        <div className="h-px bg-[#EDE8E1]" />
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
                  ? "text-[#3D8B7A] bg-[#3D8B7A]/8 border border-[#3D8B7A]/15"
                  : "text-[#6B665E] hover:text-[#2D2A26] hover:bg-[#F5F0EB]"
              }`}
            >
              <span className={`w-5 text-center text-sm ${active ? "text-[#3D8B7A]" : "text-[#8C857B]"}`}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 mb-2">
        <div className="h-px bg-[#EDE8E1]" />
      </div>

      <div className="p-4">
        <button
          onClick={handleLogout}
          className="w-full text-left text-xs text-[#8C857B] hover:text-[#C4574B] py-2 px-3 rounded-lg hover:bg-[#C4574B]/5 transition-all font-medium"
        >
          ← Abmelden
        </button>
        <div className="mt-3 flex gap-3 px-3 text-[11px] text-[#A8A29A]">
          <Link
            href="/impressum"
            onClick={() => setMobileOpen(false)}
            className="hover:text-[#2D2A26] transition-colors"
          >
            Impressum
          </Link>
          <Link
            href="/datenschutz"
            onClick={() => setMobileOpen(false)}
            className="hover:text-[#2D2A26] transition-colors"
          >
            Datenschutz
          </Link>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white border border-[#EDE8E1] rounded-xl flex items-center justify-center text-[#2D2A26] hover:bg-[#F5F0EB] transition-all shadow-sm"
        aria-label="Menu"
      >
        {mobileOpen ? (
          <span className="text-lg">✕</span>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="w-4 h-0.5 bg-[#2D2A26] rounded-full" />
            <div className="w-3 h-0.5 bg-[#8C857B] rounded-full" />
            <div className="w-4 h-0.5 bg-[#2D2A26] rounded-full" />
          </div>
        )}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-[#2D2A26]/30 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-white border-r border-[#EDE8E1] flex-col min-h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar (slide-in) */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-full w-64 bg-white border-r border-[#EDE8E1] flex flex-col z-50 transform transition-transform duration-300 shadow-xl ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
