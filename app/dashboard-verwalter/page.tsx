"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { Badge, StatusDot, MetricCard, Button, Card, EmptyState } from "@/components/ui"

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
        .from("tickets").select("*, objekt(*), angebote(*)")
        .eq("erstellt_von", user.id).order("created_at", { ascending: false })

      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  const offen = tickets.filter(t => t.status === "offen").length
  const auktion = tickets.filter(t => t.status === "auktion").length
  const inArbeit = tickets.filter(t => t.status === "in_bearbeitung").length
  const erledigt = tickets.filter(t => t.status === "erledigt").length
  const gesamtkosten = tickets.filter(t => t.kosten_final).reduce((s, t) => s + (t.kosten_final || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-sm text-gray-400">LÃ¤dt...</div>
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ãbersicht aller Objekte & Tickets</p>
        </div>
        <Button onClick={() => router.push("/dashboard-verwalter/neues-ticket")}>
          + Neues Ticket
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Offene Tickets" value={offen} />
        <MetricCard label="Aktive Auktionen" value={auktion} />
        <MetricCard label="In Bearbeitung" value={inArbeit} />
        <MetricCard label="Kosten lfd. Monat" value={`â¬ ${gesamtkosten.toLocaleString("de")}`} />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-700">Aktuelle Tickets</h2>
        <button onClick={() => router.push("/dashboard-verwalter/tickets")}
          className="text-xs text-[#1D9E75] hover:underline">Alle anzeigen</button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState icon="ð«" title="Noch keine Tickets"
          desc="Erstelle dein erstes Ticket um Handwerker zu beauftragen."
          action={<Button onClick={() => router.push("/dashboard-verwalter/neues-ticket")}>Erstes Ticket erstellen</Button>} />
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.slice(0, 8).map(t => (
            <Card key={t.id}
              className="cursor-pointer hover:border-[#1D9E75] transition-colors !p-3"
              onClick={() => router.push(`/ticket/${t.id}`)}>
              <div className="flex items-center gap-3">
                <StatusDot status={t.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.titel}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t.wohnung && `${t.wohnung} Â· `}
                    {t.angebote?.length ? `${t.angebote.length} Angebot${t.angebote.length !== 1 ? "e" : ""}` : "Keine Angebote"}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {t.angebote && t.angebote.length > 0 && (
                    <span className="text-sm font-medium text-[#1D9E75]">
                      â¬ {Math.min(...t.angebote.map(a => a.preis)).toLocaleString("de")}
                    </span>
                  )}
                  <Badge status={t.status} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {erledigt > 0 && (
        <div className="mt-4 text-center">
          <span className="text-xs text-gray-400">{erledigt} erledigte Tickets Â· </span>
          <button onClick={() => router.push("/dashboard-verwalter/tickets")}
            className="text-xs text-[#1D9E75] hover:underline">Alle anzeigen</button>
        </div>
      )}
    </div>
  )
}
