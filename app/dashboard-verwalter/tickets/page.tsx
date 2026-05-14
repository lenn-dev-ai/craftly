"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, TicketStatus } from "@/types"
import { Badge, StatusDot, Card, EmptyState } from "@/components/ui"
import { CardListSkeleton } from "@/components/ui/Skeleton"

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
  { label: "Alle", value: "alle", farbe: "border-[#EDE8E1]" },
  { label: "Standard", value: "standard", farbe: "border-[#5B6ABF]/40" },
  { label: "Diagnose", value: "diagnose", farbe: "border-[#7C6CAB]/40" },
  { label: "Projekt", value: "projekt", farbe: "border-[#3D8B7A]/40" },
]

export default function TicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle")
  const [typFilter, setTypFilter] = useState<TypFilter>("alle")
  const [loading, setLoading] = useState(true)

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

  const shown = tickets
    .filter(t => statusFilter === "alle" || t.status === statusFilter)
    .filter(t => typFilter === "alle" || (t.ticket_typ ?? "standard") === typFilter)

  const typCount = (val: TypFilter) =>
    val === "alle" ? tickets.length : tickets.filter(t => (t.ticket_typ ?? "standard") === val).length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[#2D2A26]">Alle Tickets</h1>
          <p className="text-sm text-[#8C857B] mt-0.5">{tickets.length} Tickets insgesamt</p>
        </div>
        <div className="text-xs text-[#8C857B] max-w-xs text-right">
          Tickets werden von Mietern gemeldet.
          Für eigene Aufträge zum{" "}
          <button
            onClick={() => router.push("/dashboard-verwalter/marktplatz")}
            className="text-[#3D8B7A] hover:underline font-medium"
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
                  ? `bg-[#FAF8F5] text-[#2D2A26] ${opt.farbe}`
                  : "bg-white text-[#8C857B] border-[#EDE8E1] hover:border-[#8C857B]/30"
              }`}
            >
              {opt.label}
              <span className={`ml-1.5 ${aktiv ? "text-[#2D2A26]" : "text-[#B5AEA4]"}`}>{n}</span>
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
                  ? "bg-[#3D8B7A] text-white border-[#3D8B7A]"
                  : "bg-white text-[#8C857B] border-[#EDE8E1] hover:border-[#8C857B]/30"
              }`}
            >
              {opt.label}
              <span className={`ml-1.5 ${aktiv ? "text-white/80" : "text-[#B5AEA4]"}`}>{n}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <CardListSkeleton count={4} rows={2} />
      ) : shown.length === 0 ? (
        <EmptyState icon="T" title="Keine Tickets" desc="Für diese Filter-Kombination gibt es keine Tickets." />
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map(t => {
            const typ = t.ticket_typ ?? "standard"
            const typBadge = typ === "diagnose"
              ? { label: "Diagnose", color: "text-[#7C6CAB] bg-[#7C6CAB]/10 border-[#7C6CAB]/20" }
              : typ === "projekt"
                ? { label: "Projekt", color: "text-[#3D8B7A] bg-[#3D8B7A]/10 border-[#3D8B7A]/20" }
                : null
            return (
              <Card key={t.id} className="cursor-pointer hover:border-[#3D8B7A]/30 transition-colors !p-3"
                onClick={() => router.push(`/dashboard-verwalter/ticket/${t.id}`)}>
                <div className="flex items-center gap-3">
                  <StatusDot status={t.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="text-sm font-medium truncate text-[#2D2A26]">{t.titel}</div>
                      {typBadge && (
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${typBadge.color}`}>
                          {typBadge.label}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {t.wohnung && `${t.wohnung} `}
                      {new Date(t.created_at).toLocaleDateString("de")}
                      {t.angebote?.length ? ` · ${t.angebote.length} Angebot${t.angebote.length !== 1 ? "e" : ""}` : ""}
                      {typ === "diagnose" && t.befund_text && " · Befund liegt vor"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {t.angebote && t.angebote.length > 0 && (
                      <span className="text-sm font-medium text-[#3D8B7A]">
                        ab {Math.min(...t.angebote.map((a: any) => a.preis)).toLocaleString("de")} EUR
                      </span>
                    )}
                    <Badge status={t.status} />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
