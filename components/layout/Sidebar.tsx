"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Rolle } from "@/types"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const menus: Record<Rolle, { href: string; label: string; icon: string }[]> = {
  verwalter: [
    { href: "/dashboard-verwalter", label: "Dashboard", icon: "⬡" },
    { href: "/dashboard-verwalter/tickets", label: "Tickets", icon: "◉" },
    { href: "/dashboard-verwalter/neues-ticket", label: "Neues Ticket", icon: "＋" },
    { href: "/dashboard-verwalter/handwerker", label: "Handwerker", icon: "⚡" },
    { href: "/dashboard-verwalter/reporting", label: "Reporting", icon: "◈" },
  ],
  handwerker: [
    { href: "/dashboard-handwerker", label: "Dashboard", icon: "⬡" },
    { href: "/dashboard-handwerker/auftraege", label: "Aufträge", icon: "◉" },
    { href: "/dashboard-handwerker/kalender", label: "Kalender", icon: "▦" },
    { href: "/dashboard-handwerker/profil", label: "Mein Profil", icon: "◎" },
  ],
  mieter: [
    { href: "/dashboard-mieter", label: "Übersicht", icon: "⬡" },
    { href: "/dashboard-mieter/melden", label: "Schaden melden", icon: "＋" },
    { href: "/dashboard-mieter/tickets", label: "Meine Tickets", icon: "◉" },
  ],
}

const rolleLabels: Record<Rolle, string> = {
  verwalter: "Verwaltung",
  handwerker: "Handwerker",
  mieter: "Mieter",
}

export default function Sidebar({ rolle }: { rolle: Rolle }) {
  const pathname = usePathname()
  const router = useRouter()
  const items = menus[rolle] || []

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <aside className="w-56 flex-shrink-0 bg-[#08080d] border-r border-white/[0.04] flex flex-col min-h-screen">
      <div className="p-5 pb-4">
        <div className="logo text-2xl">
          <span className="text-white">Craft</span>
          <span className="gradient-text">ly</span>
        </div>
        <div className="text-[11px] text-gray-600 mt-1 font-medium uppercase tracking-widest">{rolleLabels[rolle]}</div>
      </div>

      <div className="px-3 mb-2">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      <nav className="flex-1 px-2 py-1">
        {items.map(item => {
          const active = pathname === item.href || (item.href !== "/dashboard-" + rolle && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 text-[13px] font-medium rounded-xl mb-0.5 transition-all ${
                active
                  ? "text-white bg-gradient-to-r from-[#00D4AA]/15 to-[#00B4D8]/10 border border-[#00D4AA]/20 shadow-sm shadow-[#00D4AA]/5"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
              }`}>
              <span className={`w-5 text-center text-sm ${active ? "text-[#00D4AA]" : ""}`}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 mb-2">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      <div className="p-4">
        <button onClick={handleLogout}
          className="w-full text-left text-xs text-gray-600 hover:text-gray-400 py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-all font-medium">
          ← Abmelden
        </button>
      </div>
    </aside>
  )
}
