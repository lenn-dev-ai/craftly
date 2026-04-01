"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { Badge, Button, Card, LoadingSpinner } from "@/components/ui"

const PIPELINE_STEPS = [
  { key: "offen", label: "Gemeldet", icon: "1" },
  { key: "auktion", label: "Handwerker", icon: "2" },
  { key: "in_bearbeitung", label: "Reparatur", icon: "3" },
  { key: "erledigt", label: "Fertig", icon: "4" },
]

function getStepIndex(status: string): number {
  if (status === "offen") return 0
  if (status === "auktion") return 1
  if (status === "in_bearbeitung") return 2
  if (status === "erledigt") return 3
  return 0
}

function getKiInsight(ticket: Ticket): string {
  const s = ticket.status
  const p = ticket.prioritaet
  if (s === "offen" && p === "dringend") return "Deine Meldung hat Prioritaet -- Hausverwaltung wird umgehend informiert."
  if (s === "offen") return "Deine Hausverwaltung prueft die Meldung. Normalerweise innerhalb weniger Stunden."
  if (s === "auktion" && p === "dringend") return "Eilauftrag! Handwerker werden per Sofort-Vergabe kontaktiert."
  if (s === "auktion") return "Handwerker bieten gerade auf deinen Auftrag. Bestes Angebot wird ausgewaehlt."
  if (s === "in_bearbeitung") return "Ein Handwerker arbeitet bereits an der Loesung. Du wirst informiert sobald es fertig ist."
  if (s === "erledigt") return "Reparatur abgeschlossen. Wir hoffen alles funktioniert wieder!"
  return ""
}

function getEstimate(ticket: Ticket): string {
  const s = ticket.status
  const p = ticket.prioritaet
  if (s === "erledigt") return "Abgeschlossen"
  if (s === "in_bearbeitung") return p === "dringend" ? "Heute" : "1-2 Tage"
  if (s === "auktion") return p === "dringend" ? "~4 Stunden" : "1-3 Tage"
  if (s === "offen") return p === "dringend" ? "~1 Tag" : "3-5 Tage"
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
        <h1 className="text-2xl font-bold text-white">
          {userName ? ("Hallo " + userName) : "Meine Uebersicht"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {aktiv.length > 0
            ? aktiv.length + " aktive Meldung" + (aktiv.length > 1 ? "en" : "")
            : "Alles in Ordnung -- keine offenen Schaeden"}
        </p>
      </div>

      {/* Quick Action */}
      <button
        onClick={() => router.push("/dashboard-mieter/melden")}
        className="w-full mb-6 p-4 rounded-2xl border-2 border-dashed border-[#00D4AA]/20 hover:border-[#00D4AA]/40 bg-[#00D4AA]/[0.03] hover:bg-[#00D4AA]/[0.06] transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#00D4AA]/10 group-hover:bg-[#00D4AA]/20 flex items-center justify-center transition-colors">
            <span className="text-[#00D4AA] text-lg font-bold">+</span>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">Schaden melden</div>
            <div className="text-xs text-gray-500">KI erkennt Kategorie + Dringlichkeit automatisch</div>
          </div>
        </div>
      </button>

      {/* Alles OK */}
      {aktiv.length === 0 && tickets.length > 0 && (
        <Card className="mb-6 bg-[#00D4AA]/5 border border-[#00D4AA]/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00D4AA]/10 flex items-center justify-center">
              <span className="text-[#00D4AA] text-sm font-bold">OK</span>
            </div>
            <div>
              <div className="text-sm font-medium text-[#00D4AA]">Alles in Ordnung</div>
              <div className="text-xs text-gray-500">Keine offenen Schaeden. {erledigt.length} erledigte Meldung{erledigt.length > 1 ? "en" : ""}.</div>
            </div>
          </div>
        </Card>
      )}

      {/* Aktive Meldungen mit Pipeline */}
      {aktiv.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">Aktive Meldungen</h2>
          <div className="flex flex-col gap-3">
            {aktiv.map(t => {
              const stepIdx = getStepIndex(t.status)
              const insight = getKiInsight(t)
              const estimate = getEstimate(t)
              return (
                <Card
                  key={t.id}
                  className="bg-[#12121a] border border-white/5 hover:border-white/10 cursor-pointer transition-all"
                  onClick={() => router.push("/ticket/" + t.id)}
                >
                  {/* Titel + Badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{t.titel}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(t.created_at).toLocaleDateString("de")}
                        {t.wohnung && (" -- " + t.wohnung)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {estimate && <span className="text-[10px] text-gray-500">{estimate}</span>}
                      <Badge status={t.status} />
                    </div>
                  </div>

                  {/* Mini Pipeline */}
                  <div className="flex items-center gap-1 mb-3">
                    {PIPELINE_STEPS.map((ps, i) => (
                      <div key={ps.key} className="flex items-center flex-1">
                        <div className={"h-1.5 flex-1 rounded-full " + (i <= stepIdx ? "bg-[#00D4AA]" : "bg-white/5")} />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-600 mb-3">
                    {PIPELINE_STEPS.map((ps, i) => (
                      <span key={ps.key} className={i <= stepIdx ? "text-[#00D4AA]" : ""}>{ps.label}</span>
                    ))}
                  </div>

                  {/* KI Insight */}
                  {insight && (
                    <div className="flex items-start gap-2 bg-white/[0.02] rounded-lg px-3 py-2">
                      <span className="text-[10px] text-[#00D4AA] mt-0.5">AI</span>
                      <p className="text-xs text-gray-400">{insight}</p>
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
          <h2 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">Erledigt ({erledigt.length})</h2>
          <div className="flex flex-col gap-2">
            {erledigt.map(t => (
              <Card
                key={t.id}
                className="bg-[#12121a]/50 border border-white/[0.03] cursor-pointer hover:border-white/10 transition-all"
                onClick={() => router.push("/ticket/" + t.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#00D4AA] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-400 truncate">{t.titel}</div>
                  </div>
                  <span className="text-xs text-gray-600">{new Date(t.created_at).toLocaleDateString("de")}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {tickets.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">HOME</span>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Noch keine Meldungen</h2>
          <p className="text-sm text-gray-500 mb-6">Melde einen Schaden und deine Verwaltung wird sofort benachrichtigt.</p>
          <Button onClick={() => router.push("/dashboard-mieter/melden")}>Ersten Schaden melden</Button>
        </div>
      )}
    </div>
  )
}
