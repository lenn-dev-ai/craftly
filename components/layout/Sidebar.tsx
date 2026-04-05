"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Rolle } from "@/types";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const menus: Record<Rolle, { href: string; label: string; icon: string }[]> = {
  verwalter: [
    { href: "/dashboard-verwalter", label: "Dashboard", icon: "\uD83D\uDCCA" },
    { href: "/dashboard-verwalter/meldungen", label: "Meldungen", icon: "\uD83D\uDCE9" },
    { href: "/dashboard-verwalter/tickets", label: "Tickets", icon: "\uD83C\uDFAB" },
    { href: "/dashboard-verwalter/marktplatz", label: "Marktplatz", icon: "\uD83C\uDFEA" },
    { href: "/dashboard-verwalter/reporting", label: "Reporting", icon: "\uD83D\uDCC8" },
  ],
  handwerker: [
    { href: "/dashboard-handwerker", label: "Dashboard", icon: "\uD83D\uDCCA" },
    { href: "/dashboard-handwerker/einnahmen", label: "Einnahmen", icon: "\uD83D\uDCB0" },
    { href: "/dashboard-handwerker/zeitslots", label: "Zeitslots", icon: "\u23F0" },
    { href: "/dashboard-handwerker/auftraege", label: "Auftr\u00E4ge", icon: "\uD83D\uDCCB" },
    { href: "/dashboard-handwerker/kalender", label: "Kalender", icon: "\uD83D\uDCC5" },
    { href: "/dashboard-handwerker/profil", label: "Mein Profil", icon: "\uD83D\uDC64" },
  ],
  mieter: [
    { href: "/dashboard-mieter", label: "\u00DCbersicht", icon: "\uD83C\uDFE0" },
    { href: "/dashboard-mieter/melden", label: "Schaden melden", icon: "\u26A0\uFE0F" },
    { href: "/dashboard-mieter/tickets", label: "Meine Tickets", icon: "\uD83D\uDCDD" },
  ],
  admin: [
    { href: "/dashboard-admin", label: "Dashboard", icon: "\uD83D\uDCCA" },
    { href: "/dashboard-verwalter", label: "Verwaltung", icon: "\u2699\uFE0F" },
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
        className="md:hidden fixed top-4 left-4 z-50 bg-white border border-[#EDE8E1] text-[#2D2A26] p-2 rounded-lg shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? "\u2715" : "\u2630"}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white border-r border-[#EDE8E1] p-6 z-40
          transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:static md:block
        `}
      >
        <div className="mb-8">
          <h2 className="text-xl font-bold text-[#3D8B7A]">Reparo</h2>
          <p className="text-sm text-[#8C857B] capitalize">{rolle}</p>
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
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-200
                  ${
                    isActive
                      ? "bg-[#E8F4F1] text-[#3D8B7A] font-semibold"
                      : "text-[#8C857B] hover:bg-[#F7F4F0] hover:text-[#2D2A26]"
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#8C857B] hover:bg-[#F7F4F0] hover:text-[#2D2A26] transition-colors duration-200"
          >
            <span className="text-lg">\uD83D\uDEAA</span>
            <span>Abmelden</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
