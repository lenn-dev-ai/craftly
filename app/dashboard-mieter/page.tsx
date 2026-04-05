"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { Badge, Button, Card, LoadingSpinner } from "@/components/ui"

const PIPELINE_STEPS = [
  { key: "offen", label: "Gemeldet", icon: "1" },
  { key: "marktplatz", label: "Marktplatz", icon: "2" },
  { key: "in_bearbeitung", label: "Reparatur", icon: "3" },
  { key: "erledigt", label: "Fertig", icon: "4" },
]

function getStepIndex(status: string): number {
  if (status === "offen") return 0
  if (status === "marktplatz") return 1
  if (status === "in_bearbeitung") return 2
  if (status === "erledigt") return 3
  return 0
}

function getKiInsight(ticket: Ticket): string {
  const s = ticket.status
  const p = ticket.prioritaet
  if (s === "offen" && p === "dringend") return "Deine Meldung hat Priorit\u00E4t \u2014 Hausverwaltung wird umgehend informiert."
  if (s === "offen") return "Deine Hausverwaltung pr\u00FCft die Meldung. Normalerweise innerhalb weniger Stunden."
  if (s === "marktplatz" && p === "dringend") return "Eilauftrag! Deine Hausverwaltung bucht per Sofort-Buchung auf dem Marktplatz."
  if (s === "marktplatz") return "Deine Hausverwaltung bucht passende Handwerker-Stunden auf dem Zeitslot-Marktplatz."
  if (s === "in_bearbeitung") return "Ein Handwerker arbeitet bereits an der L\u00F6sung. Du wirst informiert sobald es fertig ist."
  if (s === "erledigt") return "Reparatur abgeschlossen. Wir hoffen alles funktioniert wieder!"
  return ""
}

function getEstimate(ticket: Ticket): string {
  const s = ticket.status
  const p = ticket.prioritaet
  if (s === "erledigt") return "Abgeschlossen"
  if (s === "in_bearbeitung") return p === "dringend" ? "Heute" : "1\u20132 Tage"
  if (s === "marktplatz") return p === "dringend" ? "~4 Stunden" : "1\u20133 Tage"
  if (s === "offen") return p === "dringend" ? "~1 Tag" : "3\u20135 Tage"
  return ""
}

export default function MieterDashboard() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single()
      if (profile) setUserName(profile.name?.split(" ")[0] || "")
      const { data } = await supabase.from("tickets").select("*")
        .eq("erstellt_von", user.id).order("created_at", { ascending: false })
      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  const aktiv = tickets.filter(t => t.status !== "erledigt")
  const erledigt = tickets.filter(t => t.status === "erledigt")

  if (loading) return <LoadingSpinner />

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#2D2A26]">
          {userName ? ("Hallo " + userName) : "Meine \u00DCbersicht"}
        </h1>
        <p className="text-sm text-[#8C857B] mt-1">
          {aktiv.length > 0
            ? aktiv.length + " aktive Meldung" + (aktiv.length > 1 ? "en" : "")
            : "Alles in Ordnung \u2014 keine offenen Sch\u00E4den"}
        </p>
      </div>

      {/* Quick Action */}
      <button
        onClick={() => router.push("/dashboard-mieter/melden")}
        className="w-full mb-6 p-4 rounded-2xl border-2 border-dashed border-[#3D8B7A]/20 hover:border-[#3D8B7A]/40 bg-[#E8F4F1]/30 hover:bg-[#E8F4F1]/60 transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#E8F4F1] group-hover:bg-[#3D8B7A]/20 flex items-center justify-center transition-colors">
            <span className="text-[#3D8B7A] text-lg font-bold">+</span>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-[#2D2A26]">Schaden melden</div>
            <div className="text-xs text-[#8C857B]">KI erkennt Kategorie + Dringlichkeit automatisch</div>
          </div>
        </div>
      </button>

      {/* Alles OK */}
      {aktiv.length === 0 && tickets.length > 0 && (
        <Card className="mb-6 bg-[#E8F4F1]/50 border border-[#3D8B7A]/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#E8F4F1] flex items-center justify-center">
              <span className="text-[#3D8B7A] text-sm font-bold">OK</span>
            </div>
            <div>
              <div className="text-sm font-medium text-[#3D8B7A]">Alles in Ordnung</div>
              <div className="text-xs text-[#8C857B]">Keine offenen Sch\u00E4den. {erledigt.length} erledigte Meldung{erledigt.length > 1 ? "en" : ""}.</div>
            </div>
          </div>
        </Card>
      )}

      {/* Aktive Meldungen mit Pipeline */}
      {aktiv.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-[#8C857B] font-medium mb-3">Aktive Meldungen</h2>
          <div className="flex flex-col gap-3">
            {aktiv.map(t => {
              const stepIdx = getStepIndex(t.status)
              const insight = getKiInsight(t)
              const estimate = getEstimate(t)
              return (
                <Card key={t.id} className="hover:bg-[#F7F4F0] cursor-pointer transition-all"
                      onClick={() => router.push("/ticket/" + t.id)}>
                  {/* Titel + Badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#2D2A26] truncate">{t.titel}</div>
                      <div className="text-xs text-[#8C857B] mt-0.5">
                        {new Date(t.created_at).toLocaleDateString("de")}
                        {t.wohnung && (" \u2014 " + t.wohnung)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {estimate && <span className="text-[10px] text-[#8C857B]">{estimate}</span>}
                      <Badge status={t.status} />
                    </div>
                  </div>

                  {/* Mini Pipeline */}
                  <div className="flex items-center gap-1 mb-3">
                    {PIPELINE_STEPS.map((ps, i) => (
                      <div key={ps.key} className="flex items-center flex-1">
                        <div className={"h-1.5 flex-1 rounded-full " + (i <= stepIdx ? "bg-[#3D8B7A]" : "bg-[#EDE8E1]")} />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[9px] text-[#B5AEA4] mb-3">
                    {PIPELINE_STEPS.map((ps, i) => (
                      <span key={ps.key} className={i <= stepIdx ? "text-[#3D8B7A]" : ""}>{ps.label}</span>
                    ))}
                  </div>

                  {/* KI Insight */}
                  {insight && (
                    <div className="flex items-start gap-2 bg-[#F5F3F0] rounded-lg px-3 py-2">
                      <span className="text-[10px] text-[#3D8B7A] mt-0.5 font-semibold">AI</span>
                      <p className="text-xs text-[#8C857B]">{insight}</p>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Erledigte */}
      {erledigt.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-wider text-[#8C857B] font-medium mb-3">Erledigt ({erledigt.length})</h2>
          <div className="flex flex-col gap-2">
            {erledigt.map(t => (
              <Card key={t.id} className="hover:bg-[#F7F4F0] cursor-pointer transition-all"
                    onClick={() => router.push("/ticket/" + t.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#3D8B7A] flex-shrink-0" />
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
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-[#F5F3F0] flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">\uD83C\uDFE0</span>
          </div>
          <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Noch keine Meldungen</h2>
          <p className="text-sm text-[#8C857B] mb-6">Melde einen Schaden und deine Verwaltung wird sofort benachrichtigt.</p>
          <Button onClick={() => router.push("/dashboard-mieter/melden")}>Ersten Schaden melden</Button>
        </div>
      )}
    </div>
  )
}
