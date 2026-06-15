"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { formatGewerk } from "@/types"

type EinnahmenTicket = {
  id: string
  titel: string
  gewerk: string | null
  status: string
  kosten_final: number | null
  created_at: string
  hw_abschluss_am: string | null
  objekte: { name: string; adresse: string }[] | null
}

function formatEuro(value: number | null | undefined): string {
  if (!value) return "–"
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

const STATUS_LABELS: Record<string, string> = {
  in_bearbeitung: "In Arbeit",
  fertiggestellt_hw: "Abzunehmen",
  erledigt: "Erledigt",
}

const STATUS_COLORS: Record<string, string> = {
  in_bearbeitung: "bg-accent/10 text-accent border-accent/20",
  fertiggestellt_hw: "bg-warm/10 text-warm border-warm/20",
  erledigt: "bg-line text-ink-muted border-line",
}

export default function EinnahmenPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<EinnahmenTicket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const { data } = await supabase
        .from("tickets")
        .select("id, titel, gewerk, status, kosten_final, created_at, hw_abschluss_am, objekte(name, adresse)")
        .eq("zugewiesener_hw", user.id)
        .in("status", ["in_bearbeitung", "fertiggestellt_hw", "erledigt"])
        .order("created_at", { ascending: false })

      setTickets((data as EinnahmenTicket[]) || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-[#3D8B7A] rounded-full animate-spin" />
        <span className="text-sm text-ink-muted">Aufträge werden geladen...</span>
      </div>
    </div>
  )

  const vor30Tagen = new Date(Date.now() - 30 * 86400_000)
  const vor7Tagen = new Date(Date.now() - 7 * 86400_000)

  const erledigt = tickets.filter(t => t.status === "erledigt")
  const laufend = tickets.filter(t => t.status === "in_bearbeitung" || t.status === "fertiggestellt_hw")
  const erledigtLetzte30d = erledigt.filter(t => new Date(t.created_at) >= vor30Tagen)
  const erledigtLetzte7d = erledigt.filter(t => new Date(t.created_at) >= vor7Tagen)

  const sumLetzte7d = erledigtLetzte7d.reduce((s, t) => s + (t.kosten_final ?? 0), 0)
  const sumLetzte30d = erledigtLetzte30d.reduce((s, t) => s + (t.kosten_final ?? 0), 0)
  const sumGesamt = erledigt.reduce((s, t) => s + (t.kosten_final ?? 0), 0)
  const avgProAuftrag = erledigt.length > 0 ? sumGesamt / erledigt.length : 0

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pt-16 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Meine Aufträge & Einnahmen</h1>
        <p className="text-sm text-ink-muted mt-1">Alle dir zugewiesenen Aufträge auf einen Blick</p>
      </div>

      {/* 100%-Provisions-Banner */}
      <div className="mb-6 p-4 rounded-2xl bg-accent/8 border border-accent/25 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-accent text-white flex items-center justify-center flex-shrink-0 font-bold text-sm">
          100%
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink">Du bekommst den vollen Auftragswert</div>
          <div className="text-xs text-ink-secondary mt-0.5">
            Reparo finanziert sich über eine Provision der Verwalter — bei dir wird nichts abgezogen.
          </div>
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-line p-4">
          <div className="text-xs text-ink-muted mb-1">Diese Woche</div>
          <div className="text-2xl font-bold text-accent">
            {sumLetzte7d > 0 ? sumLetzte7d.toLocaleString("de") + " €" : "0 €"}
          </div>
          <div className="text-xs text-ink-muted">Abgeschlossen</div>
        </div>
        <div className="bg-white rounded-xl border border-line p-4">
          <div className="text-xs text-ink-muted mb-1">Letzte 30 Tage</div>
          <div className="text-2xl font-bold text-ink">
            {sumLetzte30d > 0 ? sumLetzte30d.toLocaleString("de") + " €" : "0 €"}
          </div>
          <div className="text-xs text-ink-muted">{erledigtLetzte30d.length} Aufträge</div>
        </div>
        <div className="bg-white rounded-xl border border-line p-4">
          <div className="text-xs text-ink-muted mb-1">In Arbeit</div>
          <div className="text-2xl font-bold text-warm">{laufend.length}</div>
          <div className="text-xs text-ink-muted">
            {laufend.length === 0 ? "Keine laufenden" : laufend.length === 1 ? "Auftrag" : "Aufträge"}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-line p-4">
          <div className="text-xs text-ink-muted mb-1">Ø pro Auftrag</div>
          <div className="text-2xl font-bold text-ink">
            {avgProAuftrag > 0 ? Math.round(avgProAuftrag).toLocaleString("de") + " €" : "–"}
          </div>
          <div className="text-xs text-ink-muted">{erledigt.length} abgeschlossen</div>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-line p-12 text-center">
          <div className="text-3xl mb-3">🔧</div>
          <div className="text-sm font-medium text-ink mb-1">Noch keine Aufträge</div>
          <div className="text-xs text-ink-muted mb-4">
            Offene Direktanfragen findest du auf deinem Dashboard.
          </div>
          <Link
            href="/dashboard-handwerker"
            className="inline-block text-xs text-accent border border-accent/20 px-4 py-2 rounded-lg hover:bg-accent/5 transition-colors"
          >
            Zum Dashboard →
          </Link>
        </div>
      ) : (
        <>
          {/* Laufende Aufträge */}
          {laufend.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-ink mb-3">Laufende Aufträge ({laufend.length})</h2>
              <div className="flex flex-col gap-2">
                {laufend.map(t => (
                  <Link
                    key={t.id}
                    href={`/dashboard-handwerker/angebot/${t.id}`}
                    className="bg-white rounded-xl border border-accent/20 p-4 hover:border-accent/40 hover:shadow-sm transition-all block"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[t.status] ?? "bg-line text-ink-muted border-line"}`}>
                            {STATUS_LABELS[t.status] ?? t.status}
                          </span>
                          {t.gewerk && (
                            <span className="text-xs text-ink-muted">{formatGewerk(t.gewerk)}</span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-ink truncate">{t.titel}</div>
                        {t.objekte?.[0] && (
                          <div className="text-xs text-ink-muted mt-0.5">{t.objekte[0].name}</div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold text-accent">{formatEuro(t.kosten_final)}</div>
                        <div className="text-xs text-ink-muted">
                          {new Date(t.created_at).toLocaleDateString("de", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Erledigte Aufträge */}
          {erledigt.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-ink mb-3">
                Abgeschlossen ({erledigt.length})
                {sumGesamt > 0 && (
                  <span className="ml-2 text-xs font-normal text-ink-muted">
                    — gesamt {formatEuro(sumGesamt)}
                  </span>
                )}
              </h2>
              <div className="flex flex-col gap-2">
                {erledigt.map(t => (
                  <Link
                    key={t.id}
                    href={`/dashboard-handwerker/angebot/${t.id}`}
                    className="bg-white rounded-xl border border-line p-4 hover:border-accent/20 hover:shadow-sm transition-all block"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-line text-ink-muted border-line">
                            Erledigt
                          </span>
                          {t.gewerk && (
                            <span className="text-xs text-ink-muted">{formatGewerk(t.gewerk)}</span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-ink truncate">{t.titel}</div>
                        {t.objekte?.[0] && (
                          <div className="text-xs text-ink-muted mt-0.5">{t.objekte[0].name}</div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold text-ink">{formatEuro(t.kosten_final)}</div>
                        <div className="text-xs text-ink-muted">
                          {new Date(t.hw_abschluss_am ?? t.created_at).toLocaleDateString("de", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
