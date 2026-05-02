"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

/* KI: Trend-Analyse */
function kiTrend(timeline: any[]): { trend: string; text: string } {
  if (timeline.length < 3) return { trend: "neutral", text: "Nicht genug Daten" }
  const first = timeline.slice(0, 3).reduce((s, d) => s + d.tickets + d.users + d.angebote, 0)
  const last = timeline.slice(-3).reduce((s, d) => s + d.tickets + d.users + d.angebote, 0)
  if (last > first * 1.3) return { trend: "up", text: "Steigende Aktivität (+30%)" }
  if (last < first * 0.7) return { trend: "down", text: "Sinkende Aktivität (-30%)" }
  return { trend: "neutral", text: "Stabile Aktivität" }
}

/* KI: Peak-Erkennung */
function kiPeakTag(timeline: any[]): string | null {
  if (timeline.length === 0) return null
  let maxIdx = 0, maxVal = 0
  timeline.forEach((d, i) => {
    const total = d.tickets + d.users + d.angebote
    if (total > maxVal) { maxVal = total; maxIdx = i }
  })
  if (maxVal === 0) return null
  return timeline[maxIdx].date + " (" + maxVal + " Events)"
}

export default function AktivitaetPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: profiles }, { data: tickets }, { data: angebote }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("tickets").select("*").order("created_at", { ascending: false }),
        supabase.from("angebote").select("*").order("created_at", { ascending: false }),
      ])
      const p = profiles || [], t = tickets || [], a = angebote || []
      const days = 7, today = new Date()
      const timeline: { date: string; tickets: number; users: number; angebote: number }[] = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split("T")[0]
        const label = d.toLocaleDateString("de", { weekday: "short", day: "numeric", month: "short" })
        timeline.push({
          date: label,
          tickets: t.filter(x => x.created_at?.startsWith(dateStr)).length,
          users: p.filter(x => x.created_at?.startsWith(dateStr)).length,
          angebote: a.filter(x => x.created_at?.startsWith(dateStr)).length,
        })
      }
      const activity = [
        ...t.map(x => ({ type: "ticket" as const, title: x.titel, date: x.created_at, detail: x.status })),
        ...p.map(x => ({ type: "user" as const, title: x.name || x.email, date: x.created_at, detail: x.rolle })),
        ...a.map(x => ({ type: "angebot" as const, title: "Angebot: " + x.preis + " EUR", date: x.created_at, detail: x.status })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20)
      setData({ timeline, activity, totalT: t.length, totalU: p.length, totalA: a.length })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#8B5CF6]/20 border-t-[#8B5CF6] rounded-full animate-spin" />
    </div>
  )
  if (!data) return null

  const maxVal = Math.max(...data.timeline.map((d: any) => d.tickets + d.users + d.angebote), 1)
  const trend = kiTrend(data.timeline)
  const peak = kiPeakTag(data.timeline)

  const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
    ticket: { color: "#3D8B7A", label: "Ticket" },
    user: { color: "#8B5CF6", label: "Registrierung" },
    angebot: { color: "#00B4D8", label: "Angebot" },
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2D2A26] tracking-tight">Aktivität</h1>
          <p className="text-sm text-gray-500 mt-1">Plattform-Aktivität der letzten 7 Tage</p>
        </div>
        <div className="flex gap-3">
          {[
            { label: "Tickets", value: data.totalT, color: "#3D8B7A" },
            { label: "Nutzer", value: data.totalU, color: "#8B5CF6" },
            { label: "Angebote", value: data.totalA, color: "#00B4D8" },
          ].map((m, i) => (
            <div key={i} className="px-3 py-2 bg-white border border-white/[0.06] rounded-xl text-center">
              <div className="text-lg font-bold text-[#2D2A26]">{m.value}</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: m.color }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KI Trend + Peak */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className={"p-4 border rounded-2xl " + (trend.trend === "up" ? "bg-[#3D8B7A]/[0.06] border-[#3D8B7A]/20" : trend.trend === "down" ? "bg-[#FF6363]/[0.06] border-[#FF6363]/20" : "bg-[#8B5CF6]/[0.06] border-[#8B5CF6]/20")}>
          <span className={"text-xs font-bold uppercase tracking-wider " + (trend.trend === "up" ? "text-[#3D8B7A]" : trend.trend === "down" ? "text-[#FF6363]" : "text-[#8B5CF6]")}>KI Trend-Analyse</span>
          <div className={"text-sm mt-1 " + (trend.trend === "up" ? "text-[#3D8B7A]/80" : trend.trend === "down" ? "text-[#FF6363]/80" : "text-[#8B5CF6]/80")}>
            {trend.trend === "up" ? "^ " : trend.trend === "down" ? "v " : "= "}{trend.text}
          </div>
        </div>
        {peak && (
          <div className="p-4 bg-[#C4956A]/[0.06] border border-[#C4956A]/20 rounded-2xl">
            <span className="text-xs font-bold text-[#C4956A] uppercase tracking-wider">KI Peak-Erkennung</span>
            <div className="text-sm text-[#C4956A]/80 mt-1">Aktivster Tag: {peak}</div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="bg-white border border-white/[0.06] rounded-2xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-[#2D2A26] mb-6">Aktivitäts-Verlauf (7 Tage)</h3>
        <div className="flex items-end gap-3 h-40">
          {data.timeline.map((d: any, i: number) => {
            const total = d.tickets + d.users + d.angebote
            const height = maxVal > 0 ? (total / maxVal) * 100 : 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center justify-end h-32">
                  <span className="text-[11px] font-bold text-[#2D2A26] mb-1">{total}</span>
                  <div className="w-full max-w-[32px] rounded-t-lg transition-all" style={{ height: Math.max(height, 4) + "%", background: "linear-gradient(to top, #8B5CF6, #00B4D8)", opacity: total === 0 ? 0.2 : 1 }} />
                </div>
                <span className="text-[10px] text-gray-500 text-center leading-tight">{d.date}</span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#3D8B7A]" /><span className="text-[11px] text-gray-400">Tickets</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#8B5CF6]" /><span className="text-[11px] text-gray-400">Nutzer</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#5B6ABF]" /><span className="text-[11px] text-gray-400">Angebote</span></div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white border border-white/[0.06] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-[#2D2A26] mb-4">Letzte Aktivitäten</h3>
        <div className="space-y-2">
          {data.activity.map((a: any, i: number) => {
            const cfg = TYPE_CONFIG[a.type] || { color: "#666", label: a.type }
            return (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#2D2A26] truncate">{a.title}</div>
                  <div className="text-[11px] text-gray-500">{cfg.label} - {a.detail}</div>
                </div>
                <span className="text-[11px] text-gray-500 flex-shrink-0">{new Date(a.date).toLocaleDateString("de")}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
