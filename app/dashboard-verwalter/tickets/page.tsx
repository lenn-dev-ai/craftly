"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, TicketStatus } from "@/types"
import { Badge, TypBadge, StatusDot, EmptyState } from "@/components/ui"
import { CardListSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton"

type StatusFilter = TicketStatus | "alle"
type TypFilter = "alle" | "standard" | "diagnose" | "projekt"

const STATUS_FILTER: { label: string; value: StatusFilter }[] = [
  { label: "Alle", value: "alle" },
  { label: "Offen", value: "offen" },
  { label: "Auktion", value: "auktion" },
  { label: "In Bearbeitung", value: "in_bearbeitung" },
  { label: "Erledigt", value: "erledigt" },
]

const TYP_FILTER: { label: string; value: TypFilter; farbe: string }[] = [
  { label: "Alle", value: "alle", farbe: "border-line" },
  { label: "Standard", value: "standard", farbe: "border-[#5B6ABF]/40" },
  { label: "Diagnose", value: "diagnose", farbe: "border-[#7C6CAB]/40" },
  { label: "Projekt", value: "projekt", farbe: "border-accent/40" },
]

const ALLOWED_STATUS: StatusFilter[] = ["alle", "offen", "auktion", "in_bearbeitung", "erledigt"]

export default function TicketsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tickets, setTickets] = useState<Ticket[]>([])
  // Status-Filter aus ?status=... initialisieren (Drill-Down von den
  // klickbaren KPI-Cards auf /dashboard-admin).
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const s = searchParams.get("status") as StatusFilter | null
    return s && ALLOWED_STATUS.includes(s) ? s : "alle"
  })
  const [typFilter, setTypFilter] = useState<TypFilter>("alle")
  const [loading, setLoading] = useState(true)
  // Audit-H5: Sort-Toggle. lokaler State, kein URL-Param —
  // Standard-Reihenfolge bleibt "neueste zuerst" wie bisher.
  const [sort, setSort] = useState<"neu" | "alt" | "prio" | "status">("neu")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase
        .from("tickets").select("*, angebote(*)")
        .eq("verwalter_id", user.id).order("created_at", { ascending: false })
      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  // Audit-H5: Sortier-Reihenfolgen
  const PRIO_RANK: Record<string, number> = { notfall: 0, zeitnah: 1, planbar: 2 }
  const STATUS_RANK: Record<string, number> = { offen: 0, auktion: 1, in_bearbeitung: 2, erledigt: 3 }
  const shown = tickets
    .filter(t => statusFilter === "alle" || t.status === statusFilter)
    .filter(t => typFilter === "alle" || (t.ticket_typ ?? "standard") === typFilter)
    .slice()
    .sort((a, b) => {
      if (sort === "neu") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === "alt") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === "prio") {
        const ra = PRIO_RANK[a.prioritaet] ?? 99
        const rb = PRIO_RANK[b.prioritaet] ?? 99
        return ra - rb || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      // status
      const sa = STATUS_RANK[a.status] ?? 99
      const sb = STATUS_RANK[b.status] ?? 99
      return sa - sb || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const typCount = (val: TypFilter) =>
    val === "alle" ? tickets.length : tickets.filter(t => (t.ticket_typ ?? "standard") === val).length

  // Audit-Fix (2026-06-15, Quick-Win): vor dem ersten Laden flackerte kurz
  // "0 Tickets insgesamt" + "0" in allen Filter-Pills auf, bevor die echten
  // Zahlen da waren. Jetzt zeigt der gesamte Header-Bereich ein Skeleton,
  // bis `tickets` geladen ist (analog zu /dashboard-verwalter).
  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto pt-16 md:pt-6">
        <PageHeaderSkeleton />
        <CardListSkeleton count={4} rows={2} />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto pt-16 md:pt-6">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-ink">Alle Tickets</h1>
          <p className="text-sm text-ink-muted mt-0.5">{tickets.length} Tickets insgesamt</p>
        </div>
        <div className="text-xs text-ink-muted max-w-xs text-right">
          Tickets werden von Mietern gemeldet.
          Für eigene Aufträge zum{" "}
          <button
            onClick={() => router.push("/dashboard-verwalter/marktplatz")}
            className="text-accent hover:underline font-medium"
          >
            Handwerker-Marktplatz
          </button>.
        </div>
      </div>

      {/* Typ-Filter — Diagnose/Projekt aus dem Standard-Pool aussondern */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {TYP_FILTER.map(opt => {
          const aktiv = typFilter === opt.value
          const n = typCount(opt.value)
          return (
            <button
              key={opt.value}
              onClick={() => setTypFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                aktiv
                  ? `bg-surface text-ink ${opt.farbe}`
                  : "bg-white text-ink-muted border-line hover:border-[#8C857B]/30"
              }`}
            >
              {opt.label}
              <span className={`ml-1.5 ${aktiv ? "text-ink" : "text-ink-muted"}`}>{n}</span>
            </button>
          )
        })}
      </div>

      {/* Status-Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_FILTER.map(opt => {
          const aktiv = statusFilter === opt.value
          const n = opt.value === "alle"
            ? tickets.filter(t => typFilter === "alle" || (t.ticket_typ ?? "standard") === typFilter).length
            : tickets.filter(t =>
                t.status === opt.value
                && (typFilter === "alle" || (t.ticket_typ ?? "standard") === typFilter),
              ).length
          return (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                aktiv
                  ? "bg-accent text-white border-[#3D8B7A]"
                  : "bg-white text-ink-muted border-line hover:border-[#8C857B]/30"
              }`}
            >
              {opt.label}
              <span className={`ml-1.5 ${aktiv ? "text-white/80" : "text-ink-muted"}`}>{n}</span>
            </button>
          )
        })}
      </div>

      {/* Audit-H5: Sort-Toggle */}
      <div className="flex items-center gap-2 mb-4">
        <label htmlFor="ticket-sort" className="text-xs text-ink-muted">Sortierung:</label>
        <select
          id="ticket-sort"
          value={sort}
          onChange={e => setSort(e.target.value as typeof sort)}
          className="text-xs bg-white border border-line rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent/40"
        >
          <option value="neu">Neueste zuerst</option>
          <option value="alt">Älteste zuerst</option>
          <option value="prio">Priorität (Notfall zuerst)</option>
          <option value="status">Status (Offen zuerst)</option>
        </select>
      </div>

      {shown.length === 0 ? (
        (() => {
          const hatFilter = statusFilter !== "alle" || typFilter !== "alle"
          const titel = hatFilter
            ? "Keine Tickets passen zum Filter"
            : tickets.length === 0
              ? "Noch keine Tickets"
              : "Keine Tickets in dieser Ansicht"
          const beschreibung = hatFilter
            ? `Aktiv: ${[
                statusFilter !== "alle" ? `Status "${statusFilter}"` : null,
                typFilter !== "alle" ? `Typ "${typFilter}"` : null,
              ].filter(Boolean).join(" + ")}. Filter zurücksetzen oder Mieter-Meldungen abwarten.`
            : "Tickets entstehen durch Mieter-Meldungen oder durch deinen eigenen Wizard (+ Neues Ticket)."
          return (
            <EmptyState
              icon="📋"
              title={titel}
              desc={beschreibung}
              action={hatFilter ? (
                <button
                  onClick={() => { setStatusFilter("alle"); setTypFilter("alle") }}
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Filter zurücksetzen
                </button>
              ) : (
                <a
                  href="/dashboard-verwalter/neues-ticket"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  + Neues Ticket anlegen
                </a>
              )}
            />
          )
        })()
      ) : (
        // Sprint AB2 — Tabelle statt Card-pro-Zeile. Dense, Enterprise-
        // Look. Card-Wrapper bleibt für den Border-Container, aber
        // Zeilen-Padding ist reduziert + Header-Zeile + Zebra-Hover.
        <div className="bg-white border border-line rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted/50 border-b border-line">
                <tr className="text-left text-[10px] uppercase tracking-wider text-ink-muted">
                  <th className="py-2 pl-4 pr-2 w-6" aria-label="Status" />
                  <th className="py-2 px-2">Titel</th>
                  <th className="py-2 px-2 hidden md:table-cell">Wohnung</th>
                  <th className="py-2 px-2 hidden sm:table-cell">Eingang</th>
                  <th className="py-2 px-2 hidden lg:table-cell">Aktivität</th>
                  <th className="py-2 px-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(t => {
                  const typ = (t.ticket_typ ?? "standard") as "standard" | "diagnose" | "projekt"
                  const angebotCount = t.angebote?.length ?? 0
                  const minPreis = angebotCount > 0
                    ? Math.min(...t.angebote!.map((a: { preis: number }) => a.preis))
                    : null
                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/dashboard-verwalter/ticket/${t.id}`)}
                      className="border-b border-line last:border-0 hover:bg-surface-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="py-2 pl-4 pr-2"><StatusDot status={t.status} /></td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-ink truncate">{t.titel}</span>
                          {typ !== "standard" && <TypBadge typ={typ} />}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-ink-muted hidden md:table-cell truncate max-w-[180px]">{t.wohnung || "—"}</td>
                      <td className="py-2 px-2 text-ink-muted hidden sm:table-cell whitespace-nowrap">
                        {new Date(t.created_at).toLocaleDateString("de")}
                      </td>
                      <td className="py-2 px-2 text-ink-muted hidden lg:table-cell whitespace-nowrap">
                        {minPreis != null
                          ? `${angebotCount} Angebot${angebotCount !== 1 ? "e" : ""} · ab ${minPreis.toLocaleString("de")} €`
                          : typ === "diagnose" && t.befund_text ? "Befund liegt vor" : "—"}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <Badge status={t.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
