"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, LoadingSpinner } from "@/components/ui"

interface Stats {
  totalUsers: number
  verwalter: number
  handwerker: number
  mieter: number
  totalTickets: number
  offeneTickets: number
  erledigteTickets: number
  totalKosten: number
  recentUsers: any[]
  recentTickets: any[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [{ data: profiles }, { data: tickets }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("tickets").select("*, angebote(*)").order("created_at", { ascending: false }),
      ])

      const p = profiles || []
      const t = tickets || []

      setStats({
        totalUsers: p.length,
        verwalter: p.filter(u => u.rolle === "verwalter").length,
        handwerker: p.filter(u => u.rolle === "handwerker").length,
        mieter: p.filter(u => u.rolle === "mieter").length,
        totalTickets: t.length,
        offeneTickets: t.filter(x => x.status !== "erledigt").length,
        erledigteTickets: t.filter(x => x.status === "erledigt").length,
        totalKosten: t.reduce((s, x) => s + (x.kosten_final || 0), 0),
        recentUsers: p.slice(0, 5),
        recentTickets: t.slice(0, 5),
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />
  if (!stats) return null

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Plattform-Uebersicht in Echtzeit</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard label="Nutzer gesamt" value={stats.totalUsers} icon="U" color="#00D4AA" />
        <KPICard label="Verwalter" value={stats.verwalter} icon="V" color="#00B4D8" />
        <KPICard label="Handwerker" value={stats.handwerker} icon="H" color="#7B61FF" />
        <KPICard label="Mieter" value={stats.mieter} icon="M" color="#FFB74D" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard label="Tickets gesamt" value={stats.totalTickets} icon="T" color="#00D4AA" />
        <KPICard label="Offen" value={stats.offeneTickets} icon="!" color="#FF6363" />
        <KPICard label="Erledigt" value={stats.erledigteTickets} icon="+" color="#00D4AA" />
        <KPICard label="Gesamtkosten" value={`${stats.totalKosten.toLocaleString("de")} EUR`} icon="$" color="#FFB74D" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">Neueste Nutzer</h3>
          {stats.recentUsers.length === 0 ? (
            <p className="text-sm text-gray-500">Keine Nutzer vorhanden</p>
          ) : (
            <div className="space-y-3">
              {stats.recentUsers.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #00D4AA, #00B4D8)", color: "#fff" }}>
                    {(u.name || u.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{u.name || u.email}</div>
                    <div className="text-[11px] text-gray-500">{u.rolle} - {new Date(u.created_at).toLocaleDateString("de")}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    u.rolle === "verwalter" ? "bg-emerald-500/15 text-emerald-400" :
                    u.rolle === "handwerker" ? "bg-blue-500/15 text-blue-400" :
                    u.rolle === "admin" ? "bg-purple-500/15 text-purple-400" :
                    "bg-amber-500/15 text-amber-400"
                  }`}>{u.rolle}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">Neueste Tickets</h3>
          {stats.recentTickets.length === 0 ? (
            <p className="text-sm text-gray-500">Keine Tickets vorhanden</p>
          ) : (
            <div className="space-y-3">
              {stats.recentTickets.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    t.status === "offen" ? "bg-[#FF6363]" :
                    t.status === "auktion" ? "bg-[#00B4D8]" :
                    t.status === "erledigt" ? "bg-[#00D4AA]" : "bg-[#FFB74D]"
                  }`} />
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
        </Card>
      </div>
    </div>
  )
}

function KPICard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "15" }}>
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
        </div>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      <div className="text-[11px] text-gray-500 mt-1 font-medium uppercase tracking-wider">{label}</div>
    </div>
  )
}
