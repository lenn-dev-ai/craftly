"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

/* KI: System-Health Bewertung */
function kiSystemHealth(data: any): { score: number; checks: { name: string; ok: boolean; text: string }[] } {
  if (!data) return { score: 0, checks: [] }
  const checks: { name: string; ok: boolean; text: string }[] = []

  // Datenbank-Check
  const hasData = data.totalProfiles > 0
  checks.push({ name: "Datenbank", ok: hasData, text: hasData ? data.totalProfiles + " Profile geladen" : "Keine Daten" })

  // Rollen-Balance
  const hasAllRoles = data.rollenCount.verwalter > 0 && data.rollenCount.handwerker > 0 && data.rollenCount.mieter > 0
  checks.push({ name: "Rollen-Balance", ok: hasAllRoles, text: hasAllRoles ? "Alle Rollen besetzt" : "Nicht alle Rollen vorhanden" })

  // Ticket-Flow
  const flowOk = data.totalTickets === 0 || data.erledigungsRate > 0
  checks.push({ name: "Ticket-Flow", ok: flowOk, text: flowOk ? "Tickets werden bearbeitet" : "Kein Ticket abgeschlossen" })

  // Marktplatz
  const marktOk = data.totalTickets === 0 || data.avgAngebotePerTicket >= 1
  checks.push({ name: "Marktplatz", ok: marktOk, text: marktOk ? data.avgAngebotePerTicket + " Angebote/Ticket" : "Zu wenig Angebote pro Ticket" })

  // Gewerk-Abdeckung
  const gewerkOk = Object.keys(data.gewerkCount).length >= 2
  checks.push({ name: "Gewerk-Abdeckung", ok: gewerkOk, text: Object.keys(data.gewerkCount).length + " verschiedene Gewerke" })

  const okCount = checks.filter(c => c.ok).length
  const score = Math.round((okCount / checks.length) * 100)
  return { score, checks }
}

/* KI: Optimierungs-Tipps */
function kiOptimierung(data: any): string[] {
  const tips: string[] = []
  if (!data) return tips
  if (data.avgPreis > 0 && data.avgPreis > 1000) tips.push("Durchschnittspreis ueber 1000 EUR - Budget-Limits pruefen")
  if (data.erledigungsRate < 50 && data.totalTickets > 3) tips.push("Erledigungsrate unter 50% - Eskalations-Workflow einrichten")
  const gewerke = Object.keys(data.gewerkCount)
  if (gewerke.length < 3 && data.rollenCount.handwerker > 0) tips.push("Nur " + gewerke.length + " Gewerke - breitere Abdeckung empfohlen")
  if (data.totalObjekte === 0) tips.push("Keine Objekte angelegt - Immobilien-Verwaltung einrichten")
  return tips
}

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
      const p = profiles || [], t = tickets || [], a = angebote || [], o = objekte || []
      const avgAngebote = t.length > 0 ? +(a.length / t.length).toFixed(1) : 0
      const avgPreis = a.length > 0 ? Math.round(a.reduce((s, x) => s + (x.preis || 0), 0) / a.length) : 0
      const erlRate = t.length > 0 ? Math.round((t.filter(x => x.status === "erledigt").length / t.length) * 100) : 0
      const gewerkCount: Record<string, number> = {}
      p.filter(u => u.rolle === "handwerker" && u.gewerk).forEach(u => { gewerkCount[u.gewerk] = (gewerkCount[u.gewerk] || 0) + 1 })
      const statusCount: Record<string, number> = {}
      t.forEach(x => { statusCount[x.status] = (statusCount[x.status] || 0) + 1 })
      const rollenCount = { verwalter: p.filter(u => u.rolle === "verwalter").length, handwerker: p.filter(u => u.rolle === "handwerker").length, mieter: p.filter(u => u.rolle === "mieter").length }

      setData({ totalProfiles: p.length, totalObjekte: o.length, totalAngebote: a.length, totalTickets: t.length, avgAngebotePerTicket: avgAngebote, avgPreis, erledigungsRate: erlRate, gewerkCount, statusCount, rollenCount })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#8B5CF6]/20 border-t-[#8B5CF6] rounded-full animate-spin" />
    </div>
  )
  if (!data) return null

  const health = kiSystemHealth(data)
  const tipps = kiOptimierung(data)
  const statusColors: Record<string, string> = { offen: "#FF6363", auktion: "#00B4D8", in_bearbeitung: "#F59E0B", erledigt: "#00D4AA" }
  const statusLabels: Record<string, string> = { offen: "Offen", auktion: "Auktion", in_bearbeitung: "In Arbeit", erledigt: "Erledigt" }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">System-Metriken</h1>
          <p className="text-sm text-gray-500 mt-1">Detaillierte Plattform-Statistiken</p>
        </div>
      </div>

      {/* KI System-Health */}
      <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-[#8B5CF6] uppercase tracking-wider">KI System-Health</span>
          <span className={"text-lg font-bold " + (health.score >= 80 ? "text-[#00D4AA]" : health.score >= 50 ? "text-[#F59E0B]" : "text-[#FF6363]")}>{health.score}%</span>
        </div>
        <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden mb-4">
          <div className="h-full rounded-full transition-all" style={{ width: health.score + "%", background: health.score >= 80 ? "#00D4AA" : health.score >= 50 ? "#F59E0B" : "#FF6363" }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {health.checks.map((c, i) => (
            <div key={i} className={"p-3 rounded-xl border " + (c.ok ? "bg-[#00D4AA]/[0.06] border-[#00D4AA]/20" : "bg-[#FF6363]/[0.06] border-[#FF6363]/20")}>
              <div className={"text-[10px] font-bold uppercase tracking-wider " + (c.ok ? "text-[#00D4AA]" : "text-[#FF6363]")}>{c.ok ? "OK" : "!"} {c.name}</div>
              <div className={"text-[11px] mt-1 " + (c.ok ? "text-[#00D4AA]/70" : "text-[#FF6363]/70")}>{c.text}</div>
            </div>
          ))}
        </div>
      </div>

      {tipps.length > 0 && (
        <div className="mb-6 p-4 bg-[#8B5CF6]/[0.06] border border-[#8B5CF6]/20 rounded-2xl">
          <span className="text-xs font-bold text-[#8B5CF6] uppercase tracking-wider">KI Optimierungs-Tipps</span>
          <div className="space-y-1.5 mt-2">
            {tipps.map((t, i) => (
              <div key={i} className="text-sm text-[#8B5CF6]/80 flex items-start gap-2">
                <span className="text-[#8B5CF6] mt-0.5 text-xs">-&gt;</span> {t}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metriken */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Objekte", value: data.totalObjekte, color: "#8B5CF6" },
          { label: "Angebote", value: data.totalAngebote, color: "#00B4D8" },
          { label: "Avg/Ticket", value: data.avgAngebotePerTicket, color: "#00D4AA" },
          { label: "Avg Preis", value: data.avgPreis + " EUR", color: "#F59E0B" },
          { label: "Erledigt", value: data.erledigungsRate + "%", color: "#00D4AA" },
        ].map((m, i) => (
          <div key={i} className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: m.color + "15" }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
            </div>
            <div className="text-xl font-bold text-white">{m.value}</div>
            <div className="text-[11px] text-gray-500 mt-1 uppercase tracking-wider">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
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
                    <div className="h-full rounded-full transition-all" style={{ width: pct + "%", background: statusColors[status] || "#666" }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Handwerker nach Gewerk</h3>
          {Object.keys(data.gewerkCount).length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">Keine Gewerk-Daten vorhanden</p>
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
        </div>
      </div>
    </div>
  )
}"use client"

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
