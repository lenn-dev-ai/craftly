"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, type ComponentType } from "react"
import { Rolle } from "@/types"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { RollenWechsel } from "@/components/RollenWechsel"
import {
  LayoutDashboard, Ticket, Zap, Wrench, BarChart3,
  Euro, Calendar, Briefcase, MapPin, CalendarCheck, UserCircle,
  Plus, FileText, ShieldCheck, LogOut, Map, CalendarRange,
  Calculator, AlertTriangle, MessageSquare, Home,
  Users, Activity, Heart, Tag,
  type LucideProps,
} from "lucide-react"

type LucideIcon = ComponentType<LucideProps>

// F12: gruppe="selten" rutscht in eine eigene Untersektion "Mein Bereich"
// in der Sidebar. Hält die Hauptnavigation kurz, ohne Routen zu löschen.
type MenuItem = { href: string; label: string; Icon: LucideIcon; gruppe?: "selten" }

const menus: Record<Rolle, MenuItem[]> = {
  verwalter: [
    { href: "/dashboard-verwalter", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/dashboard-verwalter/tickets", label: "Tickets", Icon: Ticket },
    { href: "/dashboard-verwalter/marktplatz", label: "Marktplatz", Icon: Zap },
    { href: "/dashboard-verwalter/handwerker", label: "Handwerker", Icon: Wrench },
    { href: "/dashboard-verwalter/wohnungen", label: "Wohnungen", Icon: Home },
    { href: "/dashboard-verwalter/reporting", label: "Reporting", Icon: BarChart3 },
    // Sprint AD (Mieter-First-Pivot, 25.05.): Verwalter-Wizard ist
    // nicht mehr der primäre Eingabe-Pfad. Bleibt erreichbar für
    // Sonderfälle (Mieter ruft Verwalter direkt an), aber gruppiert
    // in "Mein Bereich" statt prominent als Top-Item.
    { href: "/dashboard-verwalter/neues-ticket", label: "Ticket telefonisch", Icon: Plus, gruppe: "selten" },
  ],
  handwerker: [
    // K2: Top-4 — was der HW täglich anfasst.
    // Kalender ersetzt Termine/Zeitplan/Zeitslots/Verfügbarkeit als
    // 3-Layer-Sicht. Auftrags-Routen bleiben erhalten, sind aber via
    // Klick im Kalender-Termin erreichbar — kein Top-Item mehr.
    { href: "/dashboard-handwerker", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/dashboard-handwerker/kalender", label: "Kalender", Icon: CalendarCheck },
    { href: "/dashboard-handwerker/karte", label: "Karte & Route", Icon: Map },
    { href: "/dashboard-handwerker/einnahmen", label: "Einnahmen", Icon: Euro },
    // Mein Bereich — Settings + sekundäre Detail-Listen. Audit-C2:
    // die Direct-Routen Aufträge / Diagnosen / Termine / Zeitslots
    // existieren als 89-645 LOC Pages und waren bisher nur per
    // Direct-URL erreichbar — jetzt explizit gruppiert, statt dunkle
    // Routen zu sein. zeitplan ist Redirect zum Kalender (Dupe).
    { href: "/dashboard-handwerker/auftraege", label: "Meine Aufträge", Icon: Briefcase, gruppe: "selten" },
    { href: "/dashboard-handwerker/termine", label: "Termin-Liste", Icon: Calendar, gruppe: "selten" },
    { href: "/dashboard-handwerker/zeitslots", label: "Zeitslots", Icon: CalendarRange, gruppe: "selten" },
    { href: "/dashboard-handwerker/diagnosen", label: "Diagnosen", Icon: FileText, gruppe: "selten" },
    { href: "/dashboard-handwerker/verdienst", label: "Verdienst-Rechner", Icon: Calculator, gruppe: "selten" },
    { href: "/dashboard-handwerker/profil", label: "Mein Profil", Icon: UserCircle, gruppe: "selten" },
  ],
  mieter: [
    { href: "/dashboard-mieter", label: "Meine Tickets", Icon: LayoutDashboard },
    { href: "/dashboard-mieter/melden", label: "Schaden melden", Icon: Plus },
    { href: "/dashboard-mieter/profil", label: "Mein Profil", Icon: UserCircle },
  ],
  admin: [
    { href: "/dashboard-admin", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/dashboard-admin/feedback", label: "Feedback", Icon: MessageSquare },
    { href: "/dashboard-admin/nutzer", label: "Nutzer", Icon: Users },
    { href: "/dashboard-admin/aktivitaet", label: "Aktivität", Icon: Activity },
    { href: "/dashboard-admin/system", label: "System-Health", Icon: Heart },
    // R22: Diagnose-Preise-Page gedroppt — Diagnose-Aufträge sind aus
    // dem Beta-Scope raus. Route bleibt als Redirect erhalten für alte
    // Bookmarks (siehe dashboard-admin/diagnose-preise/page.tsx).
    { href: "/dashboard-admin/penalties", label: "Penalties", Icon: AlertTriangle, gruppe: "selten" },
    { href: "/dashboard-verwalter", label: "Verwaltung wechseln", Icon: ShieldCheck, gruppe: "selten" },
  ],
}

// Tailwind-Klasse pro Rolle für aktiven Sidebar-Eintrag.
// Achtung: muss als statische Strings stehen, sonst purgt Tailwind sie.
const aktivBg: Record<Rolle, string> = {
  verwalter:  "bg-rolle-verwalter",
  handwerker: "bg-rolle-handwerker",
  mieter:     "bg-rolle-mieter",
  admin:      "bg-rolle-admin",
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

  // Hilfs-Renderer für eine Item-Liste (F12: für getrennte Top- und
  // "Mein Bereich"-Sektion). Active-Logik bleibt unverändert.
  function renderItems(list: MenuItem[]) {
    return list.map(item => {
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
              ? `${aktivBg[rolle]} text-white shadow-sm`
              : "text-ink-secondary hover:text-ink hover:bg-surface-muted"
          }`}
        >
          <item.Icon size={16} className={active ? "text-white" : "text-ink-muted"} />
          <span>{item.label}</span>
        </Link>
      )
    })
  }

  const sidebarContent = (
    <>
      <Link
        href={dashboardLinks[rolle]}
        className="block p-5 pb-4 hover:opacity-80 transition-opacity cursor-pointer"
        onClick={() => setMobileOpen(false)}
      >
        <div className="text-2xl font-bold tracking-tight">
          <span className="text-ink">Re</span>
          <span className="text-accent">paro</span>
        </div>
        <div className="text-[11px] text-ink-muted mt-1 font-medium uppercase tracking-widest">
          {rolleLabels[rolle]}
        </div>
      </Link>

      {/* Rollen-Wechsel — nur sichtbar für Admins via ActiveRoleContext */}
      {(rolle === "verwalter" || rolle === "handwerker" || rolle === "mieter") && (
        <div className="px-4 pb-3">
          <RollenWechsel />
        </div>
      )}

      <div className="px-3 mb-2">
        <div className="h-px bg-line" />
      </div>

      <nav className="flex-1 px-2 py-1 overflow-y-auto">
        {renderItems(items.filter(i => i.gruppe !== "selten"))}
        {items.some(i => i.gruppe === "selten") && (
          <>
            <div className="mt-4 mb-1 px-3.5 text-[9px] font-bold uppercase tracking-wider text-ink-muted">
              Mein Bereich
            </div>
            {renderItems(items.filter(i => i.gruppe === "selten"))}
          </>
        )}
      </nav>

      <div className="px-3 mb-2">
        <div className="h-px bg-line" />
      </div>

      <div className="p-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 text-xs text-ink-muted hover:text-danger py-2 px-3 rounded-lg hover:bg-danger/5 transition-all font-medium"
        >
          <LogOut size={14} />
          <span>Abmelden</span>
        </button>
        <div className="mt-3 flex gap-3 px-3 text-[11px] text-ink-faint">
          <Link
            href="/impressum"
            onClick={() => setMobileOpen(false)}
            className="hover:text-ink transition-colors"
          >
            Impressum
          </Link>
          <Link
            href="/agb"
            onClick={() => setMobileOpen(false)}
            className="hover:text-ink transition-colors"
          >
            AGB
          </Link>
          <Link
            href="/datenschutz"
            onClick={() => setMobileOpen(false)}
            className="hover:text-ink transition-colors"
          >
            Datenschutz
          </Link>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Hamburger Button — z-[60] über die Sidebar (z-50). */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className={`md:hidden fixed top-4 left-4 z-[60] w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${
          mobileOpen
            ? "bg-surface-muted border border-line-strong text-ink"
            : "bg-surface-card border border-line text-ink hover:bg-surface-muted"
        }`}
        aria-label={mobileOpen ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? (
          <span className="text-xl font-bold">✕</span>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="w-4 h-0.5 bg-ink rounded-full" />
            <div className="w-3 h-0.5 bg-ink-muted rounded-full" />
            <div className="w-4 h-0.5 bg-ink rounded-full" />
          </div>
        )}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-ink/30 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-surface-card border-r border-line flex-col min-h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar (slide-in) — max 280px, lässt rechts >60px Platz
          zum Tap-to-Close auch auf schmalen Geräten (UX-Audit). */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-full max-w-[280px] w-[80vw] bg-surface-card border-r border-line flex flex-col z-50 transform transition-transform duration-300 shadow-xl ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
