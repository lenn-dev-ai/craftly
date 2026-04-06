"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

function kiHealthScore(stats: any): number {
  if (!stats) return 0
  let score = 50
  if (stats.totalUsers > 0) score += 10
  if (stats.totalUsers > 5) score += 5
  if (stats.totalTickets > 0) {
    const rate = stats.erledigteTickets / stats.totalTickets
    score += Math.round(rate * 20)
  }
  if (stats.totalTickets > 0 && stats.totalAngebote > 0) {
    const ratio = stats.totalAngebote / stats.totalTickets
    if (ratio >= 2) score += 10
    else if (ratio >= 1) score += 5
  }
  if (stats.verwalter > 0 && stats.handwerker > 0) score += 5
  return Math.min(score, 100)
}

function kiAnomalien(stats: any): string[] {
  const w: string[] = []
  if (!stats) return w
  if (stats.handwerker === 0) w.push("Keine Handwerker registriert - Auktionen funktionieren nicht")
  if (stats.totalTickets > 0 && stats.erledigteTickets === 0) w.push("Kein Ticket abgeschlossen - Workflow prüfen")
  if (stats.verwalter === 0) w.push("Kein Verwalter vorhanden - Tickets können nicht erstellt werden")
  if (stats.totalTickets > 5 && stats.totalAngebote === 0) w.push("Viele Tickets aber keine Angebote")
  if (stats.offeneTickets > stats.totalTickets * 0.7) w.push("Ueber 70% der Tickets sind offen - Kapazitaetsengpass?")
  return w
}

function kiEmpfehlungen(stats: any): string[] {
  const t: string[] = []
  if (!stats) return t
  if (stats.handwerker < 3) t.push("Mehr Handwerker einladen für besseren Wettbewerb")
  if (stats.mieter === 0) t.push("Mieter-Accounts anlegen fuer Schadensmeldungen")
  if (stats.totalTickets > 0 && stats.erledigteTickets / stats.totalTickets < 0.3) t.push("Erledigungsrate unter 30% - Erinnerungen aktivieren")
  if (stats.verwalter > 0 && stats.handwerker > 0 && stats.mieter > 0 && stats.totalTickets === 0) t.push("Alle Rollen da - erstelle ein Test-Ticket")
  return t
}

interface Stats {
  totalUsers: number; verwalter: number; handwerker: number; mieter: number
  totalTickets: number; offeneTickets: number; erledigteTickets: number
  totalKosten: number; totalAngebote: number
  recentUsers: any[]; recentTickets: any[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: profiles }, { data: tickets }, { data: angebote }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("tickets").select("*, angebote(*)").order("created_at", { ascending: false }),
        supabase.from("angebote").select("*"),
      ])
      const p = profiles || [], t = tickets || [], a = angebote || []
      setStats({
        totalUsers: p.length,
        verwalter: p.filter(u => u.rolle === "verwalter").length,
        handwerker: p.filter(u => u.rolle === "handwerker").length,
        mieter: p.filter(u => u.rolle === "mieter").length,
        totalTickets: t.length,
        offeneTickets: t.filter(x => x.status !== "erledigt").length,
        erledigteTickets: t.filter(x => x.status === "erledigt").length,
        totalKosten: t.reduce((s, x) => s + (x.kosten_final || 0), 0),
        totalAngebote: a.length,
        recentUsers: p.slice(0, 5),
        recentTickets: t.slice(0, 5),
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#8B5CF6]/20 border-t-[#8B5CF6] rounded-full animate-spin" />
    </div>
  )
  if (!stats) return null

  const health = kiHealthScore(stats)
  const anomalien = kiAnomalien(stats)
  const empfehlungen = kiEmpfehlungen(stats)
  const erlRate = stats.totalTickets > 0 ? Math.round((stats.erledigteTickets / stats.totalTickets) * 100) : 0

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Plattform-Übersicht in Echtzeit</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 rounded-xl">
          <div className="relative w-8 h-8">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="#8B5CF6" strokeWidth="3" strokeDasharray={health * 0.942 + " 100"} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[#8B5CF6]">{health}</span>
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#8B5CF6] uppercase tracking-wider">KI Health</div>
            <div className="text-[10px] text-gray-500">{health >= 80 ? "Exzellent" : health >= 60 ? "Gut" : health >= 40 ? "Okay" : "Kritisch"}</div>
          </div>
        </div>
      </div>

      {anomalien.length > 0 && (
        <div className="mb-6 p-4 bg-[#FF6363]/[0.06] border border-[#FF6363]/20 rounded-2xl">
          <span className="text-xs font-bold text-[#FF6363] uppercase tracking-wider">KI Anomalie-Erkennung</span>
          <div className="space-y-1.5 mt-2">
            {anomalien.map((a, i) => (
              <div key={i} className="text-sm text-[#FF6363]/80">* {a}</div>
            ))}
          </div>
        </div>
      )}

      {empfehlungen.length > 0 && (
        <div className="mb-6 p-4 bg-[#8B5CF6]/[0.06] border border-[#8B5CF6]/20 rounded-2xl">
          <span className="text-xs font-bold text-[#8B5CF6] uppercase tracking-wider">KI Empfehlungen</span>
          <div className="space-y-1.5 mt-2">
            {empfehlungen.map((e, i) => (
              <div key={i} className="text-sm text-[#8B5CF6]/80">- {e}</div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          { label: "Nutzer gesamt", value: stats.totalUsers, color: "#8B5CF6" },
          { label: "Verwalter", value: stats.verwalter, color: "#00D4AA" },
          { label: "Handwerker", value: stats.handwerker, color: "#00B4D8" },
          { label: "Mieter", value: stats.mieter, color: "#F59E0B" },
        ].map((kpi, i) => (
          <div key={i} className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: kpi.color + "15" }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: kpi.color }} />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{kpi.value}</div>
            <div className="text-[11px] text-gray-500 mt-1 font-medium uppercase tracking-wider">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Tickets gesamt", value: stats.totalTickets, color: "#8B5CF6" },
          { label: "Offen", value: stats.offeneTickets, color: "#FF6363" },
          { label: "Erledigt", value: stats.erledigteTickets, color: "#00D4AA" },
          { label: "Gesamtkosten", value: stats.totalKosten.toLocaleString("de") + " EUR", color: "#F59E0B" },
        ].map((kpi, i) => (
          <div key={i} className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: kpi.color + "15" }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: kpi.color }} />
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">{kpi.value}</div>
            <div className="text-[11px] text-gray-500 mt-1 font-medium uppercase tracking-wider">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-white">Erledigungsrate</span>
          <span className={"text-sm font-bold " + (erlRate >= 50 ? "text-[#00D4AA]" : erlRate >= 25 ? "text-[#F59E0B]" : "text-[#FF6363]")}>{erlRate}%</span>
        </div>
        <div className="w-full h-3 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: erlRate + "%", background: erlRate >= 50 ? "linear-gradient(90deg, #00D4AA, #00B4D8)" : erlRate >= 25 ? "#F59E0B" : "#FF6363" }} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Neueste Nutzer</h3>
          {stats.recentUsers.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">Keine Nutzer vorhanden</p>
          ) : (
            <div className="space-y-3">
              {stats.recentUsers.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg, #8B5CF6, #00B4D8)", color: "#fff" }}>
                    {(u.name || u.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{u.name || u.email}</div>
                    <div className="text-[11px] text-gray-500">{u.rolle} - {new Date(u.created_at).toLocaleDateString("de")}</div>
                  </div>
                  <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider " + (u.rolle === "admin" ? "bg-purple-500/15 text-purple-400" : u.rolle === "verwalter" ? "bg-emerald-500/15 text-emerald-400" : u.rolle === "handwerker" ? "bg-blue-500/15 text-blue-400" : "bg-amber-500/15 text-amber-400")}>{u.rolle}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Neueste Tickets</h3>
          {stats.recentTickets.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">Keine Tickets vorhanden</p>
          ) : (
            <div className="space-y-3">
              {stats.recentTickets.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className={"w-2.5 h-2.5 rounded-full flex-shrink-0 " + (t.status === "offen" ? "bg-[#FF6363]" : t.status === "auktion" ? "bg-[#00B4D8]" : t.status === "erledigt" ? "bg-[#00D4AA]" : "bg-[#F59E0B]")} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{t.titel}</div>
                    <div className="text-[11px] text-gray-500">{t.status} - {new Date(t.created_at).toLocaleDateString("de")}</div>
                  </div>
                  {t.angebote?.length > 0 && (
                    <span className="text-xs font-semibold text-[#00D4AA]">{t.angebote.length} Angebote</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
