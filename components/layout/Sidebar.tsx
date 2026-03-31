"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Role } from "@/types"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const menus: Record<Role, { href: string; label: string; icon: string }[]> = {
  verwalter: [
    { href: "/dashboard-verwalter", label: "Dashboard", icon: "📊" },
    { href: "/dashboard-verwalter/tickets", label: "Tickets", icon: "🎫" },
    { href: "/dashboard-verwalter/neues-ticket", label: "Neues Ticket", icon: "✚" },
    { href: "/dashboard-verwalter/handwerker", label: "Handwerker", icon: "🔧" },
    { href: "/dashboard-verwalter/reporting", label: "Reporting", icon: "📈" },
  ],
  handwerker: [
    { href: "/dashboard-handwerker", label: "Dashboard", icon: "📊" },
    { href: "/dashboard-handwerker/auftraege", label: "Aufträge", icon: "📋" },
    { href: "/dashboard-handwerker/verfuegbarkeit", label: "Verfügbarkeit", icon: "📅" },
    { href: "/dashboard-handwerker/profil", label: "Mein Profil", icon: "👤" },
  ],
  mieter: [
    { href: "/dashboard-mieter", label: "Übersicht", icon: "📊" },
    { href: "/dashboard-mieter/melden", label: "Schaden melden", icon: "✚" },
    { href: "/dashboard-mieter/tickets", label: "Meine Tickets", icon: "🎫" },
  ],
  admin: [
    { href: "/admin", label: "Rollenwechsel", icon: "🔄" },
  ],
}

export default function Sidebar({ rolle }: { rolle: Role }) {
  const pathname = usePathname()
  const router = useRouter()
  const items = menus[rolle] || []

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside className="w-56 flex-shrink-0 border-r border-[var(--border)] bg-white flex flex-col min-h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-[var(--border)]">
        <div className="logo text-2xl tracking-tight">
          Craft<span className="text-[var(--green)]">ly</span>
        </div>
        <div className="text-[11px] font-semibold text-[var(--text-muted)] mt-1 uppercase tracking-widest">
          {rolle}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3">
        <div className="flex flex-col gap-1">
          {items.map(item => {
            const active = pathname === item.href
              || (item.href !== `/dashboard-${rolle}` && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium rounded-xl transition-all ${
                  active
                    ? "text-[var(--green-dark)] bg-[var(--green-light)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                }`}>
                <span className="w-5 text-center text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border)]">
        <button onClick={handleLogout}
          className="w-full text-left text-[12px] font-medium text-[var(--text-muted)] hover:text-red-500 py-2 px-3 rounded-lg hover:bg-red-50 transition-all">
          Abmelden
        </button>
      </div>
    </aside>
  )
}
