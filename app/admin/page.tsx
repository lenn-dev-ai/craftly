"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"

const rollen = [
  {
    rolle: "admin",
    label: "Admin Dashboard",
    icon: "[A]",
    desc: "Nutzer verwalten, Rollen aendern, Plattform-Einstellungen, Statistiken",
    color: "#7C6CAB",
    href: "/dashboard-admin",
  },
  {
    rolle: "verwalter",
    label: "Hausverwaltung",
    icon: "[H]",
    desc: "Tickets erstellen, Handwerker per Auktion beauftragen, Reporting einsehen",
    color: "#3D8B7A",
    href: "/dashboard-verwalter",
  },
  {
    rolle: "handwerker",
    label: "Handwerker",
    icon: "[W]",
    desc: "Auftraege annehmen, Angebote abgeben, Verfuegbarkeit verwalten",
    color: "#C4956A",
    href: "/dashboard-handwerker",
  },
  {
    rolle: "mieter",
    label: "Mieter",
    icon: "[M]",
    desc: "Schaeden melden, Ticket-Status verfolgen, Bewertungen abgeben",
    color: "#D4A24E",
    href: "/dashboard-mieter",
  },
]

export default function AdminPage() {
  const router = useRouter()
  const [userName, setUserName] = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data: profile } = await supabase.from("profiles").select("rolle, name").eq("id", user.id).single()
      if (profile?.rolle !== "admin") { router.push("/login"); return }
      setUserName(profile.name || user.email || "")
    }
    load()
  }, [router])

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2A26]">
      {/* Header */}
      <div className="border-b border-[#EDE8E1] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold tracking-tight">Repa<span className="text-[#3D8B7A]">ro</span></div>
            <span className="text-[10px] font-bold text-[#7C6CAB] uppercase tracking-widest bg-[#7C6CAB]/10 px-2.5 py-1 rounded-full">Admin</span>
          </div>
          <div className="text-sm text-[#8C857B]">{userName}</div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-8">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold">Admin-Panel</h1>
          <p className="text-sm text-[#6B665E] mt-1.5 max-w-lg">
            Waehle ein Dashboard, um es zu testen. Du bleibst als Admin eingeloggt und
            kannst jederzeit ueber den Button unten rechts hierher zurueckkehren.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {rollen.map(r => (
            <div
              key={r.rolle}
              onClick={() => router.push(r.href)}
              className="group cursor-pointer bg-white rounded-xl border border-[#EDE8E1] overflow-hidden hover:border-[#3D8B7A]/30 hover:shadow-md transition-all">
              {/* Colored top bar */}
              <div className="h-1" style={{ backgroundColor: r.color }} />
              <div className="p-5 text-center">
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center text-lg font-bold"
                  style={{ backgroundColor: r.color + "15", color: r.color }}>
                  {r.label.charAt(0)}
                </div>
                <div className="text-sm font-semibold mb-2 text-[#2D2A26]">{r.label}</div>
                <div className="text-[11px] text-[#8C857B] mb-4 leading-relaxed">{r.desc}</div>
                <div
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ backgroundColor: r.color + "12", color: r.color }}>
                  Dashboard oeffnen
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={async () => { const s = createClient(); await s.auth.signOut(); router.push("/login") }}
            className="text-sm font-medium text-[#8C857B] hover:text-[#C4574B] transition-colors">
            Ausloggen
          </button>
        </div>
      </div>
    </div>
  )
}
