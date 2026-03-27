"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Rolle } from "@/types"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const menus: Record<Rolle, { href: string; label: string; icon: string }[]> = {
  verwalter: [
    { href: "/dashboard-verwalter", label: "Dashboard", icon: "◈" },
    { href: "/dashboard-verwalter/tickets", label: "Tickets", icon: "🎫" },
    { href: "/dashboard-verwalter/neues-ticket", label: "Neues Ticket", icon: "+" },
    { href: "/dashboard-verwalter/handwerker", label: "Handwerker", icon: "🔧" },
    { href: "/dashboard-verwalter/reporting", label: "Reporting", icon: "◉" },
  ],
  handwerker: [
    { href: "/dashboard-handwerker", label: "Dashboard", icon: "◈" },
    { href: "/dashboard-handwerker/auftraege", label: "Aufträge", icon: "📋" },
    { href: "/dashboard-handwerker/profil", label: "Mein Profil", icon: "◎" },
  ],
  mieter: [
    { href: "/dashboard-mieter", label: "Übersicht", icon: "◈" },
    { href: "/dashboard-mieter/melden", label: "Schaden melden", icon: "+" },
    { href: "/dashboard-mieter/tickets", label: "Meine Tickets", icon: "🎫" },
  ],
  admin: [
    { href: "/admin", label: "Rollenwechsel", icon: "⚙" },
  ],
}

export default function Sidebar({ rolle }: { rolle: Rolle }) {
  const pathname = usePathname()
  const router = useRouter()
  const items = menus[rolle] || []

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside className="w-52 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col min-h-screen">
      <div className="p-5 border-b border-gray-100">
        <div className="logo text-xl">Craft<span className="text-[#1D9E75]">ly</span></div>
        <div className="text-xs text-gray-400 mt-0.5 capitalize">{rolle}</div>
      </div>
      <nav className="flex-1 py-3">
        {items.map(item => {
          const active = pathname === item.href || (item.href !== "/dashboard-verwalter" && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all border-l-2 ${
                active
                  ? "text-[#1D9E75] border-[#1D9E75] bg-[#E1F5EE]"
                  : "text-gray-500 border-transparent hover:bg-gray-50 hover:text-gray-800"
              }`}>
              <span className="w-5 text-center text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <button onClick={handleLogout}
          className="w-full text-left text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors">
          Abmelden
        </button>
      </div>
    </aside>
  )
}
