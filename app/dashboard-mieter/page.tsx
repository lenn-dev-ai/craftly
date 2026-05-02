"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { Badge, Button, Card, LoadingSpinner } from "@/components/ui"

const PIPELINE_STEPS = [
  { label: "Gemeldet" },
  { label: "Auktion" },
  { label: "Reparatur" },
  { label: "Fertig" },
]

// Status-Übergang: offen → auktion → in_bearbeitung/in_arbeit/vergeben → erledigt
function getStepIndex(status: string): number {
  if (status === "offen") return 0
  if (status === "auktion" || status === "marktplatz") return 1
  if (status === "in_bearbeitung" || status === "in_arbeit" || status === "vergeben") return 2
  if (status === "erledigt") return 3
  return 0
}

function getEstimate(ticket: Ticket): string {
  const s = ticket.status
  const p = ticket.prioritaet
  if (s === "in_bearbeitung" || s === "in_arbeit" || s === "vergeben") return p === "dringend" ? "Heute" : "1–3 Tage"
  if (s === "auktion" || s === "marktplatz") return p === "dringend" ? "Wenige Stunden" : "1–2 Tage bis Vergabe"
  if (s === "offen") return p === "dringend" ? "Innerhalb 24 Std" : "2–5 Tage"
  return ""
}

export default function MieterDashboard() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
      if (profile) setUsername(profile.name?.split(" ")[0] || "")
      const { data } = await supabase.from("tickets").select("*")
        .eq("erstellt_von", user.id).order("created_at", { ascending: false })
      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    )
  }

  const aktiv = tickets.filter(t => t.status !== "erledigt")
  const erledigt = tickets.filter(t => t.status === "erledigt")

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#2D2A26]">
          {username ? `Hallo, ${username}` : "Willkommen"}
        </h1>
        <p className="text-[#8C857B] mt-1">
          {aktiv.length === 0
            ? "Keine offenen Vorgänge - alles in Ordnung."
            : `${aktiv.length} ${aktiv.length === 1 ? "offener Vorgang" : "offene Vorgänge"}`}
        </p>
      </div>

      {/* Quick Action */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/dashboard-mieter/melden")}
          className="flex items-center gap-3 w-full p-4 rounded-xl bg-[#E8F4F1] group-hover:bg-[#3D8B7A]/20 flex items-center justify-center transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-[#3D8B7A] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-[#2D2A26]">Schaden melden</div>
            <div className="text-xs text-[#8C857B]">KI erkennt Kategorie + Dringlichkeit automatisch</div>
          </div>
        </button>
      </div>

      {/* All OK State */}
      {aktiv.length === 0 && tickets.length > 0 && (
        <Card className="mb-6 mt-6 bg-[#E8F4F1]/50 border border-[#3D8B7A]/10">
          <div className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-full bg-[#E8F4F1] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium text-[#3D8B7A]">Alles in Ordnung</div>
              <div className="text-xs text-[#8C857B]">Keine offenen Schäden. {erledigt.length} erledigte {erledigt.length > 1 ? "Meldungen" : "Meldung"}.</div>
            </div>
          </div>
        </Card>
      )}

      {/* Active Tickets */}
      {aktiv.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-[#2D2A26] mb-4">Ihre offenen Vorgänge</h2>
          <div className="space-y-3">
            {aktiv.map(t => {
              const stepIdx = getStepIndex(t.status)
              const estimate = getEstimate(t)

              return (
                <Card key={t.id} className="hover:bg-[#F7F4F0] cursor-pointer transition-all"
                  onClick={() => router.push("/ticket/" + t.id)}>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: t.prioritaet === "dringend" ? "#C4574B" : "#3D8B7A" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[#2D2A26] font-medium truncate">{t.titel}</div>
                      </div>
                      <Badge status={t.status} />
                    </div>

                    {/* Mini Pipeline */}
                    <div className="flex items-center gap-1 mb-3">
                      {PIPELINE_STEPS.map((ps, i) => (
                        <div key={ps.label} className="flex items-center flex-1">
                          <div className={"h-1.5 flex-1 rounded-full " + (i <= stepIdx ? "bg-[#3D8B7A]" : "bg-[#EDE8E1]")} />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[9px] text-[#B5AEA4] mb-3">
                      {PIPELINE_STEPS.map((ps, i) => (
                        <span key={ps.label} className={i <= stepIdx ? "text-[#3D8B7A]" : ""}>{ps.label}</span>
                      ))}
                    </div>

                    {/* Estimate + Date */}
                    <div className="flex items-center justify-between">
                      {estimate && (
                        <div className="flex items-center gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8C857B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span className="text-xs text-[#8C857B]">Geschätzt: {estimate}</span>
                        </div>
                      )}
                      <span className="text-xs text-[#B5AEA4]">{new Date(t.created_at).toLocaleDateString("de")}</span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Completed section */}
      {erledigt.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-[#8C857B] mb-3">Erledigte Vorgänge</h2>
          <div className="space-y-2">
            {erledigt.slice(0, 5).map(t => (
              <Card key={t.id} className="hover:bg-[#F7F4F0] cursor-pointer transition-all opacity-60"
                onClick={() => router.push("/ticket/" + t.id)}>
                <div className="flex items-center gap-3 p-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#8C857B] truncate">{t.titel}</div>
                  </div>
                  <span className="text-xs text-[#B5AEA4]">{new Date(t.created_at).toLocaleDateString("de")}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {tickets.length === 0 && (
        <div className="text-center py-16 mt-6">
          <div className="w-20 h-20 rounded-2xl bg-[#F5F3F0] flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Noch keine Meldungen</h2>
          <p className="text-sm text-[#8C857B] mb-6">Melde einen Schaden und deine Verwaltung wird sofort benachrichtigt.</p>
          <Button onClick={() => router.push("/dashboard-mieter/melden")}>Ersten Schaden melden</Button>
        </div>
      )}
    </div>
  )
}
