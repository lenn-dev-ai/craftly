"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { Badge, StatusDot, MetricCard, Button, Card, EmptyState, LoadingSpinner, SectionHeader } from "@/components/ui"

export default function VerwalterDashboard() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const { data } = await supabase
        .from("tickets").select("*, objekte(*), angebote(*)")
        .eq("erstellt_von", user.id).order("created_at", { ascending: false })

      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  const offen = tickets.filter(t => t.status === "offen").length
  const auktion = tickets.filter(t => t.status === "auktion").length
  const inArbeit = tickets.filter(t => t.status === "in_bearbeitung").length
  const erledigt = tickets.filter(t => t.status === "erledigt").length
  const gesamtkosten = tickets.filter(t => t.kosten_final).reduce((s, t) => s + (t.kosten_final || 0), 0)

  if (loading) return <LoadingSpinner />

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Hero Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)]">Dashboard</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {tickets.length} Tickets insgesamt &middot; {offen + auktion} aktiv
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard-verwalter/neues-ticket")} size="lg">
          + Neues Ticket
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 stagger">
        <MetricCard label="Offen" value={offen} icon="📌" />
        <MetricCard label="Auktionen" value={auktion} icon="⏱" sub={auktion > 0 ? "Gebote laufen" : undefined} />
        <MetricCard label="In Arbeit" value={inArbeit} icon="🔨" />
        <MetricCard label="Kosten MTD" value={`${gesamtkosten.toLocaleString("de")} \u20AC`} icon="💰" />
      </div>

      {/* Ticket Liste */}
      <SectionHeader title="Aktuelle Tickets" action={
        tickets.length > 8 ? (
          <button onClick={() => router.push("/dashboard-verwalter/tickets")}
            className="text-[12px] font-semibold text-[var(--green)] hover:underline underline-offset-2">
            Alle anzeigen &rarr;
          </button>
        ) : undefined
      } />

      {tickets.length === 0 ? (
        <EmptyState
          icon="🎫"
          title="Noch keine Tickets"
          desc="Erstelle dein erstes Ticket um Handwerker per Auktion zu beauftragen."
          action={
            <Button onClick={() => router.push("/dashboard-verwalter/neues-ticket")} size="lg">
              Erstes Ticket erstellen
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5 stagger">
          {tickets.slice(0, 8).map(t => (
            <Card key={t.id} className="!p-4" onClick={() => router.push(`/ticket/${t.id}`)}>
              <div className="flex items-center gap-4">
                <StatusDot status={t.status} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate text-[var(--text)]">{t.titel}</div>
                  <div className="text-[12px] text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                    {t.wohnung && <span>{t.wohnung}</span>}
                    {t.wohnung && t.angebote && <span>&middot;</span>}
                    {t.angebote?.length ? (
                      <span className="font-medium">{t.angebote.length} Angebot{t.angebote.length !== 1 ? "e" : ""}</span>
                    ) : (
                      <span>Keine Angebote</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {t.angebote && t.angebote.length > 0 && (
                    <span className="text-sm font-bold text-[var(--green)] tabular-nums">
                      {Math.min(...t.angebote.map(a => a.preis)).toLocaleString("de")} &euro;
                    </span>
                  )}
                  <Badge status={t.status} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {erledigt > 0 && (
        <div className="mt-6 text-center">
          <span className="text-[12px] text-[var(--text-muted)]">{erledigt} erledigte Tickets &middot; </span>
          <button onClick={() => router.push("/dashboard-verwalter/tickets")}
            className="text-[12px] font-semibold text-[var(--green)] hover:underline">
            Alle anzeigen
          </button>
        </div>
      )}
    </div>
  )
}
