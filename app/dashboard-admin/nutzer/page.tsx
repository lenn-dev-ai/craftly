"use client"

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
                                <h1 className="text-2xl font-extrabold text-white tracking-tight">Nutzer-Verwaltung</h1>h1>
                                <p className="text-sm text-gray-400 mt-1">{users.length} registrierte Accounts</p>p>
                      </div>div>
              </div>div>
        
          {/* Filters */}
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
                                </span>span>
                    </button>button>
                  ))}
              </div>div>
        
          {/* User Table */}
              <Card className="!p-0 overflow-hidden">
                      <div className="overflow-x-auto">
                                <table className="w-full">
                                            <thead>
                                                          <tr className="border-b border-white/[0.06]">
                                                                          <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Nutzer</th>th>
                                                                          <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Rolle</th>th>
                                                                          <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Erstellt</th>th>
                                                                          <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Details</th>th>
                                                                          <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Aktionen</th>th>
                                                          </tr>tr>
                                            </thead>thead>
                                            <tbody>
                                              {filtered.map(u => (
                          <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                            <td className="px-5 py-3.5">
                                                                <div className="flex items-center gap-3">
                                                                                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                                                                                                style={{ background: "linear-gradient(135deg, #00D4AA, #00B4D8)", color: "#fff" }}>
                                                                                        {(u.name || u.email || "?").charAt(0).toUpperCase()}
                                                                                        </div>div>
                                                                                      <div>
                                                                                                              <div className="text-sm font-medium text-white">{u.name || "—"}</div>div>
                                                                                                              <div className="text-[11px] text-gray-500">{u.email}</div>div>
                                                                                        </div>div>
                                                                </div>div>
                                            </td>td>
                                            <td className="px-5 py-3.5">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                  u.rolle === "verwalter" ? "bg-emerald-500/15 text-emerald-400" :
                                                  u.rolle === "handwerker" ? "bg-blue-500/15 text-blue-400" :
                                                  u.rolle === "admin" ? "bg-purple-500/15 text-purple-400" :
                                                  "bg-amber-500/15 text-amber-400"
                          }`}>{u.rolle}</span>span>
                                            </td>td>
                                            <td className="px-5 py-3.5 text-sm text-gray-400">
                                              {new Date(u.created_at).toLocaleDateString("de")}
                                            </td>td>
                                            <td className="px-5 py-3.5 text-sm text-gray-500">
                                              {u.firma && <span className="text-gray-400">{u.firma}</span>span>}
                                              {u.gewerk && <span className="ml-2 text-[11px] bg-white/[0.06] px-2 py-0.5 rounded">{u.gewerk}</span>span>}
                                            </td>td>
                                            <td className="px-5 py-3.5 text-right">
                                                                <select value={u.rolle} onChange={e => changeRolle(u.id, e.target.value)}
                                                                                        className="text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-gray-300 cursor-pointer focus:outline-none">
                                                                                      <option value="verwalter">Verwalter</option>option>
                                                                                      <option value="handwerker">Handwerker</option>option>
                                                                                      <option value="mieter">Mieter</option>option>
                                                                                      <option value="admin">Admin</option>option>
                                                                </select>select>
                                            </td>td>
                          </tr>tr>
                        ))}
                                            </tbody>tbody>
                                </table>table>
                      </div>div>
              </Card>Card>
        </div>div>
      )
}</div>
