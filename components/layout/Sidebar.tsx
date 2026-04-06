"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useEffect, useState } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
);
const IconMeldungen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
);
const IconVorgaenge = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
);
const IconAuftraege = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
);
const IconReporting = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
);
const IconEinnahmen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
);
const IconZeitslots = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
const IconKalender = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);
const IconProfil = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const IconHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
const IconWarning = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);
const IconEdit = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);

const verwalterNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard-verwalter", icon: <IconDashboard /> },
  { label: "Meldungen", href: "/dashboard-verwalter/meldungen", icon: <IconMeldungen /> },
  { label: "Vorgaenge", href: "/dashboard-verwalter/tickets", icon: <IconVorgaenge /> },
  { label: "Handwerker-Auftraege", href: "/dashboard-verwalter/marktplatz", icon: <IconAuftraege /> },
  { label: "Reporting", href: "/dashboard-verwalter/reporting", icon: <IconReporting /> },
];

const handwerkerNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard-handwerker", icon: <IconDashboard /> },
  { label: "Einnahmen", href: "/dashboard-handwerker/einnahmen", icon: <IconEinnahmen /> },
  { label: "Zeitslots", href: "/dashboard-handwerker/zeitslots", icon: <IconZeitslots /> },
  { label: "Auftraege", href: "/dashboard-handwerker/auftraege", icon: <IconAuftraege /> },
  { label: "Kalender", href: "/dashboard-handwerker/kalender", icon: <IconKalender /> },
  { label: "Mein Profil", href: "/dashboard-handwerker/profil", icon: <IconProfil /> },
];

const mieterNav: NavItem[] = [
  { label: "Uebersicht", href: "/dashboard-mieter", icon: <IconHome /> },
  { label: "Schaden melden", href: "/dashboard-mieter/melden", icon: <IconWarning /> },
  { label: "Meine Vorgaenge", href: "/dashboard-mieter/tickets", icon: <IconEdit /> },
];

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard-admin", icon: <IconDashboard /> },
  { label: "Verwaltung", href: "/dashboard-verwalter", icon: <IconSettings /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [rolle, setRolle] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadRolle() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("rolle")
          .eq("id", user.id)
          .single();
        if (data) setRolle(data.rolle);
      }
    }
    loadRolle();
  }, []);

  const navItems: NavItem[] =
    rolle === "verwalter" ? verwalterNav :
    rolle === "handwerker" ? handwerkerNav :
    rolle === "mieter" ? mieterNav :
    rolle === "admin" ? adminNav :
    [];

  const rolleLabel =
    rolle === "verwalter" ? "Verwalter" :
    rolle === "handwerker" ? "Handwerker" :
    rolle === "mieter" ? "Mieter" :
    rolle === "admin" ? "Admin" : "";

  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobileOpen])

  return (
    {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Hamburger Button */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-white rounded-lg p-2 shadow-md border border-[#EDE8E1]"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Menü öffnen"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D2A26" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isMobileOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      <aside className={`w-64 fixed md:sticky top-0 h-screen z-40 transition-transform duration-300 md:translate-x-0 h-screen bg-white border-r border-[#EDE8E1] flex flex-col ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="p-5 border-b border-[#EDE8E1]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#3D8B7A] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <span className="text-base font-semibold text-[#2D2A26]">Reparo</span>
            {rolleLabel && (
              <span className="block text-xs text-[#8C857B]">{rolleLabel}</span>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#3D8B7A]/10 text-[#3D8B7A]"
                  : "text-[#6B665E] hover:bg-[#FAF8F5] hover:text-[#2D2A26]"
              }`}
            >
              <span className={`flex-shrink-0 ${isActive ? "text-[#3D8B7A]" : "text-[#8C857B]"}`}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#EDE8E1]">
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[#6B665E] hover:bg-[#FAF8F5] hover:text-[#2D2A26] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Abmelden
        </button>
      </div>
    </aside>
  );
}
