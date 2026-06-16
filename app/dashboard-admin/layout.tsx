"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { ActiveRoleProvider } from "@/lib/context/ActiveRoleContext"
import { RollenWechsel } from "@/components/RollenWechsel"
import BottomNav from "@/components/layout/BottomNav"
import { LayoutDashboard, Users, Activity, Settings, LogOut, MessageSquare } from "lucide-react"

// UX-Konsistenz (Sprint A, fee57a75): Admin-Sidebar muss die Items aus
// der Mobile-BottomNav alle enthalten — sonst verliert der Admin beim
// Geräte-Wechsel die Orientierung. "Feedback" war bisher nur in der
// BottomNav. Reihenfolge: die vier BottomNav-Items zuerst (Übersicht /
// Feedback / Nutzer / System), dann die zusätzlichen Desktop-Items.
const NAV_ITEMS = [
  { label: "Übersicht", href: "/dashboard-admin", Icon: LayoutDashboard },
  { label: "Feedback", href: "/dashboard-admin/feedback", Icon: MessageSquare },
  { label: "Nutzer", href: "/dashboard-admin/nutzer", Icon: Users },
  { label: "System", href: "/dashboard-admin/system", Icon: Settings },
  { label: "Aktivität", href: "/dashboard-admin/aktivitaet", Icon: Activity },
  // Sprint AU F21: Diagnose-Preise ist obsolet (Sprint R Phase 22) — Nav-Item entfernt.
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
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent/20 border-t-[#3D8B7A] rounded-full animate-spin" />
    </div>
  )

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-line">
        <div className="text-xl tracking-tight text-ink">Repa<span className="text-accent">ro</span></div>
        <div className="text-[10px] font-bold text-rolle-admin uppercase tracking-widest mt-1">Admin Panel</div>
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
                  ? "bg-rolle-admin text-white shadow-sm"
                  : "text-ink-secondary hover:text-ink hover:bg-surface-muted"
              }`}>
              <item.Icon size={16} className={aktiv ? "text-white" : "text-ink-muted"} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="p-3 border-t border-line">
        <button
          onClick={async () => { const s = createClient(); await s.auth.signOut(); router.push("/login") }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-ink-muted hover:text-danger hover:bg-danger/5 transition-all">
          <LogOut size={16} />
          <span>Abmelden</span>
        </button>
        <div className="mt-3 flex gap-3 px-3 text-[11px] text-ink-muted">
          <a href="/impressum" className="hover:text-ink transition-colors">Impressum</a>
          <a href="/agb" className="hover:text-ink transition-colors">AGB</a>
          <a href="/datenschutz" className="hover:text-ink transition-colors">Datenschutz</a>
        </div>
      </div>
    </>
  )

  return (
    <ActiveRoleProvider istAdmin={true} defaultRolle="admin">
      <div className="flex min-h-screen bg-surface">
        {/* Mobile Hamburger — z-[60], damit der ✕-Button über der
            offenen Sidebar (z-50) klickbar bleibt. Sonst überdeckt die
            Sidebar (später im DOM, gleicher z-index) den Toggle.
            Offener Zustand: anderer Hintergrund, sonst weiß-auf-weiß. */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className={`md:hidden fixed top-4 left-4 z-[60] w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${
            mobileOpen
              ? "bg-surface-muted border border-line-strong text-ink"
              : "bg-white border border-line text-ink hover:bg-surface-muted"
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
        <aside className="hidden md:flex w-56 bg-white border-r border-line flex-col">
          {sidebarContent}
        </aside>

        {/* Mobile Sidebar (slide-in) — max 85vw, sonst füllt sie auf
            390px-Screens fast den ganzen Viewport. */}
        <aside
          className={`md:hidden fixed left-0 top-0 h-full w-[min(20rem,85vw)] bg-white border-r border-line flex flex-col z-50 transform transition-transform duration-300 shadow-xl ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </aside>

        <main id="main-content" className="flex-1 overflow-auto overflow-x-hidden min-w-0 pb-16 md:pb-0">{children}</main>
        <BottomNav rolle="admin" />
      </div>
    </ActiveRoleProvider>
  )
}
