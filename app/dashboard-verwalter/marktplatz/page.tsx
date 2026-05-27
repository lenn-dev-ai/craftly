"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/components/Toast"
import { Inbox, Users, Search, Filter as FilterIcon, RefreshCw, Clock, MapPin, AlertCircle } from "lucide-react"
import { formatGewerk } from "@/types"

// Sprint AK Stufe 2 (27.05.2026) — Verwalter-Marktplatz, NEU.
//
// Das alte Slot-Marktplatz-Konzept ist tot (Stufe 1, siehe Konzept-Memo
// SPRINT-AK-VERWALTER-MARKTPLATZ-KONZEPT.md). Diese Page ist jetzt eine
// Zwei-Tab-Oberfläche für die zwei echten Verwalter-Use-Cases:
//
//   Tab 1 "Offene Tickets" — welche meiner Tickets warten noch auf HW-Zuweisung?
//   Tab 2 "Meine Handwerker" — Stamm-HW-Liste mit Live-Verfügbarkeits-Badge
//                              aus Google-Cal.
//
// Backup der alten Page liegt unter /app/dashboard-verwalter/marktplatz-archiv/
// für Notfall-Rollback, kann nach 1-2 Wochen weg.

type Tab = "tickets" | "handwerker"

interface OffenesTicket {
  id: string
  titel: string
  gewerk: string | null
  ticket_typ: string | null
  prioritaet: string | null
  einsatzort_adresse: string | null
  created_at: string
  status: string
  erstellt_von: string | null
  einladungen?: { count: number }[]
  angebote?: { count: number }[]
}

interface StammHwEintrag {
  id: string
  handwerker_id: string
  gewerk: string | null
  prio: number | null
  handwerker: {
    id: string
    name: string | null
    firma: string | null
    gewerk: string | null
    bewertung_avg: number | null
    auftraege_anzahl: number | null
    plz_bereich: string | null
  } | null
}

type HwStatus = "frei" | "belegt" | "nicht_verbunden" | "fehler" | "laedt"

function relativAlter(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 60) return `vor ${m} Min`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h} Std`
  const d = Math.floor(h / 24)
  if (d < 7) return `vor ${d} ${d === 1 ? "Tag" : "Tagen"}`
  return new Date(isoDate).toLocaleDateString("de", { day: "2-digit", month: "short" })
}

export default function MarktplatzPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { confirm } = useToast()
  const initialTab = (searchParams.get("tab") as Tab) === "handwerker" ? "handwerker" : "tickets"
  const [tab, setTab] = useState<Tab>(initialTab)

  const [tickets, setTickets] = useState<OffenesTicket[]>([])
  const [hws, setHws] = useState<StammHwEintrag[]>([])
  const [hwStatus, setHwStatus] = useState<Record<string, HwStatus>>({})
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [toast, setToast] = useState("")
  const [filterGewerk, setFilterGewerk] = useState<string>("alle")
  const [filterStatus, setFilterStatus] = useState<"alle" | "frei" | "verbunden">("alle")
  const [suche, setSuche] = useState("")
  const [einladenDrawer, setEinladenDrawer] = useState<OffenesTicket | null>(null)
  const [einlade, setEinlade] = useState<string | null>(null)

  // Tab-Sync in URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString())
    if (tab === "handwerker") next.set("tab", "handwerker")
    else next.delete("tab")
    const qs = next.toString()
    router.replace(`/dashboard-verwalter/marktplatz${qs ? `?${qs}` : ""}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const [{ data: t }, { data: h }] = await Promise.all([
      supabase
        .from("tickets")
        .select("id, titel, gewerk, ticket_typ, prioritaet, einsatzort_adresse, created_at, status, erstellt_von, einladungen(count), angebote(count)")
        .eq("verwalter_id", user.id)
        .is("zugewiesener_hw", null)
        .not("status", "in", "(geschlossen,storniert,erledigt)")
        .order("created_at", { ascending: true }),
      supabase
        .from("stamm_handwerker")
        .select("id, handwerker_id, gewerk, prio, handwerker:profiles!handwerker_id(id, name, firma, gewerk, bewertung_avg, auftraege_anzahl, plz_bereich)")
        .eq("verwalter_id", user.id)
        .order("prio", { ascending: false }),
    ])
    setTickets((t ?? []) as OffenesTicket[])
    setHws((h ?? []) as unknown as StammHwEintrag[])
    setLoading(false)
  }, [router])

  useEffect(() => { void loadData() }, [loadData])

  // Verfügbarkeits-Status für die HW-Liste laden (nur wenn Tab "handwerker" aktiv,
  // damit wir keine Google-API-Calls vergeuden wenn der Verwalter eh Tickets schaut).
  const loadVerfuegbarkeit = useCallback(async () => {
    if (hws.length === 0) return
    setLoadingStatus(true)
    // Initial alle auf "laedt"
    const initial: Record<string, HwStatus> = {}
    for (const h of hws) initial[h.handwerker_id] = "laedt"
    setHwStatus(initial)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { setLoadingStatus(false); return }
    try {
      const res = await fetch("/api/verwalter/hw-verfuegbarkeit", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ handwerker_ids: hws.map(h => h.handwerker_id) }),
      })
      if (res.ok) {
        const json = await res.json() as { status?: Record<string, HwStatus> }
        setHwStatus(json.status ?? {})
      } else {
        setHwStatus({})
      }
    } catch (e) {
      console.warn("[marktplatz] verfuegbarkeit-fetch fehlgeschlagen", e)
      setHwStatus({})
    } finally {
      setLoadingStatus(false)
    }
  }, [hws])

  useEffect(() => {
    if (tab === "handwerker" && hws.length > 0 && Object.keys(hwStatus).length === 0) {
      void loadVerfuegbarkeit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hws.length])

  async function einladen(ticket: OffenesTicket, hwId: string, hwName: string) {
    if (!await confirm(`„${ticket.titel}" an ${hwName} einladen?`)) return
    setEinlade(hwId)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setEinlade(null); return }
    const { error } = await supabase.from("einladungen").insert({
      ticket_id: ticket.id,
      handwerker_id: hwId,
      verwalter_id: user.id,
      status: "offen",
    })
    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("23505")) {
        setToast("HW ist bereits eingeladen.")
      } else {
        setToast("Fehler: " + error.message)
      }
    } else {
      setToast(`${hwName} wurde eingeladen.`)
      setEinladenDrawer(null)
      await loadData()
    }
    setEinlade(null)
    setTimeout(() => setToast(""), 3000)
  }

  const gewerkOptions = useMemo(() => {
    const set = new Set<string>()
    for (const h of hws) {
      if (h.gewerk) set.add(h.gewerk)
      else if (h.handwerker?.gewerk) set.add(h.handwerker.gewerk)
    }
    return Array.from(set).sort()
  }, [hws])

  const gefilterte = useMemo(() => {
    return hws.filter(h => {
      const gewerk = h.gewerk ?? h.handwerker?.gewerk ?? ""
      if (filterGewerk !== "alle" && gewerk !== filterGewerk) return false
      if (filterStatus === "frei" && hwStatus[h.handwerker_id] !== "frei") return false
      if (filterStatus === "verbunden") {
        const s = hwStatus[h.handwerker_id]
        if (s === "nicht_verbunden" || s === "fehler" || !s) return false
      }
      if (suche) {
        const hay = `${h.handwerker?.name ?? ""} ${h.handwerker?.firma ?? ""} ${gewerk}`.toLowerCase()
        if (!hay.includes(suche.toLowerCase())) return false
      }
      return true
    })
  }, [hws, hwStatus, filterGewerk, filterStatus, suche])

  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-white border-b border-line">
        <div className="max-w-6xl mx-auto pl-14 pr-4 md:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-ink">Marktplatz</h1>
            <p className="text-xs text-ink-muted">Offene Tickets &amp; verfügbare Handwerker</p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="text-xs px-3 py-2 rounded-lg border border-line hover:bg-surface-muted text-ink-secondary inline-flex items-center gap-1.5"
            aria-label="Liste neu laden"
          >
            <RefreshCw size={13} /> Aktualisieren
          </button>
        </div>
        <div className="max-w-6xl mx-auto pl-14 pr-4 md:px-6 flex gap-1 -mb-px">
          <TabButton
            active={tab === "tickets"}
            label="Offene Tickets"
            count={tickets.length}
            icon={<Inbox size={14} />}
            onClick={() => setTab("tickets")}
          />
          <TabButton
            active={tab === "handwerker"}
            label="Meine Handwerker"
            count={hws.length}
            icon={<Users size={14} />}
            onClick={() => setTab("handwerker")}
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-5">
        {loading ? (
          <div className="text-center text-sm text-ink-muted py-16">Lädt …</div>
        ) : tab === "tickets" ? (
          tickets.length === 0 ? (
            <EmptyState
              title="Keine offenen Tickets"
              text="Alle deine Tickets haben einen zugewiesenen HW oder sind erledigt."
              ctaLabel="Neues Ticket anlegen"
              ctaHref="/dashboard-verwalter/neues-ticket"
            />
          ) : (
            <ul className="space-y-2">
              {tickets.map(t => (
                <li
                  key={t.id}
                  className="bg-white border border-line rounded-2xl px-4 py-3 flex items-start gap-3 hover:border-accent/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-ink truncate">{t.titel}</span>
                      {t.prioritaet === "notfall" && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-red-100 text-red-800 border border-red-200 px-1.5 py-px rounded">Notfall</span>
                      )}
                      {t.status === "auktion" && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-warm-light text-warm-dark border border-warm/30 px-1.5 py-px rounded">Auktion</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-ink-muted flex-wrap">
                      {t.gewerk && <span>{formatGewerk(t.gewerk)}</span>}
                      {t.einsatzort_adresse && (
                        <span className="inline-flex items-center gap-1 truncate max-w-[260px]">
                          <MapPin size={11} className="flex-shrink-0" />
                          {t.einsatzort_adresse}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} /> {relativAlter(t.created_at)}
                      </span>
                      {(t.einladungen?.[0]?.count ?? 0) > 0 && (
                        <span className="text-ink-faint">· {t.einladungen![0].count} HW eingeladen</span>
                      )}
                      {(t.angebote?.[0]?.count ?? 0) > 0 && (
                        <span className="text-accent">· {t.angebote![0].count} Angebot{t.angebote![0].count === 1 ? "" : "e"}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard-verwalter/tickets/${t.id}`)}
                      className="text-xs px-3 py-2 rounded-lg border border-line hover:bg-surface-muted text-ink-secondary"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setEinladenDrawer(t)}
                      className="text-xs font-semibold px-3 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover"
                    >
                      HW einladen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          // Tab: Handwerker
          <>
            <div className="bg-white border border-line rounded-2xl p-3 mb-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="search"
                  value={suche}
                  onChange={e => setSuche(e.target.value)}
                  placeholder="Name, Firma, Gewerk suchen …"
                  className="w-full text-sm bg-surface border border-line rounded-lg pl-8 pr-3 py-2 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20"
                />
              </div>
              <select
                value={filterGewerk}
                onChange={e => setFilterGewerk(e.target.value)}
                className="text-xs bg-surface border border-line rounded-lg px-3 py-2 text-ink-secondary"
                aria-label="Nach Gewerk filtern"
              >
                <option value="alle">Alle Gewerke</option>
                {gewerkOptions.map(g => <option key={g} value={g}>{formatGewerk(g)}</option>)}
              </select>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
                className="text-xs bg-surface border border-line rounded-lg px-3 py-2 text-ink-secondary"
                aria-label="Nach Verfügbarkeit filtern"
              >
                <option value="alle">Alle Verfügbarkeiten</option>
                <option value="frei">Nur frei jetzt</option>
                <option value="verbunden">Nur Google-verbundene</option>
              </select>
              <button
                type="button"
                onClick={() => void loadVerfuegbarkeit()}
                disabled={loadingStatus}
                className="text-xs px-3 py-2 rounded-lg border border-line hover:bg-surface-muted text-ink-secondary inline-flex items-center gap-1.5 disabled:opacity-50"
                aria-label="Verfügbarkeit neu laden"
              >
                <RefreshCw size={13} className={loadingStatus ? "animate-spin" : ""} /> Status
              </button>
            </div>

            {hws.length === 0 ? (
              <EmptyState
                title="Noch keine Stamm-Handwerker"
                text="Lege deine bevorzugten HW unter „Stamm-Handwerker“ an — dann erscheinen sie hier mit Live-Verfügbarkeit."
                ctaLabel="Stamm-Handwerker verwalten"
                ctaHref="/dashboard-verwalter/stamm-handwerker"
              />
            ) : gefilterte.length === 0 ? (
              <div className="text-center text-sm text-ink-muted py-12 bg-white border border-line rounded-2xl">
                Keine Treffer für die aktuellen Filter.
              </div>
            ) : (
              <ul className="space-y-2">
                {gefilterte.map(h => {
                  const name = h.handwerker?.firma || h.handwerker?.name || "Ohne Namen"
                  const gewerk = h.gewerk || h.handwerker?.gewerk || ""
                  const status = hwStatus[h.handwerker_id]
                  return (
                    <li
                      key={h.id}
                      className="bg-white border border-line rounded-2xl px-4 py-3 flex items-center gap-3"
                    >
                      <HwStatusBadge status={status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink truncate">{name}</div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-ink-muted flex-wrap">
                          {gewerk && <span>{formatGewerk(gewerk)}</span>}
                          {h.handwerker?.plz_bereich && <span>· {h.handwerker.plz_bereich}</span>}
                          {h.handwerker?.bewertung_avg != null && (
                            <span className="text-warm">★ {h.handwerker.bewertung_avg.toFixed(1)}</span>
                          )}
                          {(h.handwerker?.auftraege_anzahl ?? 0) > 0 && (
                            <span>· {h.handwerker?.auftraege_anzahl} Aufträge</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard-verwalter/handwerker?id=${h.handwerker_id}`)}
                          className="text-xs px-3 py-2 rounded-lg border border-line hover:bg-surface-muted text-ink-secondary"
                        >
                          Profil
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <p className="text-[11px] text-ink-faint mt-3 inline-flex items-center gap-1.5">
              <FilterIcon size={11} />
              Verfügbarkeits-Status kommt live aus dem Google-Kalender (4-Stunden-Fenster).
              HW ohne Google-Verbindung erscheinen als &bdquo;unbekannt&ldquo;.
            </p>
          </>
        )}
      </div>

      {/* Einladen-Drawer — wenn Ticket-Card-Action "HW einladen" geklickt wurde */}
      {einladenDrawer && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-end md:items-center justify-center p-4"
          onClick={() => setEinladenDrawer(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-line">
              <h2 className="text-base font-semibold text-ink">HW zu &bdquo;{einladenDrawer.titel}&ldquo; einladen</h2>
              <p className="text-xs text-ink-muted mt-1">
                Aus deinen Stamm-Handwerkern. Status zeigt Verfügbarkeit der nächsten 4 Stunden.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {hws.length === 0 ? (
                <div className="text-sm text-ink-muted text-center py-8">
                  Keine Stamm-HW angelegt.{" "}
                  <a href="/dashboard-verwalter/stamm-handwerker" className="text-accent hover:underline">
                    Jetzt anlegen
                  </a>
                </div>
              ) : (
                hws.map(h => {
                  const name = h.handwerker?.firma || h.handwerker?.name || "Ohne Namen"
                  const gewerk = h.gewerk || h.handwerker?.gewerk || ""
                  const passt = !einladenDrawer.gewerk || !gewerk || einladenDrawer.gewerk === gewerk
                  return (
                    <button
                      key={h.id}
                      type="button"
                      disabled={einlade === h.handwerker_id}
                      onClick={() => void einladen(einladenDrawer, h.handwerker_id, name)}
                      className={`w-full text-left px-3 py-2 rounded-lg border flex items-center gap-3 transition-colors ${
                        passt
                          ? "border-line hover:border-accent/40 hover:bg-accent/5"
                          : "border-line hover:bg-surface-muted opacity-70"
                      } disabled:opacity-50`}
                    >
                      <HwStatusBadge status={hwStatus[h.handwerker_id]} compact />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ink truncate">{name}</div>
                        <div className="text-xs text-ink-muted">
                          {gewerk && formatGewerk(gewerk)}
                          {!passt && gewerk && einladenDrawer.gewerk && (
                            <span className="ml-2 text-amber-700">
                              (anderes Gewerk als Ticket)
                            </span>
                          )}
                        </div>
                      </div>
                      {einlade === h.handwerker_id && <span className="text-[11px] text-ink-muted">…</span>}
                    </button>
                  )
                })
              )}
            </div>
            <div className="px-5 py-3 border-t border-line text-right">
              <button
                type="button"
                onClick={() => setEinladenDrawer(null)}
                className="text-xs px-3 py-2 rounded-lg text-ink-secondary hover:bg-surface-muted"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-xs px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function TabButton({ active, label, count, icon, onClick }: {
  active: boolean; label: string; count: number; icon: React.ReactNode; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 border-b-2 transition-colors -mb-px ${
        active
          ? "border-accent text-accent"
          : "border-transparent text-ink-muted hover:text-ink-secondary"
      }`}
    >
      {icon}
      {label}
      <span className={`text-[10px] tabular-nums rounded-full px-1.5 py-0.5 ${
        active ? "bg-accent/15 text-accent" : "bg-surface-muted text-ink-muted"
      }`}>{count}</span>
    </button>
  )
}

function HwStatusBadge({ status, compact = false }: { status: HwStatus | undefined; compact?: boolean }) {
  const meta: Record<HwStatus, { color: string; label: string; help: string }> = {
    frei:             { color: "bg-emerald-500",   label: "Frei",        help: "Keine Google-Termine in den nächsten 4h" },
    belegt:           { color: "bg-rose-400",      label: "Belegt",      help: "Hat Google-Termine in den nächsten 4h" },
    nicht_verbunden:  { color: "bg-ink-faint/40",  label: "Unbekannt",   help: "HW hat keinen Google-Kalender verbunden" },
    fehler:           { color: "bg-amber-400",     label: "Fehler",      help: "Google-API hat geantwortet mit Fehler" },
    laedt:            { color: "bg-ink-faint/40 animate-pulse", label: "…", help: "Lädt Status" },
  }
  const s = status ?? "nicht_verbunden"
  const m = meta[s]
  if (compact) {
    return (
      <span className={`w-2.5 h-2.5 rounded-full ${m.color} flex-shrink-0`} title={m.help} aria-label={m.label} />
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted flex-shrink-0 w-20"
      title={m.help}
    >
      <span className={`w-2 h-2 rounded-full ${m.color} flex-shrink-0`} aria-hidden="true" />
      {m.label}
    </span>
  )
}

function EmptyState({ title, text, ctaLabel, ctaHref }: {
  title: string; text: string; ctaLabel: string; ctaHref: string
}) {
  return (
    <div className="bg-white border border-line rounded-2xl px-6 py-10 text-center">
      <AlertCircle size={28} className="mx-auto text-ink-faint mb-3" />
      <div className="text-base font-semibold text-ink mb-1">{title}</div>
      <p className="text-sm text-ink-muted mb-4 max-w-sm mx-auto">{text}</p>
      <a
        href={ctaHref}
        className="inline-block text-xs font-semibold bg-accent text-white px-4 py-2 rounded-xl hover:bg-accent-hover transition-colors"
      >
        {ctaLabel}
      </a>
    </div>
  )
}
