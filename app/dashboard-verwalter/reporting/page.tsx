"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { MetricCard, Card } from "@/components/ui"

export default function ReportingPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase.from("tickets").select("*, angebote(*)").eq("erstellt_von", user.id)
      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  const erledigt = tickets.filter(t => t.status === "erledigt")
  const gesamtkosten = erledigt.reduce((s, t) => s + (t.kosten_final || 0), 0)
  const mitAngeboten = tickets.filter(t => t.angebote && t.angebote.length > 1)
  const ersparnis = mitAngeboten.reduce((s, t) => {
    const preise = t.angebote!.map((a: any) => a.preis)
    return s + (Math.max(...preise) - Math.min(...preise))
  }, 0)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-gray-400">Lädt...</div></div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-medium">Reporting</h1>
        <p className="text-sm text-gray-500 mt-0.5">Kosten- und Qualitätsübersicht</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Tickets gesamt" value={tickets.length} />
        <MetricCard label="Erledigt" value={erledigt.length} />
        <MetricCard label="Gesamtkosten" value={`€ ${gesamtkosten.toLocaleString("de")}`} />
        <MetricCard label="Ersparnis durch Auktionen" value={`€ ${ersparnis.toLocaleString("de")}`} sub="vs. teuerstes Angebot" />
      </div>

      <Card>
        <h2 className="text-sm font-medium mb-4">Tickets nach Status</h2>
        {[
          { label: "Offen", count: tickets.filter(t => t.status === "offen").length, color: "#E24B4A" },
          { label: "Auktion", count: tickets.filter(t => t.status === "auktion").length, color: "#378ADD" },
          { label: "In Bearbeitung", count: tickets.filter(t => t.status === "in_bearbeitung").length, color: "#EF9F27" },
          { label: "Erledigt", count: erledigt.length, color: "#1D9E75" },
        ].map(({ label, count, color }) => (
          <div key={label} className="mb-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-600">{label}</span>
              <span className="font-medium">{count}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: tickets.length ? `${(count / tickets.length) * 100}%` : "0%",
                background: color
              }} />
            </div>
          </div>
        ))}
      </Card>

      {erledigt.length > 0 && (
        <Card className="mt-4">
          <h2 className="text-sm font-medium mb-4">Abgeschlossene Aufträge</h2>
          <div className="flex flex-col gap-2">
            {erledigt.slice(0, 10).map(t => (
              <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <div>
                  <div className="font-medium text-gray-800">{t.titel}</div>
                  <div className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString("de")}</div>
                </div>
                {t.kosten_final ? (
                  <span className="text-[#1D9E75] font-medium">€ {t.kosten_final.toLocaleString("de")}</span>
                ) : <span className="text-gray-400 text-xs">Kosten nicht erfasst</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
