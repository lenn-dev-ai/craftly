"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Card } from "@/components/ui"
import { Role } from "@/types"

const rollen: { rolle: Role; label: string; icon: string; desc: string; gradient: string; href: string }[] = [
  {
    rolle: "verwalter", label: "Hausverwaltung", icon: "🏢",
    desc: "Tickets erstellen, Handwerker per Auktion beauftragen, Reporting einsehen",
    gradient: "from-emerald-500 to-teal-600", href: "/dashboard-verwalter"
  },
  {
    rolle: "handwerker", label: "Handwerker", icon: "🛠️",
    desc: "Aufträge annehmen, Angebote abgeben, Verfügbarkeit verwalten",
    gradient: "from-blue-500 to-indigo-600", href: "/dashboard-handwerker"
  },
  {
    rolle: "mieter", label: "Mieter", icon: "🏠",
    desc: "Schäden melden, Ticket-Status verfolgen, Bewertungen abgeben",
    gradient: "from-amber-500 to-orange-600", href: "/dashboard-mieter"
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
    <div className="min-h-screen bg-[var(--surface-2)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)] px-6 py-4 shadow-[var(--shadow-sm)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="logo text-2xl tracking-tight">Craft<span className="text-[var(--green)]">ly</span></div>
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest bg-[var(--surface-3)] px-2.5 py-1 rounded-full">Admin</span>
          </div>
          <div className="text-sm font-medium text-[var(--text-secondary)]">{userName}</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 animate-fade-in">
        <div className="mb-10">
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)]">Admin-Panel</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-lg">
            Wähle ein Dashboard, um es zu testen. Du bleibst als Admin eingeloggt und kannst jederzeit über den Button unten rechts hierher zurückkehren.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 stagger">
          {rollen.map(r => (
            <div key={r.rolle}
              onClick={() => router.push(r.href)}
              className="group cursor-pointer bg-white rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)] overflow-hidden card-hover">
              {/* Colored top bar */}
              <div className={`h-1.5 bg-gradient-to-r ${r.gradient}`} />
              <div className="p-6 text-center">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">{r.icon}</div>
                <div className="text-base font-bold text-[var(--text)] mb-2">{r.label}</div>
                <div className="text-[12px] text-[var(--text-muted)] mb-5 leading-relaxed px-2">{r.desc}</div>
                <Button variant="secondary" size="sm" onClick={() => router.push(r.href)}>
                  Dashboard öffnen &rarr;
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button onClick={async () => { const s = createClient(); await s.auth.signOut(); router.push("/login") }}
            className="text-sm font-medium text-[var(--text-muted)] hover:text-red-500 transition-colors">
            Ausloggen
          </button>
        </div>
      </div>
    </div>
  )
}
