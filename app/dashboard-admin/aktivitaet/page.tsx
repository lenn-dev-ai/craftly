"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, LoadingSpinner } from "@/components/ui"

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

      const p = profiles || []
      const t = tickets || []
      const a = angebote || []

      const days = 7
      const today = new Date()
      const timeline: { date: string; tickets: number; users: number; angebote: number }[] = []

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
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
        ...t.map(x => ({ type: "ticket", title: x.titel, date: x.created_at, detail: x.status })),
        ...p.map(x => ({ type: "user", title: x.name || x.email, date: x.created_at, detail: x.rolle })),
        ...a.map(x => ({ type: "angebot", title: `Angebot: ${x.preis} EUR`, date: x.created_at, detail: x.status })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20)

      setData({ timeline, activity, totalAngebote: a.length })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />
  if (!data) return null

  const maxVal = Math.max(...data.timeline.map((d: any) => d.tickets + d.users + d.angebote), 1)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Aktivitaet</h1>
        <p className="text-sm text-gray-400 mt-1">Plattform-Aktivitaet der letzten 7 Tage</p>
      </div>

      <Card className="mb-6">
        <h3 className="text-sm font-semibold text-white mb-6">Aktivitaets-Verlauf (7 Tage)</h3>
        <div className="flex items-end gap-3 h-40">
          {data.timeline.map((d: any, i: number) => {
            const total = d.tickets + d.users + d.angebote
            const height = maxVal > 0 ? (total / maxVal) * 100 : 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center justify-end h-32">
                  <span className="text-[11px] font-bold text-white mb-1">{total}</span>
                  <div className="w-full max-w-[32px] rounded-t-lg transition-all"
                    style={{
                      height: `${Math.max(height, 4)}%`,
                      background: "linear-gradient(to top, #00D4AA, #00B4D8)",
                      opacity: total === 0 ? 0.2 : 1,
                    }} />
                </div>
                <span className="text-[10px] text-gray-500 text-center leading-tight">{d.date}</span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#00D4AA]" />
            <span className="text-[11px] text-gray-400">Tickets + Nutzer + Angebote</span>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-white mb-4">Letzte Aktivitaeten</h3>
        <div className="space-y-2">
          {data.activity.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
              <span className="text-base flex-shrink-0">
                {a.type === "ticket" ? "T" : a.type === "user" ? "U" : "A"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{a.title}</div>
                <div className="text-[11px] text-gray-500">
                  {a.type === "ticket" ? "Ticket" : a.type === "user" ? "Registrierung" : "Angebot"}
                  {" - "}{a.detail}
                </div>
              </div>
              <span className="text-[11px] text-gray-500 flex-shrink-0">
                {new Date(a.date).toLocaleDateString("de")}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
