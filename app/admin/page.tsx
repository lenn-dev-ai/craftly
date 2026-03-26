"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Card } from "@/components/ui"
import { Rolle } from "@/types"

const rollen: { rolle: Rolle; label: string; icon: string; desc: string; color: string }[] = [
  { rolle: "verwalter", label: "Hausverwaltung", icon: "\u{1F3E2}", desc: "Tickets erstellen, Handwerker verwalten, Reporting einsehen", color: "#1D9E75" },
  { rolle: "handwerker", label: "Handwerker", icon: "\u{1F6E0}\u{FE0F}", desc: "Aufträge annehmen, Angebote abgeben, Profil verwalten", color: "#2563EB" },
  { rolle: "mieter", label: "Mieter", icon: "\u{1F3E0}", desc: "Schäden melden, Ticket-Status verfolgen, Bewertungen abgeben", color: "#D97706" },
]

export default function AdminPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [currentRolle, setCurrentRolle] = useState<string>("")
  const [switching, setSwitching] = useState("")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      setUserId(user.id)
      const { data: profile } = await supabase.from("profiles").select("rolle, name").eq("id", user.id).single()
      if (profile) {
        setCurrentRolle(profile.rolle)
        setUserName(profile.name || user.email || "")
      }
    }
    load()
  }, [router])

  async function switchRole(rolle: Rolle) {
    if (!userId) return
    setSwitching(rolle)
    const supabase = createClient()
    await supabase.from("profiles").update({ rolle }).eq("id", userId)

    if (rolle === "verwalter") router.push("/dashboard-verwalter")
    else if (rolle === "handwerker") router.push("/dashboard-handwerker")
    else router.push("/dashboard-mieter")
  }

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
          <h1 className="text-xl font-medium text-gray-900 mb-1">Dashboard wechseln</h1>
          <p className="text-sm text-gray-500">
            Wähle eine Rolle, um das entsprechende Dashboard zu sehen.
            {currentRolle && <span> Aktuelle Rolle: <span className="font-medium text-gray-700">{currentRolle}</span></span>}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rollen.map(r => (
            <Card key={r.rolle} className={`cursor-pointer hover:shadow-md transition-all ${currentRolle === r.rolle ? "ring-2" : ""}`}
              style={{ borderColor: currentRolle === r.rolle ? r.color : undefined, ...(currentRolle === r.rolle ? { ringColor: r.color } : {}) }}
              onClick={() => switchRole(r.rolle)}>
              <div className="text-center py-4">
                <div className="text-4xl mb-3">{r.icon}</div>
                <div className="font-medium text-gray-900 mb-1">{r.label}</div>
                <div className="text-xs text-gray-500 mb-4 px-2">{r.desc}</div>
                <Button variant={currentRolle === r.rolle ? "primary" : "ghost"} size="sm"
                  disabled={switching === r.rolle}
                  onClick={() => switchRole(r.rolle)}>
                  {switching === r.rolle ? "Wechsle..." : currentRolle === r.rolle ? "Aktiv – Öffnen" : "Als " + r.label}
                </Button>
              </div>
              {currentRolle === r.rolle && (
                <div className="text-center">
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full text-white" style={{ background: r.color }}>Aktuelle Rolle</span>
                </div>
              )}
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
