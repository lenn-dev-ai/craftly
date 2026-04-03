"use client"

import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Home, User, LogOut } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Rolle } from "@/types"

const DASHBOARD_MAP: Record<Rolle, string> = {
  verwalter: "/dashboard-verwalter",
  handwerker: "/dashboard-handwerker",
  mieter: "/dashboard-mieter",
  admin: "/dashboard-admin",
}

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState("")
  const [dashboardPath, setDashboardPath] = useState("/login")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, rolle")
        .eq("id", user.id)
        .single()

      if (profile) {
        setUserName(profile.name?.split(" ")[0] || "")
        setDashboardPath(DASHBOARD_MAP[profile.rolle as Rolle] || "/login")
      }
    }
    load()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  const isActive = (href: string) => pathname.startsWith(href)

  if (pathname === "/login" || pathname === "/registrierung") return null

  return (
    <>
      {/* Desktop: Top Navigation */}
      <header className="sticky top-0 z-50 bg-[#12121a]/80 backdrop-blur-xl border-b border-white/[0.06] hidden md:block">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex justify-between items-center h-14">
            <Link href={dashboardPath} className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 bg-gradient-to-br from-[#00D4AA] to-[#00B4D8] rounded-lg flex items-center justify-center font-bold text-[#0a0a0f] text-xs">
                R
              </div>
              <span className="logo text-lg">
                <span className="text-white group-hover:text-[#00D4AA] transition-colors">Repa</span>
                <span className="gradient-text">ro</span>
              </span>
            </Link>

            <nav className="flex items-center gap-1" aria-label="Hauptnavigation">
              <Link
                href={dashboardPath}
                className={"flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors " +
                  (isActive("/dashboard") ? "text-[#00D4AA] bg-[#00D4AA]/10" : "text-gray-400 hover:text-gray-200 hover:bg-white/5")}
              >
                <Home size={16} />
                Dashboard
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              {userName && (
                <span className="text-gray-500 text-xs">{userName}</span>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                aria-label="Abmelden"
              >
                <LogOut size={14} />
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile: Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#12121a]/90 backdrop-blur-xl border-t border-white/[0.06] md:hidden safe-area-bottom"
        aria-label="Mobile Navigation"
      >
        <div className="flex items-center h-16 px-6">
          <Link
            href={dashboardPath}
            className={"flex-1 flex flex-col items-center gap-0.5 py-2 " +
              (isActive("/dashboard") ? "text-[#00D4AA]" : "text-gray-500")}
          >
            <Home size={20} />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link
            href={dashboardPath + "/profil"}
            className={"flex-1 flex flex-col items-center gap-0.5 py-2 " +
              (pathname.includes("/profil") ? "text-[#00D4AA]" : "text-gray-500")}
          >
            <User size={20} />
            <span className="text-[10px] font-medium">Profil</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center gap-0.5 py-2 text-gray-500 hover:text-red-400"
            aria-label="Abmelden"
          >
            <LogOut size={20} />
            <span className="text-[10px] font-medium">Logout</span>
          </button>
        </div>
      </nav>
    </>
  )
}
