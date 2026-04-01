"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, LoadingSpinner } from "@/components/ui"

export default function SystemPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: profiles }, { data: tickets }, { data: angebote }, { data: objekte }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("tickets").select("*"),
        supabase.from("angebote").select("*"),
        supabase.from("objekte").select("*"),
      ])

      const p = profiles || []
      const t = tickets || []
      const a = angebote || []
      const o = objekte || []

      const avgAngebotePerTicket = t.length > 0 ? (a.length / t.length).toFixed(1) : "0"
      const avgPreis = a.length > 0 ? Math.round(a.reduce((s, x) => s + (x.preis || 0), 0) / a.length) : 0
      const erledigungsRate = t.length > 0 ? Math.round((t.filter(x => x.status === "erledigt").length / t.length) * 100) : 0

      const gewerkCount: Record<string, number> = {}
      p.filter(u => u.rolle === "handwerker" && u.gewerk).forEach(u => {
        gewerkCount[u.gewerk] = (gewerkCount[u.gewerk] || 0) + 1
      })

      const statusCount: Record<string, number> = {}
      t.forEach(x => { statusCount[x.status] = (statusCount[x.status] || 0) + 1 })

      setData({
        totalObjekte: o.length,
        totalAngebote: a.length,
        avgAngebotePerTicket,
        avgPreis,
        erledigungsRate,
        gewerkCount,
        statusCount,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />
  if (!data) return null

  const statusColors: Record<string, string> = {
    offen: "#FF6363", auktion: "#00B4D8", in_bearbeitung: "#FFB74D", erledigt: "#00D4AA"
  }
  const statusLabels: Record<string, string> = {
    offen: "Offen", auktion: "Auktion", in_bearbeitung: "In Arbeit", erledigt: "Erledigt"
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">System-Metriken</h1>
        <p className="text-sm text-gray-400 mt-1">Detaillierte Plattform-Statistiken</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Objekte", value: data.totalObjekte, icon: "O" },
          { label: "Angebote", value: data.totalAngebote, icon: "A" },
          { label: "Avg Angebote/Ticket", value: data.avgAngebotePerTicket, icon: "#" },
          { label: "Avg Angebotspreis", value: `${data.avgPreis} EUR`, icon: "E" },
          { label: "Erledigungsrate", value: `${data.erledigungsRate}%`, icon: "%" },
        ].map((m, i) => (
          <Card key={i}>
            <div className="text-2xl mb-2">{m.icon}</div>
            <div className="text-xl font-bold text-white">{m.value}</div>
            <div className="text-[11px] text-gray-500 mt-1 uppercase tracking-wider">{m.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">Tickets nach Status</h3>
          <div className="space-y-3">
            {Object.entries(data.statusCount).map(([status, count]: [string, any]) => {
              const total = Object.values(data.statusCount).reduce((s: number, v: any) => s + v, 0) as number
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300">{statusLabels[status] || status}</span>
                    <span className="text-sm font-semibold text-white">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: statusColors[status] || "#666" }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">Handwerker nach Gewerk</h3>
          {Object.keys(data.gewerkCount).length === 0 ? (
            <p className="text-sm text-gray-500">Keine Gewerk-Daten vorhanden</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(data.gewerkCount).sort(([,a]: any, [,b]: any) => b - a).map(([gewerk, count]: [string, any]) => (
                <div key={gewerk} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                  <span className="text-sm text-gray-300 capitalize">{gewerk}</span>
                  <span className="text-sm font-semibold text-[#00D4AA]">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
