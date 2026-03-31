"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { Badge, StatusDot, Button, Card, EmptyState, LoadingSpinner, SectionHeader } from "@/components/ui"

export default function MieterDashboard() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const { data } = await supabase.from("tickets").select("*")
        .eq("erstellt_von", user.id).order("created_at", { ascending: false })

      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  const offen = tickets.filter(t => t.status !== "erledigt")
  const erledigt = tickets.filter(t => t.status === "erledigt")

  if (loading) return <LoadingSpinner />

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)]">Meine Übersicht</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Deine gemeldeten Schäden &amp; Tickets</p>
        </div>
        <Button onClick={() => router.push("/dashboard-mieter/melden")} size="lg">
          + Schaden melden
        </Button>
      </div>

      {/* Alles OK Banner */}
      {offen.length === 0 && tickets.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 mb-6 animate-scale-in">
          <div className="flex items-center gap-3">
            <span className="text-2xl">&#10003;</span>
            <div>
              <div className="text-sm font-bold text-emerald-700">Alles in Ordnung</div>
              <div className="text-[12px] text-emerald-600 mt-0.5">Keine offenen Schäden gemeldet.</div>
            </div>
          </div>
        </div>
      )}
      {/* Offene Meldungen */}
      {offen.length > 0 && (
        <>
          <SectionHeader title={`Offene Meldungen (${offen.length})`} />
          <div className="flex flex-col gap-2.5 mb-8 stagger">
            {offen.map(t => (
              <Card key={t.id} className="!p-4" onClick={() => router.push(`/ticket/${t.id}`)}>
                <div className="flex items-center gap-4">
                  <StatusDot status={t.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-[var(--text)]">{t.titel}</div>
                    <div className="text-[12px] text-[var(--text-muted)] mt-0.5">
                      Gemeldet am {new Date(t.created_at).toLocaleDateString("de")}
                    </div>
                  </div>
                  <Badge status={t.status} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Erledigte */}
      {erledigt.length > 0 && (
        <>
          <SectionHeader title={`Erledigt (${erledigt.length})`} />
          <div className="flex flex-col gap-2 stagger">
            {erledigt.map(t => (
              <Card key={t.id} className="!p-4 opacity-70">
                <div className="flex items-center gap-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <div className="flex-1 text-sm text-[var(--text-secondary)] truncate">{t.titel}</div>
                  <Badge status={t.status} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {tickets.length === 0 && (
        <EmptyState
          icon="🏠"
          title="Noch keine Meldungen"
          desc="Melde einen Schaden und deine Verwaltung wird sofort benachrichtigt."
          action={<Button onClick={() => router.push("/dashboard-mieter/melden")} size="lg">Ersten Schaden melden</Button>}
        />
      )}
    </div>
  )
}
