"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { Badge, Button, Card, LoadingSpinner } from "@/components/ui"

function kiKosten(t: Ticket): string {
  const titel = (t.titel || "").toLowerCase()
  if (titel.match(/heiz|warm/)) return "250\u2013600"
  if (titel.match(/wasser|feucht|rohr/)) return "150\u2013800"
  if (titel.match(/elektr|strom|sicher/)) return "100\u2013400"
  if (titel.match(/tuer|fenster|schloss/)) return "80\u2013350"
  if (titel.match(/schimmel/)) return "200\u2013900"
  return "100\u2013500"
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
        .from("tickets").select("*")
        .order("created_at", { ascending: false })
      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  const offene = tickets.filter(t => t.status === "offen")
  const marktplatz = tickets.filter(t => t.status === "marktplatz")
  const inArbeit = tickets.filter(t => t.status === "in_bearbeitung")
  const erledigt = tickets.filter(t => t.status === "erledigt")
  const gesamtkosten = tickets.filter(t => t.kosten_final).reduce((s, t) => s + (t.kosten_final || 0), 0)

  if (loading) return <LoadingSpinner />

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-0 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2A26]">Dashboard</h1>
          <p className="text-sm text-[#8C857B] mt-1">{tickets.length} Tickets \u2014 {offene.length + marktplatz.length} aktiv</p>
        </div>
        <Button onClick={() => router.push("/dashboard-verwalter/marktplatz")}>Zum Marktplatz</Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "MELDUNGEN", value: offene.length, color: offene.length > 0 ? "text-[#C4956A]" : "text-[#8C857B]" },
          { label: "MARKTPLATZ", value: marktplatz.length, color: marktplatz.length > 0 ? "text-[#3D8B7A]" : "text-[#8C857B]" },
          { label: "IN ARBEIT", value: inArbeit.length, color: inArbeit.length > 0 ? "text-[#5B6ABF]" : "text-[#8C857B]" },
          { label: "KOSTEN MTD", value: gesamtkosten.toLocaleString("de") + " EUR", color: "text-[#8C857B]" },
        ].map(kpi => (
          <Card key={kpi.label} className="text-center py-4">
            <div className={"text-2xl font-bold tabular-nums " + kpi.color}>{kpi.value}</div>
            <div className="text-[10px] text-[#B5AEA4] uppercase tracking-wider mt-1">{kpi.label}</div>
          </Card>
        ))}
      </div>

      {/* Eingehende Meldungen */}
      {offene.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-[#B07A3B] font-semibold bg-[#FFF3E8] px-2 py-0.5 rounded-lg">NEU</span>
            <h2 className="text-sm font-medium text-[#2D2A26]">Eingehende Meldungen von Mietern</h2>
            <span className="text-xs text-[#8C857B]">({offene.length} warten auf Bearbeitung)</span>
          </div>
          <div className="flex flex-col gap-3">
            {offene.map(t => {
              const kosten = kiKosten(t)
              return (
                <Card key={t.id}>
                  <div className="flex items-start gap-4">
                    <div className={"w-1 self-stretch rounded-full flex-shrink-0 " + (
                      t.prioritaet === "dringend" ? "bg-[#C4574B]" :
                      t.prioritaet === "hoch" ? "bg-[#C4956A]" : "bg-[#3D8B7A]"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-sm font-semibold text-[#2D2A26]">{t.titel}</div>
                          <div className="text-xs text-[#8C857B] mt-0.5">
                            {t.wohnung && (t.wohnung + " \u2014 ")}{new Date(t.created_at).toLocaleDateString("de")}
                          </div>
                        </div>
                        <Badge status={t.status} />
                      </div>
                      {t.beschreibung && (
                        <p className="text-xs text-[#8C857B] mb-3 line-clamp-2">{t.beschreibung}</p>
                      )}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={"text-[10px] font-medium px-2 py-0.5 rounded-full border " + (
                          t.prioritaet === "dringend" ? "text-[#C4574B] bg-[#FDEEEC] border-[#C4574B]/15" :
                          t.prioritaet === "hoch" ? "text-[#B07A3B] bg-[#FFF3E8] border-[#C4956A]/20" :
                          "text-[#5B6ABF] bg-[#EEF0FF] border-[#5B6ABF]/15"
                        )}>
                          {t.prioritaet === "dringend" ? "Dringend" : t.prioritaet === "hoch" ? "Hoch" : "Normal"}
                        </span>
                        <span className="text-[10px] text-[#8C857B]">
                          Gesch\u00E4tzte Kosten: <span className="text-[#2D2A26] font-medium">{kosten} EUR</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Button size="sm" onClick={() => router.push("/dashboard-verwalter/marktplatz")}>
                          Handwerker-Stunden buchen
                        </Button>
                        <button onClick={() => router.push("/ticket/" + t.id)}
                          className="text-xs text-[#8C857B] hover:text-[#2D2A26] px-3 py-1.5">
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

      {/* Marktplatz-Buchungen */}
      {marktplatz.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-[#8C857B] font-medium mb-3">Marktplatz-Buchungen ({marktplatz.length})</h2>
          <div className="flex flex-col gap-2">
            {marktplatz.map(t => (
              <Card key={t.id} className="hover:bg-[#F7F4F0] cursor-pointer transition-all"
                    onClick={() => router.push("/ticket/" + t.id)}>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#3D8B7A] animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#2D2A26] truncate">{t.titel}</div>
                    <div className="text-xs text-[#8C857B]">{t.wohnung}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-[#3D8B7A]">Zeitslot gebucht</span>
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
          <h2 className="text-xs uppercase tracking-wider text-[#8C857B] font-medium mb-3">In Arbeit ({inArbeit.length})</h2>
          <div className="flex flex-col gap-2">
            {inArbeit.map(t => (
              <Card key={t.id} className="hover:bg-[#F7F4F0] cursor-pointer transition-all"
                    onClick={() => router.push("/ticket/" + t.id)}>
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#5B6ABF] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#2D2A26] truncate">{t.titel}</div>
                    <div className="text-xs text-[#8C857B]">{t.wohnung}</div>
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
          <div className="w-20 h-20 rounded-2xl bg-[#F5F3F0] flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-[#8C857B]">INBOX</span>
          </div>
          <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Noch keine Meldungen</h2>
          <p className="text-sm text-[#8C857B] mb-6">Sobald Mieter Sch\u00E4den melden, erscheinen sie hier. Buche Handwerker-Stunden auf dem Marktplatz.</p>
          <Button onClick={() => router.push("/dashboard-verwalter/marktplatz")}>Marktplatz \u00F6ffnen</Button>
        </div>
      )}

      {/* Erledigte Footer */}
      {erledigt.length > 0 && (
        <div className="text-center mt-4">
          <button onClick={() => router.push("/dashboard-verwalter/tickets")}
            className="text-xs text-[#B5AEA4] hover:text-[#3D8B7A] transition-colors">
            {erledigt.length} erledigte Tickets anzeigen
          </button>
        </div>
      )}
    </div>
  )
}
