"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"

export default function AuftraegePage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase.from("tickets").select("*")
        .eq("zugewiesener_hw", user.id).order("created_at", { ascending: false })
      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-[#3D8B7A] rounded-full animate-spin" />
        <span className="text-sm text-ink-muted">Lädt...</span>
      </div>
    </div>
  )

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pt-16 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Meine Aufträge</h1>
        <p className="text-sm text-ink-muted mt-1">{tickets.length} zugewiesene Aufträge</p>
      </div>
      {tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-line p-12 text-center">
          <div className="text-4xl mb-3">&#128203;</div>
          <div className="text-lg font-semibold text-ink mb-1">Noch keine Aufträge</div>
          <div className="text-sm text-ink-muted">
            Du wirst hier benachrichtigt sobald dir ein Auftrag vergeben wird.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map(t => (
            <div
              key={t.id}
              className="bg-white rounded-xl border border-line p-4 cursor-pointer hover:border-accent/30 hover:shadow-sm transition-all"
              onClick={() => router.push(`/dashboard-handwerker/ticket/${t.id}`)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  t.status === "erledigt" ? "bg-accent" : t.status === "fertiggestellt_hw" ? "bg-status-auktion" : "bg-warm"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{t.titel}</div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {t.wohnung && `${t.wohnung} · `}
                    {new Date(t.created_at).toLocaleDateString("de")}
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  t.status === "erledigt"
                    ? "bg-accent/8 text-accent border border-accent/15"
                    : t.status === "fertiggestellt_hw"
                    ? "bg-status-auktion/10 text-status-auktion border border-status-auktion/15"
                    : t.status === "in_bearbeitung"
                    ? "bg-warm/10 text-warm border border-warm/15"
                    : t.status === "auktion"
                    ? "bg-accent/8 text-accent border border-accent/15"
                    : "bg-line text-ink-secondary border border-line"
                }`}>
                  {t.status === "erledigt" ? "Erledigt"
                    : t.status === "fertiggestellt_hw" ? "Wartet auf Bestätigung"
                    : t.status === "in_bearbeitung" ? "In Arbeit"
                    : t.status === "auktion" ? "Auktion"
                    : t.status === "offen" ? "Offen"
                    : t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
