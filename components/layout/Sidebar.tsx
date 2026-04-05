"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Rolle } from "@/types";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const menus: Record<Rolle, { href: string; label: string; icon: string }[]> = {
  verwalter: [
    { href: "/dashboard-verwalter", label: "Dashboard", icon: "📊" },
    { href: "/dashboard-verwalter/tickets", label: "Tickets", icon: "🎫" },
    { href: "/dashboard-verwalter/neues-ticket", label: "Neues Ticket", icon: "➕" },
    { href: "/dashboard-verwalter/marktplatz", label: "Marktplatz", icon: "🏪" },
    { href: "/dashboard-verwalter/handwerker", label: "Handwerker", icon: "🔨" },
    { href: "/dashboard-verwalter/reporting", label: "Reporting", icon: "📈" },
  ],
  handwerker: [
    { href: "/dashboard-handwerker", label: "Dashboard", icon: "📊" },
    { href: "/dashboard-handwerker/einnahmen", label: "Einnahmen", icon: "💰" },
    { href: "/dashboard-handwerker/zeitslots", label: "Zeitslots", icon: "⏰" },
    { href: "/dashboard-handwerker/auftraege", label: "Aufträge", icon: "📋" },
    { href: "/dashboard-handwerker/kalender", label: "Kalender", icon: "📅" },
    { href: "/dashboard-handwerker/profil", label: "Mein Profil", icon: "👤" },
  ],
  mieter: [
    { href: "/dashboard-mieter", label: "Übersicht", icon: "🏠" },
    { href: "/dashboard-mieter/melden", label: "Schaden melden", icon: "⚠️" },
    { href: "/dashboard-mieter/tickets", label: "Meine Tickets", icon: "📝" },
  ],
  admin: [
    { href: "/dashboard-admin", label: "Dashboard", icon: "📊" },
    { href: "/dashboard-verwalter", label: "Verwaltung", icon: "⚙️" },
  ],
};

export default function Sidebar({ rolle }: { rolle: Rolle }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = menus[rolle] || [];

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-gray-800 text-white p-2 rounded"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? "✕" : "☰"}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-gray-900 text-white p-6 z-40
          transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:static md:block
        `}
      >
        <div className="mb-8">
          <h2 className="text-xl font-bold">Reparo</h2>
          <p className="text-sm text-gray-400 capitalize">{rolle}</p>
        </div>

        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                  transition-colors duration-200
                  ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors duration-200"
          >
            <span className="text-lg">🚪</span>
            <span>Abmelden</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
