"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"

function kostenSchaetzung(t: Ticket): string {
  const titel = (t.titel || "").toLowerCase()
  if (titel.match(/heiz|warm/)) return "250–600"
  if (titel.match(/wasser|feucht|rohr/)) return "150–800"
  if (titel.match(/elektr|strom|sicher/)) return "100–400"
  if (titel.match(/tür|fenster|schloss/)) return "80–350"
  if (titel.match(/schimmel/)) return "200–900"
  return "100–500"
}

const PRIO_FARBEN: Record<string, { bar: string; pill: string }> = {
  dringend: { bar: "bg-[#C4574B]", pill: "text-[#C4574B] bg-[#C4574B]/10 border-[#C4574B]/15" },
  hoch:     { bar: "bg-[#C4956A]", pill: "text-[#854F0B] bg-[#FAF1DE] border-[#C4956A]/20" },
  normal:   { bar: "bg-[#5B6ABF]", pill: "text-[#5B6ABF] bg-[#EEF0FF] border-[#5B6ABF]/15" },
  niedrig:  { bar: "bg-[#8C857B]", pill: "text-[#6B665E] bg-[#EDE8E1] border-[#EDE8E1]" },
}

const PRIO_LABEL: Record<string, string> = {
  dringend: "Dringend", hoch: "Hoch", normal: "Normal", niedrig: "Niedrig",
}

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
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false })
      setTickets(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#3D8B7A]/30 border-t-[#3D8B7A] rounded-full animate-spin" />
        <span className="text-sm text-[#8C857B]">Lädt…</span>
      </div>
    </div>
  )

  const offene = tickets.filter(t => t.status === "offen")
  const marktplatz = tickets.filter(t => t.status === "marktplatz" || t.status === "auktion")
  const inArbeit = tickets.filter(t => t.status === "in_bearbeitung" || t.status === "in_arbeit" || t.status === "vergeben")
  const erledigt = tickets.filter(t => t.status === "erledigt")
  const monatsKosten = tickets
    .filter(t => t.kosten_final && new Date(t.created_at).getMonth() === new Date().getMonth())
    .reduce((s, t) => s + (t.kosten_final || 0), 0)

  const dringendeOffene = offene.filter(t => t.prioritaet === "dringend").length
  const hatAttention = offene.length > 0 || dringendeOffene > 0

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto pt-16 md:pt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#2D2A26]">Übersicht</h1>
          <p className="text-sm text-[#8C857B] mt-1.5">
            {tickets.length} {tickets.length === 1 ? "Vorgang" : "Vorgänge"}
            {hatAttention && ` · `}
            {hatAttention && (
              <span className="text-[#C4574B] font-medium">
                {offene.length} {offene.length === 1 ? "wartet" : "warten"} auf dich
              </span>
            )}
          </p>
        </div>
        <Link
          href="/dashboard-verwalter/marktplatz"
          className="inline-flex items-center gap-2 text-sm font-semibold bg-[#3D8B7A] text-white px-5 py-2.5 rounded-xl hover:bg-[#2D6B5A] transition-colors"
        >
          Handwerker-Marktplatz
          <span>→</span>
        </Link>
      </div>

      {/* Attention Banner — wenn dringende offene Meldungen */}
      {dringendeOffene > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-[#C4574B]/8 border-2 border-[#C4574B]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C4574B]/15 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">⚠️</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#C4574B]">
                {dringendeOffene} {dringendeOffene === 1 ? "dringende Meldung" : "dringende Meldungen"}
              </div>
              <div className="text-xs text-[#854240] mt-0.5">
                Sofortige Bearbeitung empfohlen — scrollen für Details
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <Kpi label="Eingegangen" value={offene.length} accent={offene.length > 0 ? "warn" : "muted"} sub={offene.length === 0 ? "alles bearbeitet" : "warten auf dich"} />
        <Kpi label="Auf Marktplatz" value={marktplatz.length} accent="primary" sub="warten auf Angebot" />
        <Kpi label="In Arbeit" value={inArbeit.length} accent="info" sub="bei Handwerker" />
        <Kpi label="Kosten Monat" value={`${monatsKosten.toLocaleString("de")} €`} accent="muted" sub="diesen Monat" />
      </div>

      {/* Eingehende Meldungen — wichtigster Block */}
      {offene.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-[#2D2A26]">Neue Meldungen von Mietern</h2>
            <span className="text-xs bg-[#C4574B]/10 text-[#C4574B] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
              Neu
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {offene.map(t => {
              const farben = PRIO_FARBEN[t.prioritaet] || PRIO_FARBEN.normal
              return (
                <article key={t.id} className="bg-white rounded-2xl border border-[#EDE8E1] p-5 hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className={`w-1 self-stretch rounded-full ${farben.bar} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <h3 className="text-base font-semibold text-[#2D2A26]">{t.titel}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border flex-shrink-0 ${farben.pill}`}>
                          {PRIO_LABEL[t.prioritaet] || t.prioritaet}
                        </span>
                      </div>

                      <div className="text-xs text-[#8C857B] mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {t.wohnung && <span>{t.wohnung}</span>}
                        {t.einsatzort_adresse && (
                          <span className="text-[#3D8B7A]">📍 {t.einsatzort_adresse}</span>
                        )}
                        <span>·</span>
                        <span>{new Date(t.created_at).toLocaleDateString("de", { day: "numeric", month: "short" })}</span>
                      </div>

                      {t.beschreibung && (
                        <p className="text-sm text-[#6B665E] line-clamp-2 mb-3">{t.beschreibung}</p>
                      )}

                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-xs text-[#8C857B]">
                          KI-Schätzung: <span className="text-[#2D2A26] font-medium">{kostenSchaetzung(t)} €</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/ticket/${t.id}`)}
                            className="text-xs text-[#6B665E] hover:text-[#2D2A26] px-3 py-1.5 transition-colors"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => router.push("/dashboard-verwalter/marktplatz")}
                            className="text-xs font-semibold bg-[#3D8B7A] text-white px-3.5 py-1.5 rounded-lg hover:bg-[#2D6B5A] transition-colors"
                          >
                            Handwerker buchen
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* Auf Marktplatz */}
      {marktplatz.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wide mb-4">
            Auf dem Marktplatz <span className="text-[#8C857B] font-normal">({marktplatz.length})</span>
          </h2>
          <div className="flex flex-col gap-2">
            {marktplatz.map(t => (
              <button
                key={t.id}
                onClick={() => router.push(`/ticket/${t.id}`)}
                className="text-left bg-white rounded-xl border border-[#EDE8E1] p-4 hover:border-[#3D8B7A]/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#3D8B7A] animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#2D2A26] truncate">{t.titel}</div>
                    <div className="text-xs text-[#8C857B] truncate">
                      {t.wohnung && `${t.wohnung} · `}
                      {t.einsatzort_adresse}
                    </div>
                  </div>
                  <span className="text-xs text-[#3D8B7A] font-medium flex-shrink-0">
                    Wartet auf Angebot
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* In Arbeit */}
      {inArbeit.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wide mb-4">
            In Arbeit <span className="text-[#8C857B] font-normal">({inArbeit.length})</span>
          </h2>
          <div className="flex flex-col gap-2">
            {inArbeit.map(t => (
              <button
                key={t.id}
                onClick={() => router.push(`/ticket/${t.id}`)}
                className="text-left bg-white rounded-xl border border-[#EDE8E1] p-4 hover:border-[#3D8B7A]/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#5B6ABF] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#2D2A26] truncate">{t.titel}</div>
                    <div className="text-xs text-[#8C857B] truncate">
                      {t.wohnung && `${t.wohnung} · `}
                      {t.einsatzort_adresse}
                    </div>
                  </div>
                  <span className="text-xs text-[#5B6ABF] font-medium flex-shrink-0">In Arbeit</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {tickets.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#EDE8E1] p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#3D8B7A]/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📥</span>
          </div>
          <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Noch keine Vorgänge</h2>
          <p className="text-sm text-[#8C857B] mb-6 max-w-sm mx-auto">
            Sobald deine Mieter Schäden melden oder du Aufträge auf dem Marktplatz vergibst, erscheinen sie hier.
          </p>
          <Link
            href="/dashboard-verwalter/marktplatz"
            className="inline-block text-sm font-semibold bg-[#3D8B7A] text-white px-5 py-2.5 rounded-xl hover:bg-[#2D6B5A] transition-colors"
          >
            Marktplatz öffnen
          </Link>
        </div>
      )}

      {/* Erledigte Footer */}
      {erledigt.length > 0 && (
        <div className="text-center mt-6">
          <Link
            href="/dashboard-verwalter/tickets"
            className="text-xs text-[#B5AEA4] hover:text-[#3D8B7A] transition-colors"
          >
            {erledigt.length} {erledigt.length === 1 ? "erledigter Vorgang" : "erledigte Vorgänge"} im Archiv →
          </Link>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, accent }: {
  label: string
  value: string | number
  sub?: string
  accent?: "primary" | "warn" | "info" | "muted"
}) {
  const farben = {
    primary: "text-[#3D8B7A]",
    warn: "text-[#C4574B]",
    info: "text-[#5B6ABF]",
    muted: "text-[#2D2A26]",
  }
  return (
    <div className="bg-white rounded-2xl border border-[#EDE8E1] p-4">
      <div className="text-[10px] uppercase tracking-wider text-[#8C857B] font-medium mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${farben[accent || "muted"]}`}>{value}</div>
      {sub && <div className="text-xs text-[#B5AEA4] mt-1">{sub}</div>}
    </div>
  )
}
