"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts"
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react"

// ============================================================
// KI-Helfer (unverändert übernommen)
// ============================================================

interface Stats {
  totalUsers: number
  verwalter: number
  handwerker: number
  mieter: number
  totalTickets: number
  offeneTickets: number
  erledigteTickets: number
  totalKosten: number
  totalAngebote: number
  recentUsers: ProfileRow[]
  recentTickets: TicketRow[]
  alleTickets: TicketRow[]
}

interface ProfileRow {
  id: string
  name: string | null
  email: string | null
  rolle: string | null
  created_at: string
}
interface TicketRow {
  id: string
  titel: string
  status: string
  created_at: string
  angebote?: Array<{ id: string }> | null
}

function kiHealthScore(s: Stats | null): number {
  if (!s) return 0
  let score = 50
  if (s.totalUsers > 0) score += 10
  if (s.totalUsers > 5) score += 5
  if (s.totalTickets > 0) score += Math.round((s.erledigteTickets / s.totalTickets) * 20)
  if (s.totalTickets > 0 && s.totalAngebote > 0) {
    const ratio = s.totalAngebote / s.totalTickets
    if (ratio >= 2) score += 10
    else if (ratio >= 1) score += 5
  }
  if (s.verwalter > 0 && s.handwerker > 0) score += 5
  return Math.min(score, 100)
}

function kiAnomalien(s: Stats | null): string[] {
  const w: string[] = []
  if (!s) return w
  if (s.handwerker === 0) w.push("Keine Handwerker registriert — Auktionen funktionieren nicht")
  if (s.totalTickets > 0 && s.erledigteTickets === 0) w.push("Kein Ticket abgeschlossen — Workflow prüfen")
  if (s.verwalter === 0) w.push("Kein Verwalter vorhanden — Tickets können nicht erstellt werden")
  if (s.totalTickets > 5 && s.totalAngebote === 0) w.push("Viele Tickets aber keine Angebote")
  if (s.offeneTickets > s.totalTickets * 0.7) w.push("Über 70 % der Tickets sind offen — Kapazitätsengpass?")
  return w
}

function kiEmpfehlungen(s: Stats | null): string[] {
  const t: string[] = []
  if (!s) return t
  if (s.handwerker < 3) t.push("Mehr Handwerker einladen für besseren Wettbewerb")
  if (s.mieter === 0) t.push("Mieter-Accounts anlegen für Schadensmeldungen")
  if (s.totalTickets > 0 && s.erledigteTickets / s.totalTickets < 0.3)
    t.push("Erledigungsrate unter 30 % — Erinnerungen aktivieren")
  if (s.verwalter > 0 && s.handwerker > 0 && s.mieter > 0 && s.totalTickets === 0)
    t.push("Alle Rollen da — erstelle ein Test-Ticket")
  return t
}

// ============================================================
// Wochen-Buckets aus created_at-Stamps
// ============================================================

const ANZAHL_WOCHEN = 8

function montagDerWoche(d: Date): Date {
  const r = new Date(d)
  const offset = (r.getDay() + 6) % 7
  r.setDate(r.getDate() - offset)
  r.setHours(0, 0, 0, 0)
  return r
}

function wochenLabel(d: Date): string {
  return d.toLocaleDateString("de", { day: "2-digit", month: "2-digit" })
}

interface WochenPunkt {
  label: string
  erstellt: number
  erledigt: number
}

function wochenBuckets(tickets: TicketRow[]): WochenPunkt[] {
  const heute = new Date()
  const startMontag = montagDerWoche(heute)
  startMontag.setDate(startMontag.getDate() - 7 * (ANZAHL_WOCHEN - 1))
  const buckets: WochenPunkt[] = []
  for (let i = 0; i < ANZAHL_WOCHEN; i++) {
    const mo = new Date(startMontag)
    mo.setDate(mo.getDate() + 7 * i)
    buckets.push({ label: wochenLabel(mo), erstellt: 0, erledigt: 0 })
  }
  for (const t of tickets) {
    const created = new Date(t.created_at)
    const idx = Math.floor((montagDerWoche(created).getTime() - startMontag.getTime()) / (7 * 86400000))
    if (idx >= 0 && idx < ANZAHL_WOCHEN) {
      buckets[idx].erstellt++
      if (t.status === "erledigt") buckets[idx].erledigt++
    }
  }
  return buckets
}

// Trend dieser Woche vs. letzte Woche
function trend(buckets: WochenPunkt[], feld: "erstellt" | "erledigt"): { delta: number | null; richtung: "up" | "down" | "flat" | "none" } {
  if (buckets.length < 2) return { delta: null, richtung: "none" }
  const jetzt = buckets[buckets.length - 1][feld]
  const vor = buckets[buckets.length - 2][feld]
  if (vor === 0 && jetzt === 0) return { delta: null, richtung: "none" }
  if (vor === 0) return { delta: 100, richtung: "up" }
  const delta = Math.round(((jetzt - vor) / vor) * 100)
  return {
    delta,
    richtung: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  }
}

// ============================================================
// Page
// ============================================================

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [me, setMe] = useState<{ name: string | null; rolle: string | null } | null>(null)
  const [suche, setSuche] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: profiles }, { data: tickets }, { data: angebote }, { data: meProf }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("tickets").select("*, angebote(id)").order("created_at", { ascending: false }),
        supabase.from("angebote").select("id"),
        user ? supabase.from("profiles").select("name, rolle").eq("id", user.id).single() : Promise.resolve({ data: null }),
      ])
      const p = (profiles as ProfileRow[] | null) ?? []
      const t = (tickets as TicketRow[] | null) ?? []
      const a = (angebote as Array<{ id: string }> | null) ?? []
      setStats({
        totalUsers: p.length,
        verwalter: p.filter(u => u.rolle === "verwalter").length,
        handwerker: p.filter(u => u.rolle === "handwerker").length,
        mieter: p.filter(u => u.rolle === "mieter").length,
        totalTickets: t.length,
        offeneTickets: t.filter(x => x.status !== "erledigt").length,
        erledigteTickets: t.filter(x => x.status === "erledigt").length,
        totalKosten: t.reduce((acc, x) => acc + ((x as TicketRow & { kosten_final?: number }).kosten_final ?? 0), 0),
        totalAngebote: a.length,
        recentUsers: p.slice(0, 5),
        recentTickets: t.slice(0, 5),
        alleTickets: t,
      })
      setMe(meProf as { name: string | null; rolle: string | null } | null)
      setLoading(false)
    }
    load()
  }, [])

  const wochen = useMemo(() => wochenBuckets(stats?.alleTickets ?? []), [stats])
  const trendErstellt = useMemo(() => trend(wochen, "erstellt"), [wochen])

  if (loading) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#7C6CAB]/20 border-t-[#7C6CAB] rounded-full animate-spin" />
    </div>
  )
  if (!stats) return null

  const health = kiHealthScore(stats)
  const anomalien = kiAnomalien(stats)
  const empfehlungen = kiEmpfehlungen(stats)
  const erlRate = stats.totalTickets > 0 ? Math.round((stats.erledigteTickets / stats.totalTickets) * 100) : 0

  function onSuche(e: React.FormEvent) {
    e.preventDefault()
    if (!suche.trim()) return
    router.push(`/dashboard-admin/nutzer?q=${encodeURIComponent(suche.trim())}`)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2A26] tracking-tight">Dashboard</h1>
          <p className="text-sm text-[#8C857B] mt-1">Plattform-Übersicht in Echtzeit</p>
        </div>
        <div className="flex items-center gap-3">
          <form onSubmit={onSuche} className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C857B] pointer-events-none" />
            <input
              type="text"
              placeholder="Suche…"
              value={suche}
              onChange={e => setSuche(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm bg-white border border-[#EDE8E1] rounded-xl w-56 focus:outline-none focus:border-[#7C6CAB]/40 transition-colors"
              aria-label="Globale Suche"
            />
          </form>
          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white border border-[#EDE8E1] rounded-xl shadow-sm">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C6CAB] to-[#5B6ABF] flex items-center justify-center text-white text-xs font-bold">
              {(me?.name || "A").charAt(0).toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold text-[#2D2A26]">{me?.name || "Admin"}</div>
              <div className="text-[10px] uppercase tracking-wider text-[#7C6CAB] font-bold">{me?.rolle || "admin"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* KI-Anomalien */}
      {anomalien.length > 0 && (
        <div className="p-4 bg-[#C4574B]/5 border border-[#C4574B]/20 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-[#C4574B] uppercase tracking-wider">KI-Anomalie-Erkennung</span>
          <ul className="space-y-1 mt-2">
            {anomalien.map((a, i) => (
              <li key={i} className="text-sm text-[#C4574B]">• {a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* KI-Empfehlungen */}
      {empfehlungen.length > 0 && (
        <div className="p-4 bg-[#7C6CAB]/5 border border-[#7C6CAB]/20 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-[#7C6CAB] uppercase tracking-wider">KI-Empfehlungen</span>
          <ul className="space-y-1 mt-2">
            {empfehlungen.map((e, i) => (
              <li key={i} className="text-sm text-[#7C6CAB]">– {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI-Reihe 1: Nutzer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Nutzer gesamt" value={stats.totalUsers} farbe="#7C6CAB" />
        <KpiCard label="Verwalter" value={stats.verwalter} farbe="#3D8B7A" />
        <KpiCard label="Handwerker" value={stats.handwerker} farbe="#C4956A" />
        <KpiCard label="Mieter" value={stats.mieter} farbe="#5B6ABF" />
      </div>

      {/* KPI-Reihe 2: Tickets + Health */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Tickets gesamt"
          value={stats.totalTickets}
          farbe="#7C6CAB"
          trend={trendErstellt}
          sparkline={wochen.map(w => w.erstellt)}
        />
        <KpiCard label="Offen" value={stats.offeneTickets} farbe="#C4574B" />
        <KpiCard label="Erledigt" value={stats.erledigteTickets} farbe="#3D8B7A" />
        <KpiCard
          label="Gesamtkosten"
          value={`${stats.totalKosten.toLocaleString("de")} €`}
          farbe="#C4956A"
        />
      </div>

      {/* Ticket-Verlauf-Chart */}
      <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5 shadow-sm">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#2D2A26]">Tickets pro Woche · letzte {ANZAHL_WOCHEN} Wochen</h2>
          <div className="text-[11px] text-[#8C857B]">Erstellt vs. Erledigt</div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={wochen} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE8E1" />
              <XAxis dataKey="label" stroke="#8C857B" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis stroke="#8C857B" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#ffffff", border: "1px solid #EDE8E1", borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: "#2D2A26", fontWeight: 600 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              <Line type="monotone" dataKey="erstellt" stroke="#5B6ABF" strokeWidth={2} dot={{ r: 3 }} name="Erstellt" />
              <Line type="monotone" dataKey="erledigt" stroke="#3D8B7A" strokeWidth={2} dot={{ r: 3 }} name="Erledigt" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Erledigungsrate + Plattform-Health */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm font-semibold text-[#2D2A26]">Erledigungsrate</span>
            <span className={`text-2xl font-bold tabular-nums ${
              erlRate >= 70 ? "text-[#3D8B7A]" : erlRate >= 30 ? "text-[#C4956A]" : "text-[#C4574B]"
            }`}>{erlRate}%</span>
          </div>
          <div className="w-full h-3 bg-[#FAF8F5] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${erlRate}%`,
                background:
                  erlRate >= 70 ? "#3D8B7A"
                  : erlRate >= 30 ? "#C4956A"
                  : "#C4574B",
              }}
            />
          </div>
          <div className="text-[11px] text-[#8C857B] mt-2">
            {stats.erledigteTickets} von {stats.totalTickets} Tickets erledigt
          </div>
        </div>

        <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm font-semibold text-[#2D2A26]">KI-Health-Score</span>
            <span className="text-2xl font-bold text-[#7C6CAB] tabular-nums">{health}</span>
          </div>
          <div className="w-full h-3 bg-[#FAF8F5] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-[#7C6CAB] to-[#5B6ABF]"
              style={{ width: `${health}%` }}
            />
          </div>
          <div className="text-[11px] text-[#8C857B] mt-2">
            {health >= 80 ? "Exzellent" : health >= 60 ? "Gut" : health >= 40 ? "Okay" : "Kritisch"}
          </div>
        </div>
      </div>

      {/* Listen */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Neueste Nutzer */}
        <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#2D2A26]">Neueste Nutzer</h3>
            <button
              onClick={() => router.push("/dashboard-admin/nutzer")}
              className="text-[11px] text-[#7C6CAB] hover:text-[#5B4E8A] font-medium transition-colors"
            >
              Alle ansehen →
            </button>
          </div>
          {stats.recentUsers.length === 0 ? (
            <p className="text-sm text-[#8C857B] text-center py-6">Keine Nutzer vorhanden</p>
          ) : (
            <ul className="space-y-1">
              {stats.recentUsers.map(u => (
                <li key={u.id}>
                  <button
                    onClick={() => router.push("/dashboard-admin/nutzer")}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[#FAF8F5] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C6CAB] to-[#5B6ABF] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {(u.name || u.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-[#2D2A26] truncate">{u.name || u.email}</div>
                      <div className="text-[11px] text-[#8C857B]">{new Date(u.created_at).toLocaleDateString("de")}</div>
                    </div>
                    <RolleBadge rolle={u.rolle} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Neueste Tickets */}
        <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#2D2A26]">Neueste Tickets</h3>
            <button
              onClick={() => router.push("/dashboard-verwalter/tickets")}
              className="text-[11px] text-[#7C6CAB] hover:text-[#5B4E8A] font-medium transition-colors"
            >
              Alle ansehen →
            </button>
          </div>
          {stats.recentTickets.length === 0 ? (
            <p className="text-sm text-[#8C857B] text-center py-6">Keine Tickets vorhanden</p>
          ) : (
            <ul className="space-y-1">
              {stats.recentTickets.map(t => (
                <li key={t.id}>
                  <button
                    onClick={() => router.push(`/ticket/${t.id}`)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[#FAF8F5] transition-colors text-left"
                  >
                    <StatusBadge status={t.status} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#2D2A26] truncate">{t.titel}</div>
                      <div className="text-[11px] text-[#8C857B]">{new Date(t.created_at).toLocaleDateString("de")}</div>
                    </div>
                    {(t.angebote?.length ?? 0) > 0 && (
                      <span className="text-[11px] font-semibold text-[#3D8B7A] flex-shrink-0">
                        {t.angebote!.length} Angebot{t.angebote!.length === 1 ? "" : "e"}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Sub-Components
// ============================================================

function KpiCard({
  label, value, farbe, trend, sparkline,
}: {
  label: string
  value: number | string
  farbe: string
  trend?: { delta: number | null; richtung: "up" | "down" | "flat" | "none" }
  sparkline?: number[]
}) {
  return (
    <div className="bg-white border border-[#EDE8E1] rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: farbe + "15" }}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: farbe }} />
        </div>
        {trend && <TrendBadge t={trend} />}
      </div>
      <div className="text-2xl font-bold text-[#2D2A26] tabular-nums">{value}</div>
      <div className="text-[10px] text-[#8C857B] mt-1 font-medium uppercase tracking-wider">{label}</div>
      {sparkline && sparkline.length > 0 && (
        <div className="mt-3 flex items-end gap-0.5 h-6">
          {(() => {
            const max = Math.max(...sparkline, 1)
            return sparkline.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all"
                style={{
                  height: `${Math.max(4, (v / max) * 100)}%`,
                  background: i === sparkline.length - 1 ? farbe : farbe + "55",
                }}
              />
            ))
          })()}
        </div>
      )}
    </div>
  )
}

function TrendBadge({ t }: { t: { delta: number | null; richtung: "up" | "down" | "flat" | "none" } }) {
  if (t.delta == null) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#8C857B]">
        <Minus size={10} /> —
      </span>
    )
  }
  if (t.richtung === "up") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#3D8B7A] bg-[#3D8B7A]/10 px-1.5 py-0.5 rounded-full">
        <TrendingUp size={10} /> {t.delta}%
      </span>
    )
  }
  if (t.richtung === "down") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#C4574B] bg-[#C4574B]/10 px-1.5 py-0.5 rounded-full">
        <TrendingDown size={10} /> {t.delta}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#8C857B]">
      <Minus size={10} /> 0%
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    offen:          { label: "Offen",          bg: "bg-[#C4574B]/10", fg: "text-[#C4574B]" },
    auktion:        { label: "Auktion",        bg: "bg-[#5B6ABF]/10", fg: "text-[#5B6ABF]" },
    in_bearbeitung: { label: "In Arbeit",      bg: "bg-[#C4956A]/10", fg: "text-[#C4956A]" },
    erledigt:       { label: "Erledigt",       bg: "bg-[#3D8B7A]/10", fg: "text-[#3D8B7A]" },
  }
  const c = map[status] ?? { label: status, bg: "bg-[#EDE8E1]", fg: "text-[#6B665E]" }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${c.bg} ${c.fg}`}>
      {c.label}
    </span>
  )
}

function RolleBadge({ rolle }: { rolle: string | null }) {
  if (!rolle) return null
  const map: Record<string, string> = {
    admin:      "bg-[#7C6CAB]/10 text-[#7C6CAB]",
    verwalter:  "bg-[#3D8B7A]/10 text-[#3D8B7A]",
    handwerker: "bg-[#C4956A]/10 text-[#C4956A]",
    mieter:     "bg-[#5B6ABF]/10 text-[#5B6ABF]",
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${map[rolle] ?? "bg-[#EDE8E1] text-[#6B665E]"}`}>
      {rolle}
    </span>
  )
}
