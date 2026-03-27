"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Card } from "@/components/ui"
import { Rolle } from "@/types"

const rollen: { rolle: Rolle; label: string; icon: string; desc: string; color: string; href: string }[] = [
  { rolle: "verwalter", label: "Hausverwaltung", icon: "🏢", desc: "Tickets erstellen, Handwerker verwalten, Reporting einsehen", color: "#1D9E75", href: "/dashboard-verwalter" },
  { rolle: "handwerker", label: "Handwerker", icon: "🛠️", desc: "Aufträge annehmen, Angebote abgeben, Profil verwalten", color: "#2563EB", href: "/dashboard-handwerker" },
  { rolle: "mieter", label: "Mieter", icon: "🏠", desc: "Schäden melden, Ticket-Status verfolgen, Bewertungen abgeben", color: "#D97706", href: "/dashboard-mieter" },
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="logo text-2xl">Craft<span className="text-[#1D9E75]">ly</span> <span className="text-sm font-normal text-gray-400 ml-2">Admin</span></div>
          <div className="text-sm text-gray-500">{userName}</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-xl font-medium text-gray-900 mb-1">Admin-Panel</h1>
          <p className="text-sm text-gray-500">
            Wähle ein Dashboard, um es zu testen. Du bleibst als Admin eingeloggt und kannst jederzeit hierher zurückkehren.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rollen.map(r => (
            <Card key={r.rolle} className="cursor-pointer hover:shadow-md transition-all hover:border-gray-300"
              onClick={() => router.push(r.href)}>
              <div className="text-center py-4">
                <div className="text-4xl mb-3">{r.icon}</div>
                <div className="font-medium text-gray-900 mb-1">{r.label}</div>
                <div className="text-xs text-gray-500 mb-4 px-2">{r.desc}</div>
                <Button variant="ghost" size="sm" onClick={() => router.push(r.href)}>
                  Dashboard öffnen →
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <button onClick={async () => { const s = createClient(); await s.auth.signOut(); router.push("/login") }}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Ausloggen
          </button>
        </div>
      </div>
    </div>
  )
}
