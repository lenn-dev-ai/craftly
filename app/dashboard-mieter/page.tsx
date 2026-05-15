"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { Badge, Button, Card } from "@/components/ui"
import { CardListSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton"

const PIPELINE_STEPS = [
  { label: "Gemeldet" },
  { label: "Auktion" },
  { label: "Reparatur" },
  { label: "Fertig" },
]

// Status-Übergang: offen → auktion → in_bearbeitung → erledigt
function getStepIndex(status: string): number {
  if (status === "offen") return 0
  if (status === "auktion") return 1
  if (status === "in_bearbeitung") return 2
  if (status === "erledigt") return 3
  return 0
}

function getEstimate(ticket: Ticket): string {
  const s = ticket.status
  const p = ticket.prioritaet
  if (s === "in_bearbeitung") return p === "dringend" ? "Heute" : "1–3 Tage"
  if (s === "auktion") return p === "dringend" ? "Wenige Stunden" : "1–2 Tage bis Vergabe"
  if (s === "offen") return p === "dringend" ? "Innerhalb 24 Std" : "2–5 Tage"
  return ""
}

// Diagnose-Substatus für Mieter-Sicht (B2-W2 — symmetrisch zur Verwalter-Pipeline)
function diagnoseSubStatus(t: Ticket): { label: string; color: string } | null {
  if (t.ticket_typ !== "diagnose") return null
  if (t.status === "erledigt") return null
  if (!t.zugewiesener_hw) return { label: "Wartet auf Handwerker", color: "text-[#C4956A]" }
  if (!t.befund_text) return { label: "Termin läuft", color: "text-[#5B6ABF]" }
  return { label: `Befund + Festpreis (${t.projekt_angebot ?? "—"} €) — Verwalter entscheidet`, color: "text-[#3D8B7A]" }
}

export default function MieterDashboard() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState("")
  const [userId, setUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    setUserId(user.id)
    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
    if (profile) setUsername(profile.name?.split(" ")[0] || "")
    const { data } = await supabase.from("tickets").select("*")
      .eq("erstellt_von", user.id).order("created_at", { ascending: false })
    setTickets(data || [])
    setLoading(false)
  }, [router])

  useEffect(() => { void load() }, [load])

  // Realtime: Status-Wechsel der eigenen Tickets sofort sehen (F-3)
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`mieter-tickets-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets", filter: `erstellt_von=eq.${userId}` },
        () => { void load() },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, load])

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto pt-16 md:pt-6">
        <PageHeaderSkeleton />
        <CardListSkeleton count={3} rows={3} />
      </div>
    )
  }

  const aktiv = tickets.filter(t => t.status !== "erledigt")
  const erledigt = tickets.filter(t => t.status === "erledigt")

  return (
    <div className="p-6 max-w-4xl mx-auto pt-16 md:pt-6">
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

              const diag = diagnoseSubStatus(t)
              return (
                <Card key={t.id} className="hover:bg-[#F7F4F0] cursor-pointer transition-all"
                  onClick={() => router.push("/dashboard-mieter/ticket/" + t.id)}>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: t.prioritaet === "dringend" ? "#C4574B" : "#3D8B7A" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[#2D2A26] font-medium truncate">{t.titel}</div>
                      </div>
                      {t.ticket_typ === "diagnose" && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C6CAB] bg-[#7C6CAB]/10 border border-[#7C6CAB]/20 px-2 py-0.5 rounded">
                          Diagnose
                        </span>
                      )}
                      <Badge status={t.status} />
                    </div>

                    {/* Diagnose-Substatus für die Mieter-Pipeline-Sicht */}
                    {diag && (
                      <div className={`text-xs font-medium mb-2 ${diag.color}`}>
                        {diag.label}
                      </div>
                    )}

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
                onClick={() => router.push("/dashboard-mieter/ticket/" + t.id)}>
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
