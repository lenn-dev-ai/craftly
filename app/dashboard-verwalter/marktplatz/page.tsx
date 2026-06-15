"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/components/Toast"
import { Inbox, Users, Search, Filter as FilterIcon, RefreshCw, Clock, MapPin, AlertCircle, Star, Zap } from "lucide-react"
import { formatGewerk } from "@/types"
import { useFocusTrap } from "@/lib/use-focus-trap"

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
// Backup der alten Page (marktplatz-archiv) wurde nach Audit 2.0 (#245)
// entfernt — Rollback-Frist abgelaufen, Stufe-2-Konzept ist etabliert.

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

// Sprint AK Phase 4 (27.05.): Pool-HW aus Radius-Suche, neben Stamm-HW.
// Lennart-Feedback 444f646e: Verwalter darf nicht erst alle HW als Stamm
// anlegen müssen — Auctions-Logik soll alle passenden HW im Radius sehen.
interface PoolHw {
  id: string
  name: string | null
  firma: string | null
  gewerk: string | null
  plz_bereich: string | null
  bewertung_avg: number | null
  auftraege_anzahl: number | null
  entfernung_km: number
  ist_stamm: boolean
}

type HwStatus = "frei" | "belegt" | "nicht_verbunden" | "fehler" | "laedt"

type Dringlichkeit = "notfall" | "zeitnah" | "planbar"

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
  const [poolHws, setPoolHws] = useState<PoolHw[]>([])
  const [poolLoading, setPoolLoading] = useState(false)
  const [poolError, setPoolError] = useState<string | null>(null)
  const [hwStatus, setHwStatus] = useState<Record<string, HwStatus>>({})
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [toast, setToast] = useState("")
  const [filterGewerk, setFilterGewerk] = useState<string>("alle")
  const [filterStatus, setFilterStatus] = useState<"alle" | "frei" | "verbunden">("alle")
  const [suche, setSuche] = useState("")
  const [einladenDrawer, setEinladenDrawer] = useState<OffenesTicket | null>(null)
  const [einlade, setEinlade] = useState<string | null>(null)
  const [stammHinzu, setStammHinzu] = useState<string | null>(null)
  const [auctionStarten, setAuctionStarten] = useState<OffenesTicket | null>(null)
  const [auctionLaeuft, setAuctionLaeuft] = useState(false)

  // A11Y-Cleanup (Audit #82): Focus-Trap für die beiden Modals dieser Seite
  // (Einladen-Drawer + Auction-Start-Modal).
  const einladenDialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(einladenDialogRef, !!einladenDrawer)
  const auctionDialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(auctionDialogRef, !!auctionStarten)

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

  // Sprint AK Phase 4 (27.05.): Pool-HW aus Radius — non-blocking, lädt
  // wenn Tab "handwerker" aktiv wird. Filter-Gewerk wird respektiert.
  const loadPool = useCallback(async () => {
    setPoolLoading(true)
    setPoolError(null)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { setPoolLoading(false); return }
    try {
      const res = await fetch("/api/verwalter/hw-im-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          gewerk: filterGewerk !== "alle" ? filterGewerk : undefined,
          max_distance_km: 50,
        }),
      })
      if (res.ok) {
        const json = await res.json() as { handwerker?: PoolHw[] }
        setPoolHws(json.handwerker ?? [])
      } else {
        const j = await res.json().catch(() => ({}))
        setPoolError(j.error ?? `HTTP ${res.status}`)
        setPoolHws([])
      }
    } catch (e) {
      setPoolError(e instanceof Error ? e.message : "fetch_error")
      setPoolHws([])
    } finally {
      setPoolLoading(false)
    }
  }, [filterGewerk])

  useEffect(() => { void loadData() }, [loadData])

  // Verfügbarkeits-Status für die HW-Liste laden (nur wenn Tab "handwerker" aktiv,
  // damit wir keine Google-API-Calls vergeuden wenn der Verwalter eh Tickets schaut).
  const loadVerfuegbarkeit = useCallback(async () => {
    // Sprint AK Phase 4: Stamm-IDs UND Pool-IDs prüfen, max 20 (Endpoint-Cap)
    const stammIds = hws.map(h => h.handwerker_id)
    const poolIds = poolHws.filter(p => !p.ist_stamm).map(p => p.id)
    const alleIds = Array.from(new Set([...stammIds, ...poolIds])).slice(0, 20)
    if (alleIds.length === 0) return
    setLoadingStatus(true)
    const initial: Record<string, HwStatus> = {}
    for (const id of alleIds) initial[id] = "laedt"
    setHwStatus(initial)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { setLoadingStatus(false); return }
    try {
      const res = await fetch("/api/verwalter/hw-verfuegbarkeit", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ handwerker_ids: alleIds }),
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
  }, [hws, poolHws])

  useEffect(() => {
    if (tab === "handwerker" && hws.length > 0 && Object.keys(hwStatus).length === 0) {
      void loadVerfuegbarkeit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hws.length])

  // Sprint AK Phase 4: Pool laden wenn Tab "handwerker" aktiv ist + bei Gewerk-Filter-Wechsel
  useEffect(() => {
    if (tab !== "handwerker") return
    void loadPool()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filterGewerk])

  // Sprint AK Phase 4: Pool-HW zu Stamm hinzufügen — One-Click ohne
  // Objekt-Bindung (gewerk/prio/frist bleiben null, Verwalter kann später
  // im Stamm-HW-Manager verfeinern).
  async function zuStammHinzufuegen(hw: PoolHw) {
    if (!await confirm(`${hw.firma || hw.name || "Handwerker"} als Stamm-Handwerker anlegen?`)) return
    setStammHinzu(hw.id)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStammHinzu(null); return }
    const { error } = await supabase.from("stamm_handwerker").insert({
      verwalter_id: user.id,
      handwerker_id: hw.id,
      gewerk: hw.gewerk,
      prio: 50,
    })
    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("23505")) {
        setToast("HW ist bereits in deinem Stamm.")
      } else {
        setToast("Fehler: " + error.message)
      }
    } else {
      setToast(`${hw.firma || hw.name} als Stamm-HW angelegt.`)
      // Pool + Stamm neu laden, damit das ist_stamm-Flag + Stamm-Liste aktuell sind
      await Promise.all([loadData(), loadPool()])
    }
    setStammHinzu(null)
    setTimeout(() => setToast(""), 3000)
  }

  // Sprint AK Phase 4: Auction für ein Ticket starten — ruft existing
  // /api/auction/start. Verwalter wählt Dringlichkeit, System macht Rest.
  async function starteAuction(ticket: OffenesTicket, dringlichkeit: Dringlichkeit) {
    setAuctionLaeuft(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { setAuctionLaeuft(false); return }
    try {
      const res = await fetch("/api/auction/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ticket_id: ticket.id, dringlichkeit }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setToast(dringlichkeit === "notfall" ? "Notfall-Match gestartet — Top-HW informiert." : "Auction läuft — HWs erhalten Einladungen.")
        setAuctionStarten(null)
        await loadData()
      } else {
        setToast("Fehler: " + (json.error ?? `HTTP ${res.status}`))
      }
    } catch (e) {
      setToast("Netzwerk-Fehler: " + (e instanceof Error ? e.message : "fetch_error"))
    } finally {
      setAuctionLaeuft(false)
      setTimeout(() => setToast(""), 4000)
    }
  }

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

  // Sprint AK Phase 4: Pool nochmal client-filtern. Pool-Endpoint hat den
  // Gewerk-Filter bereits angewandt, aber Suche + Verfügbarkeits-Filter
  // bleiben client-seitig. Stamm-HW werden in der Pool-Sektion versteckt
  // (sie erscheinen schon in der Stamm-Sektion oben).
  const gefilterterPool = useMemo(() => {
    return poolHws.filter(h => {
      if (h.ist_stamm) return false
      if (filterStatus === "frei" && hwStatus[h.id] !== "frei") return false
      if (filterStatus === "verbunden") {
        const s = hwStatus[h.id]
        if (s === "nicht_verbunden" || s === "fehler" || !s) return false
      }
      if (suche) {
        const hay = `${h.name ?? ""} ${h.firma ?? ""} ${h.gewerk ?? ""}`.toLowerCase()
        if (!hay.includes(suche.toLowerCase())) return false
      }
      return true
    })
  }, [poolHws, hwStatus, filterStatus, suche])

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
                        <span className="text-ink-muted">· {t.einladungen![0].count} HW eingeladen</span>
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
                      className="text-xs px-3 py-2 rounded-lg border border-line hover:bg-surface-muted text-ink-secondary"
                      title="Einzelnen HW aus deinem Stamm einladen"
                    >
                      HW einladen
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuctionStarten(t)}
                      className="text-xs font-semibold px-3 py-2 rounded-lg bg-accent text-white hover:bg-accent-hover"
                      title="Auction starten — System findet passende HW im Radius und sendet Einladungen automatisch"
                    >
                      Auction
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

            {/* Sprint AK Phase 4: Sektion 1 — Stamm-HW (sortiert nach prio) */}
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink-secondary uppercase tracking-wide">
              <Star size={13} className="text-warm" />
              Stamm-Handwerker
              <span className="text-ink-muted normal-case font-normal">({gefilterte.length})</span>
            </div>
            {hws.length === 0 ? (
              <div className="bg-surface-alt border border-line rounded-2xl px-4 py-4 text-center mb-4">
                <p className="text-sm text-ink-muted">
                  Keine bevorzugten HW gepflegt. Du kannst HW unten aus dem Pool zu Stamm machen oder
                  {" "}<a href="/dashboard-verwalter/stamm-handwerker" className="text-accent hover:underline">über Stamm-HW verwalten</a> anlegen.
                </p>
              </div>
            ) : gefilterte.length === 0 ? (
              <div className="text-center text-xs text-ink-muted py-6 bg-white border border-line rounded-2xl mb-4">
                Keine Treffer in deinem Stamm für die aktuellen Filter.
              </div>
            ) : (
              <ul className="space-y-2 mb-6">
                {gefilterte.map(h => {
                  const name = h.handwerker?.firma || h.handwerker?.name || "Ohne Namen"
                  const gewerk = h.gewerk || h.handwerker?.gewerk || ""
                  const status = hwStatus[h.handwerker_id]
                  return (
                    <li key={h.id} className="bg-white border border-line rounded-2xl px-4 py-3 flex items-center gap-3">
                      <HwStatusBadge status={status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink truncate flex items-center gap-1.5">
                          <Star size={12} className="text-warm flex-shrink-0" /> {name}
                        </div>
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

            {/* Sprint AK Phase 4: Sektion 2 — Pool im Radius (alle HW im Umkreis + Gewerk-Match) */}
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink-secondary uppercase tracking-wide">
              <Search size={13} className="text-accent" />
              Auch verfügbar in deinem Radius
              <span className="text-ink-muted normal-case font-normal">({gefilterterPool.length})</span>
              {poolLoading && <span className="text-ink-muted normal-case font-normal">· lädt …</span>}
            </div>
            {poolError ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl px-4 py-3">
                Pool-Suche fehlgeschlagen: {poolError}
                {poolError.includes("Standort") && (
                  <> · <a href="/dashboard-verwalter" className="underline">Verwalter-Profil prüfen</a></>
                )}
              </div>
            ) : gefilterterPool.length === 0 && !poolLoading ? (
              <div className="text-center text-xs text-ink-muted py-6 bg-white border border-line rounded-2xl">
                Keine weiteren HW im 50 km-Radius (nach aktuellen Filtern).
              </div>
            ) : (
              <ul className="space-y-2">
                {gefilterterPool.map(p => {
                  const name = p.firma || p.name || "Ohne Namen"
                  const status = hwStatus[p.id]
                  return (
                    <li key={p.id} className="bg-white border border-line rounded-2xl px-4 py-3 flex items-center gap-3">
                      <HwStatusBadge status={status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink truncate">{name}</div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-ink-muted flex-wrap">
                          {p.gewerk && <span>{formatGewerk(p.gewerk)}</span>}
                          {p.plz_bereich && <span>· {p.plz_bereich}</span>}
                          <span className="text-accent">· {p.entfernung_km} km entfernt</span>
                          {p.bewertung_avg != null && (
                            <span className="text-warm">★ {p.bewertung_avg.toFixed(1)}</span>
                          )}
                          {(p.auftraege_anzahl ?? 0) > 0 && (
                            <span>· {p.auftraege_anzahl} Aufträge</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => void zuStammHinzufuegen(p)}
                          disabled={stammHinzu === p.id}
                          className="text-xs px-3 py-2 rounded-lg border border-line hover:bg-warm/10 hover:border-warm/40 text-ink-secondary inline-flex items-center gap-1 disabled:opacity-50"
                          title="Zu Stamm-Handwerkern hinzufügen"
                        >
                          <Star size={12} /> {stammHinzu === p.id ? "…" : "Stamm"}
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard-verwalter/handwerker?id=${p.id}`)}
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

            <p className="text-[11px] text-ink-muted mt-3 inline-flex items-center gap-1.5">
              <FilterIcon size={11} />
              Verfügbarkeits-Status kommt live aus dem Google-Kalender (4-Stunden-Fenster).
              HW ohne Google-Verbindung erscheinen als &bdquo;unbekannt&ldquo;.
              Pool-Radius: 50 km um deinen Startort.
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
            ref={einladenDialogRef}
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

      {/* Sprint AK Phase 4: Auction-Start-Modal — Dringlichkeit wählen, System macht Rest */}
      {auctionStarten && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-end md:items-center justify-center p-4"
          onClick={() => !auctionLaeuft && setAuctionStarten(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            ref={auctionDialogRef}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-line flex items-center gap-2">
              <Zap size={18} className="text-accent" />
              <h2 className="text-base font-semibold text-ink">
                Auction starten für &bdquo;{auctionStarten.titel}&ldquo;
              </h2>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-ink-muted">
                Das System sucht passende HW im Radius (Gewerk-Match + verfügbar laut Google-Cal)
                und sendet automatisch Einladungen. Du musst niemanden manuell auswählen.
              </p>
              <div className="grid gap-2">
                <AuctionStartOption
                  label="🔴 Notfall"
                  text="Sofort-Match — Top-1-HW im 10 km-Radius wird direkt benachrichtigt."
                  disabled={auctionLaeuft}
                  onClick={() => void starteAuction(auctionStarten, "notfall")}
                />
                <AuctionStartOption
                  label="🟡 Zeitnah"
                  text="6 Stunden Auction-Fenster, mittlerer Radius. HW bieten ab — du pickst das beste."
                  disabled={auctionLaeuft}
                  onClick={() => void starteAuction(auctionStarten, "zeitnah")}
                />
                <AuctionStartOption
                  label="🟢 Planbar"
                  text="72 Stunden Auction-Fenster, voller Radius — maximale HW-Auswahl."
                  disabled={auctionLaeuft}
                  onClick={() => void starteAuction(auctionStarten, "planbar")}
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setAuctionStarten(null)}
                  disabled={auctionLaeuft}
                  className="text-xs px-3 py-2 rounded-lg text-ink-secondary hover:bg-surface-muted disabled:opacity-50"
                >
                  Abbrechen
                </button>
              </div>
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

function AuctionStartOption({ label, text, disabled, onClick }: {
  label: string; text: string; disabled: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left px-3 py-2.5 rounded-lg border border-line hover:border-accent/40 hover:bg-accent/5 transition-colors disabled:opacity-50"
    >
      <div className="text-sm font-semibold text-ink">{label}</div>
      <div className="text-xs text-ink-muted mt-0.5">{text}</div>
    </button>
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
