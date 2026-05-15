"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { ActiveRoleProvider } from "@/lib/context/ActiveRoleContext"
import { RollenWechsel } from "@/components/RollenWechsel"
import { LayoutDashboard, Users, Activity, Settings, LogOut, Stethoscope } from "lucide-react"

const NAV_ITEMS = [
  { label: "Übersicht", href: "/dashboard-admin", Icon: LayoutDashboard },
  { label: "Nutzer", href: "/dashboard-admin/nutzer", Icon: Users },
  { label: "Aktivität", href: "/dashboard-admin/aktivitaet", Icon: Activity },
  { label: "Diagnose-Preise", href: "/dashboard-admin/diagnose-preise", Icon: Stethoscope },
  { label: "System", href: "/dashboard-admin/system", Icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data: profile } = await supabase.from("profiles").select("rolle").eq("id", user.id).single()
      if (profile?.rolle !== "admin") { router.push("/login"); return }
      setAuthorized(true)
    }
    check()
  }, [router])

  // Sidebar bei Routenwechsel auf Mobile schließen
  useEffect(() => { setMobileOpen(false) }, [pathname])

  if (!authorized) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#3D8B7A]/20 border-t-[#3D8B7A] rounded-full animate-spin" />
    </div>
  )

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-[#EDE8E1]">
        <div className="text-xl tracking-tight text-[#2D2A26]">Repa<span className="text-[#3D8B7A]">ro</span></div>
        <div className="text-[10px] font-bold text-[#7C6CAB] uppercase tracking-widest mt-1">Admin Panel</div>
      </div>

      <div className="px-3 pt-3 pb-1">
        <RollenWechsel />
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const aktiv = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => {
                // Sidebar sofort schließen — wenn man bereits auf der Route
                // ist, feuert der pathname-useEffect sonst nicht.
                setMobileOpen(false)
                router.push(item.href)
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                aktiv
                  ? "bg-[#7C6CAB] text-white shadow-sm"
                  : "text-[#6B665E] hover:text-[#2D2A26] hover:bg-[#F5F0EB]"
              }`}>
              <item.Icon size={16} className={aktiv ? "text-white" : "text-[#8C857B]"} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="p-3 border-t border-[#EDE8E1]">
        <button
          onClick={async () => { const s = createClient(); await s.auth.signOut(); router.push("/login") }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#8C857B] hover:text-[#C4574B] hover:bg-[#C4574B]/5 transition-all">
          <LogOut size={16} />
          <span>Abmelden</span>
        </button>
        <div className="mt-3 flex gap-3 px-3 text-[11px] text-[#A8A29A]">
          <a href="/impressum" className="hover:text-[#2D2A26] transition-colors">Impressum</a>
          <a href="/agb" className="hover:text-[#2D2A26] transition-colors">AGB</a>
          <a href="/datenschutz" className="hover:text-[#2D2A26] transition-colors">Datenschutz</a>
        </div>
      </div>
    </>
  )

  return (
    <ActiveRoleProvider istAdmin={true} defaultRolle="admin">
      <div className="flex min-h-screen bg-[#FAF8F5]">
        {/* Mobile Hamburger — z-[60], damit der ✕-Button über der
            offenen Sidebar (z-50) klickbar bleibt. Sonst überdeckt die
            Sidebar (später im DOM, gleicher z-index) den Toggle.
            Offener Zustand: anderer Hintergrund, sonst weiß-auf-weiß. */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className={`md:hidden fixed top-4 left-4 z-[60] w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${
            mobileOpen
              ? "bg-[#F5F0EB] border border-[#D5CFC7] text-[#2D2A26]"
              : "bg-white border border-[#EDE8E1] text-[#2D2A26] hover:bg-[#F5F0EB]"
          }`}
          aria-label={mobileOpen ? "Admin-Menü schließen" : "Admin-Menü öffnen"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <span className="text-xl font-bold">✕</span>
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
        <aside className="hidden md:flex w-56 bg-white border-r border-[#EDE8E1] flex-col">
          {sidebarContent}
        </aside>

        {/* Mobile Sidebar (slide-in) — max 85vw, sonst füllt sie auf
            390px-Screens fast den ganzen Viewport. */}
        <aside
          className={`md:hidden fixed left-0 top-0 h-full w-[min(20rem,85vw)] bg-white border-r border-[#EDE8E1] flex flex-col z-50 transform transition-transform duration-300 shadow-xl ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </aside>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </ActiveRoleProvider>
  )
}
