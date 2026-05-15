"use client"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/components/Toast"
import { formatGewerk } from "@/types"

/* KI: Aktivitaets-Score pro Nutzer.
   FIX-10: Spalten heißen `erstellt_von` (für sowohl Verwalter- als auch
   Mieter-erstellte Tickets) — vorher gegrept gegen ersteller_id /
   melder_id, die es nicht gibt → Score immer 0. */
function kiAktivitaetsScore(user: any, tickets: any[], angebote: any[]): number {
  let score = 0
  if (user.rolle === "verwalter") {
    // Verwalter: Tickets die er selbst angelegt hat ODER für die er
    // verantwortlich ist (verwalter_id-Auto-Fill).
    const owned = tickets.filter(t => t.erstellt_von === user.id || t.verwalter_id === user.id).length
    score = Math.min(owned * 20, 100)
  } else if (user.rolle === "handwerker") {
    const bids = angebote.filter(a => a.handwerker_id === user.id).length
    score = Math.min(bids * 25, 100)
  } else if (user.rolle === "mieter") {
    const reports = tickets.filter(t => t.erstellt_von === user.id).length
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
  if (admins.length > 3) w.push(admins.length + " Admin-Accounts - zu viele Admins erhöhen Sicherheitsrisiko")
  const noName = users.filter(u => !u.name || u.name.trim() === "")
  if (noName.length > 0) w.push(noName.length + " Nutzer ohne Namen - Profil unvollständig")
  const hw = users.filter(u => u.rolle === "handwerker")
  const hwNoGewerk = hw.filter(u => !u.gewerk)
  if (hwNoGewerk.length > 0) w.push(hwNoGewerk.length + " Handwerker ohne Gewerk - können nicht zugeordnet werden")
  return w
}

export default function NutzerPage() {
  const { confirm, show } = useToast()
  const searchParams = useSearchParams()
  const [users, setUsers] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [angebote, setAngebote] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // Filter aus ?rolle=... initialisieren (kommt aus den klickbaren KPI-
  // Cards auf /dashboard-admin). Erlaubte Werte sync mit den Filter-Tabs.
  const [filter, setFilter] = useState(() => {
    const rolle = searchParams.get("rolle")
    return rolle && ["verwalter", "handwerker", "mieter", "admin"].includes(rolle) ? rolle : "alle"
  })
  // Such-Begriff aus ?q=... initialisieren (kommt aus Admin-Dashboard-Header)
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)
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

  const dashboardZiel: Record<string, string> = {
    admin: "/dashboard-admin",
    verwalter: "/dashboard-verwalter",
    handwerker: "/dashboard-handwerker",
    mieter: "/dashboard-mieter",
  }

  async function changeRolle(userId: string, newRolle: string, currentRolle: string) {
    const istSelf = userId === currentUserId
    const istSelfDemote = istSelf && currentRolle === "admin" && newRolle !== "admin"

    if (istSelfDemote) {
      const ok = await confirm(
        `Du entziehst dir selbst die Admin-Rolle und wirst zu '${newRolle}'.\n\n` +
        `Wichtig: Danach kannst du dieses Admin-Panel nicht mehr betreten und ` +
        `dich nicht selbst zurück zum Admin machen. Ein anderer Admin (oder direkter ` +
        `Datenbank-Zugriff) wäre nötig.\n\n` +
        `Wirklich fortfahren?`
      )
      if (!ok) return
    } else if (istSelf && newRolle === currentRolle) {
      return
    } else if (istSelf) {
      const ok = await confirm(
        `Du änderst deine eigene Rolle von '${currentRolle}' auf '${newRolle}'. Fortfahren?`
      )
      if (!ok) return
    }

    const supabase = createClient()
    const { error } = await supabase.from("profiles").update({ rolle: newRolle }).eq("id", userId)
    if (error) {
      show("Rolle konnte nicht geändert werden: " + error.message, "error")
      return
    }

    // Self-Update: Hard-Navigation auf das neue Dashboard, sonst wirft
    // der Admin-Layout-Guard den User auf /login (rolle != admin).
    if (istSelf) {
      window.location.href = dashboardZiel[newRolle] || "/dashboard-mieter"
      return
    }
    await load()
  }

  if (loading) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#8B5CF6]/20 border-t-[#8B5CF6] rounded-full animate-spin" />
    </div>
  )

  const risiken = kiRisiko(users)

  return (
    <div className="p-8 max-w-6xl mx-auto pt-16 md:pt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Nutzer-Verwaltung</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} registrierte Accounts</p>
        </div>
        <div className="flex gap-2">
          {[
            { label: "Verwalter", count: users.filter(u => u.rolle === "verwalter").length, color: "#3D8B7A" },
            { label: "Handwerker", count: users.filter(u => u.rolle === "handwerker").length, color: "#00B4D8" },
            { label: "Mieter", count: users.filter(u => u.rolle === "mieter").length, color: "#F59E0B" },
          ].map((r, i) => (
            <div key={i} className="px-3 py-1.5 bg-white border border-white/[0.06] rounded-xl flex items-center gap-2">
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
          className="px-4 py-2.5 bg-surface border border-white/[0.08] rounded-xl text-sm text-ink placeholder:text-gray-600 focus:outline-none focus:border-[#8B5CF6]/40 w-72" />
        {["alle", "verwalter", "handwerker", "mieter", "admin"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={"px-3 py-1.5 rounded-full text-xs font-medium border transition-all " + (filter === f
              ? "bg-[#8B5CF6] text-ink border-[#8B5CF6]"
              : "bg-surface text-gray-400 border-white/[0.08] hover:border-white/[0.15]")}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1 opacity-70">{f === "alle" ? users.length : users.filter(u => u.rolle === f).length}</span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-white/[0.06] rounded-2xl overflow-hidden">
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="text-3xl mb-2" aria-hidden="true">🔍</div>
                    <div className="text-sm font-medium text-ink">Keine Nutzer für diesen Filter</div>
                    <div className="text-xs text-ink-muted mt-1">Filter oder Suchbegriff anpassen.</div>
                  </td>
                </tr>
              )}
              {filtered.map(u => {
                const score = kiAktivitaetsScore(u, tickets, angebote)
                return (
                  <tr key={u.id} className="border-b border-white/[0.04] hover:bg-surface transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, #8B5CF6, #00B4D8)", color: "#fff" }}>
                          {(u.name || u.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-ink">{u.name || u.email || "—"}</div>
                          {u.name && <div className="text-[11px] text-gray-500">{u.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.rolle ? (
                        <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider " + (
                          u.rolle === "admin" ? "bg-rolle-admin/15 text-rolle-admin"
                          : u.rolle === "verwalter" ? "bg-accent/15 text-accent"
                          : u.rolle === "handwerker" ? "bg-warm/15 text-warm"
                          : u.rolle === "mieter" ? "bg-rolle-mieter/15 text-rolle-mieter"
                          : "bg-line text-ink-secondary"
                        )}>{u.rolle}</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-danger/10 text-danger">
                          Keine Rolle
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-surface rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: score + "%", background: score >= 60 ? "#3D8B7A" : score >= 30 ? "#F59E0B" : "#FF6363" }} />
                        </div>
                        <span className={"text-[10px] font-bold " + (score >= 60 ? "text-accent" : score >= 30 ? "text-warm" : "text-[#FF6363]")}>{score}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-400">{new Date(u.created_at).toLocaleDateString("de")}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">
                      {u.firma && <span className="text-gray-400">{u.firma}</span>}
                      {u.gewerk && <span className="ml-2 text-[11px] bg-surface px-2 py-0.5 rounded">{formatGewerk(u.gewerk)}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {u.id === currentUserId && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rolle-admin/15 text-rolle-admin">
                            Du
                          </span>
                        )}
                        <select
                          value={u.rolle}
                          onChange={e => changeRolle(u.id, e.target.value, u.rolle)}
                          className="text-xs bg-surface border border-line rounded-lg px-2 py-1 text-ink cursor-pointer focus:outline-none focus:border-[#7C6CAB]/40"
                          aria-label={`Rolle für ${u.name || u.email} ändern`}
                        >
                          <option value="verwalter">Verwalter</option>
                          <option value="handwerker">Handwerker</option>
                          <option value="mieter">Mieter</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
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
}
