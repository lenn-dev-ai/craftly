"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

/* KI: Aktivitaets-Score pro Nutzer */
function kiAktivitaetsScore(user: any, tickets: any[], angebote: any[]): number {
  let score = 0
  if (user.rolle === "verwalter") {
    const created = tickets.filter(t => t.ersteller_id === user.id).length
    score = Math.min(created * 20, 100)
  } else if (user.rolle === "handwerker") {
    const bids = angebote.filter(a => a.handwerker_id === user.id).length
    score = Math.min(bids * 25, 100)
  } else if (user.rolle === "mieter") {
    const reports = tickets.filter(t => t.melder_id === user.id).length
    score = Math.min(reports * 30, 100)
  } else {
    score = 80
  }
  return score
}

/* KI: Risiko-Erkennung */
function kiRisiko(users: any[]): string[] {
  const w: string[] = []
  const admins = users.filter(u => u.rolle === "admin")
  if (admins.length > 3) w.push(admins.length + " Admin-Accounts - zu viele Admins erhoehen Sicherheitsrisiko")
  const noName = users.filter(u => !u.name || u.name.trim() === "")
  if (noName.length > 0) w.push(noName.length + " Nutzer ohne Namen - Profil unvollstaendig")
  const hw = users.filter(u => u.rolle === "handwerker")
  const hwNoGewerk = hw.filter(u => !u.gewerk)
  if (hwNoGewerk.length > 0) w.push(hwNoGewerk.length + " Handwerker ohne Gewerk - koennen nicht zugeordnet werden")
  return w
}

export default function NutzerPage() {
  const [users, setUsers] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [angebote, setAngebote] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("alle")
  const [search, setSearch] = useState("")

  async function load() {
    const supabase = createClient()
    const [{ data: p }, { data: t }, { data: a }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("tickets").select("*"),
      supabase.from("angebote").select("*"),
    ])
    setUsers(p || [])
    setTickets(t || [])
    setAngebote(a || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter(u => {
    if (filter !== "alle" && u.rolle !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      return (u.name || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s) || (u.firma || "").toLowerCase().includes(s)
    }
    return true
  })

  async function changeRolle(userId: string, newRolle: string) {
    const supabase = createClient()
    await supabase.from("profiles").update({ rolle: newRolle }).eq("id", userId)
    await load()
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#8B5CF6]/20 border-t-[#8B5CF6] rounded-full animate-spin" />
    </div>
  )

  const risiken = kiRisiko(users)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Nutzer-Verwaltung</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} registrierte Accounts</p>
        </div>
        <div className="flex gap-2">
          {[
            { label: "Verwalter", count: users.filter(u => u.rolle === "verwalter").length, color: "#00D4AA" },
            { label: "Handwerker", count: users.filter(u => u.rolle === "handwerker").length, color: "#00B4D8" },
            { label: "Mieter", count: users.filter(u => u.rolle === "mieter").length, color: "#F59E0B" },
          ].map((r, i) => (
            <div key={i} className="px-3 py-1.5 bg-[#12121a] border border-white/[0.06] rounded-xl flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
              <span className="text-[11px] text-gray-400">{r.count}</span>
            </div>
          ))}
        </div>
      </div>

      {risiken.length > 0 && (
        <div className="mb-6 p-4 bg-[#FF6363]/[0.06] border border-[#FF6363]/20 rounded-2xl">
          <span className="text-xs font-bold text-[#FF6363] uppercase tracking-wider">KI Risiko-Erkennung</span>
          <div className="space-y-1.5 mt-2">
            {risiken.map((r, i) => (
              <div key={i} className="text-sm text-[#FF6363]/80 flex items-start gap-2">
                <span className="text-[#FF6363] mt-0.5 text-xs">*</span> {r}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input type="text" placeholder="Suche nach Name, E-Mail, Firma..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#8B5CF6]/40 w-72" />
        {["alle", "verwalter", "handwerker", "mieter", "admin"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={"px-3 py-1.5 rounded-full text-xs font-medium border transition-all " + (filter === f
              ? "bg-[#8B5CF6] text-white border-[#8B5CF6]"
              : "bg-white/[0.04] text-gray-400 border-white/[0.08] hover:border-white/[0.15]")}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1 opacity-70">{f === "alle" ? users.length : users.filter(u => u.rolle === f).length}</span>
          </button>
        ))}
      </div>

      <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Nutzer</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Rolle</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">KI Score</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Erstellt</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Details</th>
                <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const score = kiAktivitaetsScore(u, tickets, angebote)
                return (
                  <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #8B5CF6, #00B4D8)", color: "#fff" }}>
                          {(u.name || u.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{u.name || "---"}</div>
                          <div className="text-[11px] text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider " + (
                        u.rolle === "admin" ? "bg-purple-500/15 text-purple-400"
                        : u.rolle === "verwalter" ? "bg-emerald-500/15 text-emerald-400"
                        : u.rolle === "handwerker" ? "bg-blue-500/15 text-blue-400"
                        : "bg-amber-500/15 text-amber-400"
                      )}>{u.rolle}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: score + "%", background: score >= 60 ? "#00D4AA" : score >= 30 ? "#F59E0B" : "#FF6363" }} />
                        </div>
                        <span className={"text-[10px] font-bold " + (score >= 60 ? "text-[#00D4AA]" : score >= 30 ? "text-[#F59E0B]" : "text-[#FF6363]")}>{score}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-400">{new Date(u.created_at).toLocaleDateString("de")}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">
                      {u.firma && <span className="text-gray-400">{u.firma}</span>}
                      {u.gewerk && <span className="ml-2 text-[11px] bg-white/[0.06] px-2 py-0.5 rounded">{u.gewerk}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <select value={u.rolle} onChange={e => changeRolle(u.id, e.target.value)}
                        className="text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-gray-300 cursor-pointer focus:outline-none">
                        <option value="verwalter">Verwalter</option>
                        <option value="handwerker">Handwerker</option>
                        <option value="mieter">Mieter</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, Button, LoadingSpinner } from "@/components/ui"

export default function NutzerPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("alle")
  const [search, setSearch] = useState("")

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter(u => {
    if (filter !== "alle" && u.rolle !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      return (u.name || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s) || (u.firma || "").toLowerCase().includes(s)
    }
    return true
  })

  async function changeRolle(userId: string, newRolle: string) {
    const supabase = createClient()
    await supabase.from("profiles").update({ rolle: newRolle }).eq("id", userId)
    await load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Nutzer-Verwaltung</h1>
          <p className="text-sm text-gray-400 mt-1">{users.length} registrierte Accounts</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input type="text" placeholder="Suche nach Name, E-Mail, Firma..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4AA]/40 w-72" />
        {["alle", "verwalter", "handwerker", "mieter", "admin"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filter === f
                ? "bg-[#00D4AA] text-white border-[#00D4AA]"
                : "bg-white/[0.04] text-gray-400 border-white/[0.08] hover:border-white/[0.15]"
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1 opacity-70">
              {f === "alle" ? users.length : users.filter(u => u.rolle === f).length}
            </span>
          </button>
        ))}
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Nutzer</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Rolle</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Erstellt</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Details</th>
                <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #00D4AA, #00B4D8)", color: "#fff" }}>
                        {(u.name || u.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{u.name || "---"}</div>
                        <div className="text-[11px] text-gray-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      u.rolle === "verwalter" ? "bg-emerald-500/15 text-emerald-400" :
                      u.rolle === "handwerker" ? "bg-blue-500/15 text-blue-400" :
                      u.rolle === "admin" ? "bg-purple-500/15 text-purple-400" :
                      "bg-amber-500/15 text-amber-400"
                    }`}>{u.rolle}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-400">
                    {new Date(u.created_at).toLocaleDateString("de")}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    {u.firma && <span className="text-gray-400">{u.firma}</span>}
                    {u.gewerk && <span className="ml-2 text-[11px] bg-white/[0.06] px-2 py-0.5 rounded">{u.gewerk}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <select value={u.rolle} onChange={e => changeRolle(u.id, e.target.value)}
                      className="text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-gray-300 cursor-pointer focus:outline-none">
                      <option value="verwalter">Verwalter</option>
                      <option value="handwerker">Handwerker</option>
                      <option value="mieter">Mieter</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
