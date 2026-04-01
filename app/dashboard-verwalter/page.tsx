"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { Badge, Button, Card, LoadingSpinner } from "@/components/ui"

function kiVergabevorschlag(t: Ticket): { modus: string; label: string; color: string; grund: string } {
  const p = t.prioritaet
  if (p === "dringend") return { modus: "sofort", label: "Sofort-Vergabe", color: "text-red-400 bg-red-500/10 border-red-500/20", grund: "Notfall erkannt -- schnellste Reaktion noetig" }
  if (p === "hoch") return { modus: "auktion", label: "Smart-Auktion", color: "text-[#00D4AA] bg-[#00D4AA]/10 border-[#00D4AA]/20", grund: "Hoehere Prioritaet -- Wettbewerb fuer bestes Angebot" }
  return { modus: "plan", label: "Planauftrag", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", grund: "Keine Eile -- guenstigster Preis bei flexibler Planung" }
}

function kiKosten(t: Ticket): string {
  const titel = (t.titel || "").toLowerCase()
  if (titel.match(/heiz|warm/)) return "250-600"
  if (titel.match(/wasser|feucht|rohr/)) return "150-800"
  if (titel.match(/elektr|strom|sicher/)) return "100-400"
  if (titel.match(/tuer|fenster|schloss/)) return "80-350"
  if (titel.match(/schimmel/)) return "200-900"
  return "100-500"
}

export default function VerwalterDashboard() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase
        .from("tickets").select("*, objekte(*), angebote(*)")
        .eq("erstellt_von", user.id).order("created_at", { ascending: false })
      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  const offene = tickets.filter(t => t.status === "offen")
  const auktionen = tickets.filter(t => t.status === "auktion")
  const inArbeit = tickets.filter(t => t.status === "in_bearbeitung")
  const erledigt = tickets.filter(t => t.status === "erledigt")
  const gesamtkosten = tickets.filter(t => t.kosten_final).reduce((s, t) => s + (t.kosten_final || 0), 0)

  if (loading) return <LoadingSpinner />

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{tickets.length} Tickets -- {offene.length + auktionen.length} aktiv</p>
        </div>
        <Button onClick={() => router.push("/dashboard-verwalter/neues-ticket")}>+ Neues Ticket</Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: "OFFEN", value: offene.length, color: offene.length > 0 ? "text-amber-400" : "text-gray-300" },
          { label: "AUKTIONEN", value: auktionen.length, color: auktionen.length > 0 ? "text-[#00D4AA]" : "text-gray-300" },
          { label: "IN ARBEIT", value: inArbeit.length, color: inArbeit.length > 0 ? "text-blue-400" : "text-gray-300" },
          { label: "KOSTEN MTD", value: gesamtkosten.toLocaleString("de") + " EUR", color: "text-gray-300" },
        ].map(kpi => (
          <Card key={kpi.label} className="bg-[#12121a] border border-white/5 text-center py-4">
            <div className={"text-2xl font-bold tabular-nums " + kpi.color}>{kpi.value}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{kpi.label}</div>
          </Card>
        ))}
      </div>

      {/* KI-Triage: Neue Meldungen zur Freigabe */}
      {offene.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-[#00D4AA] font-medium bg-[#00D4AA]/10 px-2 py-0.5 rounded">AI</span>
            <h2 className="text-sm font-medium text-gray-200">Neue Meldungen -- KI-Voranalyse</h2>
            <span className="text-xs text-gray-500">({offene.length} warten auf Freigabe)</span>
          </div>
          <div className="flex flex-col gap-3">
            {offene.map(t => {
              const vorschlag = kiVergabevorschlag(t)
              const kosten = kiKosten(t)
              return (
                <Card key={t.id} className="bg-[#12121a] border border-white/5">
                  <div className="flex items-start gap-4">
                    {/* Prio Indicator */}
                    <div className={"w-1 self-stretch rounded-full flex-shrink-0 " + (t.prioritaet === "dringend" ? "bg-red-500" : t.prioritaet === "hoch" ? "bg-amber-500" : "bg-[#00D4AA]")} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-sm font-semibold text-white">{t.titel}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {t.wohnung && (t.wohnung + " -- ")}{new Date(t.created_at).toLocaleDateString("de")}
                          </div>
                        </div>
                        <Badge status={t.status} />
                      </div>

                      {t.beschreibung && (
                        <p className="text-xs text-gray-400 mb-3 line-clamp-2">{t.beschreibung}</p>
                      )}

                      {/* KI Insights Row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={"text-[10px] font-medium px-2 py-0.5 rounded-full border " + vorschlag.color}>
                          {vorschlag.label}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Geschaetzte Kosten: <span className="text-gray-300 font-medium">{kosten} EUR</span>
                        </span>
                        <span className="text-[10px] text-gray-600">{vorschlag.grund}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 mt-3">
                        <Button size="sm" onClick={() => router.push("/dashboard-verwalter/tickets/" + t.id + "/handwerker")}>
                          Freigeben + Handwerker waehlen
                        </Button>
                        <button
                          onClick={() => router.push("/ticket/" + t.id)}
                          className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Laufende Auktionen */}
      {auktionen.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">Laufende Auktionen ({auktionen.length})</h2>
          <div className="flex flex-col gap-2">
            {auktionen.map(t => (
              <Card key={t.id} className="bg-[#12121a] border border-white/5 hover:border-white/10 cursor-pointer transition-all" onClick={() => router.push("/ticket/" + t.id)}>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{t.titel}</div>
                    <div className="text-xs text-gray-500">{t.wohnung}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {t.angebote && t.angebote.length > 0 ? (
                      <span className="text-sm font-bold text-[#00D4AA] tabular-nums">
                        {t.angebote.length} Angebot{t.angebote.length > 1 ? "e" : ""} -- ab {Math.min(...t.angebote.map(a => a.preis))} EUR
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Warte auf Angebote...</span>
                    )}
                    <Badge status={t.status} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* In Arbeit */}
      {inArbeit.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">In Arbeit ({inArbeit.length})</h2>
          <div className="flex flex-col gap-2">
            {inArbeit.map(t => (
              <Card key={t.id} className="bg-[#12121a] border border-white/5 hover:border-white/10 cursor-pointer transition-all" onClick={() => router.push("/ticket/" + t.id)}>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{t.titel}</div>
                    <div className="text-xs text-gray-500">{t.wohnung}</div>
                  </div>
                  <Badge status={t.status} />
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
            <span className="text-2xl text-gray-500">TICKET</span>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Noch keine Tickets</h2>
          <p className="text-sm text-gray-500 mb-6">Erstelle dein erstes Ticket um Handwerker per Smart-Vergabe zu beauftragen.</p>
          <Button onClick={() => router.push("/dashboard-verwalter/neues-ticket")}>Erstes Ticket erstellen</Button>
        </div>
      )}

      {/* Erledigte Footer */}
      {erledigt.length > 0 && (
        <div className="text-center mt-4">
          <button onClick={() => router.push("/dashboard-verwalter/tickets")} className="text-xs text-gray-500 hover:text-[#00D4AA] transition-colors">
            {erledigt.length} erledigte Tickets anzeigen
          </button>
        </div>
      )}
    </div>
  )
}
