"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Ticket } from "@/types"
import { CardListSkeleton, KpiGridSkeleton, PageHeaderSkeleton } from "@/components/ui/Skeleton"
import { TrendingUp, TrendingDown, Minus, PiggyBank, Stethoscope, FileEdit, Clock, ArrowRight } from "lucide-react"
import { ThroughputChart, type ThroughputBucket } from "@/components/verwalter/ThroughputChart"
import { Accordion } from "@/components/ui/Accordion"
import { authFetch } from "@/lib/auth/clientFetch"

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
  dringend: { bar: "bg-[#C4574B]", pill: "text-danger bg-danger/10 border-danger/15" },
  hoch:     { bar: "bg-warm", pill: "text-warm-dark bg-warm-light border-warm/20" },
  normal:   { bar: "bg-rolle-mieter", pill: "text-rolle-mieter bg-[#EEF0FF] border-[#5B6ABF]/15" },
  niedrig:  { bar: "bg-[#8C857B]", pill: "text-ink-secondary bg-line border-line" },
}

const PRIO_LABEL: Record<string, string> = {
  dringend: "Dringend", hoch: "Hoch", normal: "Normal", niedrig: "Niedrig",
}

// Aggregierte Items, die im Dashboard-Banner "Wartet auf deine Entscheidung"
// erscheinen. Aus separaten Queries (Tickets + Nachträge) zusammengeführt.
interface OffeneNachtragRef {
  id: string
  ticket_id: string
  nachtrag_betrag: number
  stufe: "bagatell" | "wesentlich" | "erheblich"
  ticket_titel: string
}

export default function VerwalterDashboard() {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [offeneNachtraege, setOffeneNachtraege] = useState<OffeneNachtragRef[]>([])
  const [loading, setLoading] = useState(true)
  const [neueLive, setNeueLive] = useState(0)
  // Sprint H — KPIs + Throughput aus /api/verwalter/kpis (server-side
  // aggregiert, damit der Cache für die nächsten Lookups warm bleibt).
  const [kpis, setKpis] = useState<{
    offene_tickets: number
    neu_diese_woche: number
    in_bearbeitung: number
    erledigt_diese_woche: number
    throughput_4w: ThroughputBucket[]
  } | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    const [{ data: ts }, { data: ns }] = await Promise.all([
      supabase
        .from("tickets")
        .select("*, angebote(preis), direktvergabe_kandidaten, direktvergabe_index")
        .eq("verwalter_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("nachtraege")
        .select("id, ticket_id, nachtrag_betrag, stufe, tickets!inner(titel, verwalter_id)")
        .eq("status", "offen")
        .eq("tickets.verwalter_id", user.id)
        .returns<Array<{
          id: string
          ticket_id: string
          nachtrag_betrag: number
          stufe: "bagatell" | "wesentlich" | "erheblich"
          tickets: { titel: string; verwalter_id: string }
        }>>(),
    ])
    setTickets(ts || [])
    setOffeneNachtraege((ns || []).map(n => ({
      id: n.id,
      ticket_id: n.ticket_id,
      nachtrag_betrag: n.nachtrag_betrag,
      stufe: n.stufe,
      ticket_titel: n.tickets.titel,
    })))
    setLoading(false)

    // KPIs parallel im Hintergrund nachladen — blockt das initiale
    // Render nicht; bei Fehler einfach kein KPI-Block. fire-and-forget.
    void (async () => {
      try {
        const res = await authFetch("/api/verwalter/kpis")
        if (res.ok) setKpis(await res.json())
      } catch { /* silent */ }
    })()
  }, [router])

  useEffect(() => {
    load()
    // Realtime: bei jeder Änderung an tickets neu laden, Counter bumpen
    const supabase = createClient()
    const channel = supabase
      .channel("verwalter-tickets-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          setNeueLive(n => n + 1)
          load()
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  // Auktions-Ersparnis: pro erledigtem Ticket mit mind. 2 Angeboten ist
  // Baseline = höchstes abgegebenes Gebot (was ohne Wettbewerb gezahlt
  // worden wäre). Ersparnis = max(angebote.preis) - kosten_final.
  // Tickets mit nur einem Angebot oder ohne kosten_final liefern keine
  // sinnvolle Vergleichszahl und werden ignoriert.
  // Hook muss VOR dem early-return-loading stehen (Rules of Hooks).
  const ersparnis = useMemo(
    () => ersparnisAggregat(tickets.filter(t => t.status === "erledigt") as TicketMitGeboten[]),
    [tickets],
  )

  if (loading) return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto pt-16 md:pt-8">
      <PageHeaderSkeleton />
      <KpiGridSkeleton />
      <div className="mt-10">
        <CardListSkeleton count={3} rows={3} />
      </div>
    </div>
  )

  const offene = tickets.filter(t => t.status === "offen")
  const marktplatz = tickets.filter(t => t.status === "auktion")
  const inArbeit = tickets.filter(t => t.status === "in_bearbeitung")
  // Sprint AM Phase 3: Tickets in aktiver Direktvergabe (status='offen',
  // aber Direktvergabe-Kandidaten-Liste gesetzt). Diese erscheinen im "Neue
  // Meldungen"-Block, brauchen aber eine eigene KPI-Zählung.
  const vergabeAktiv = offene.filter(
    t => Array.isArray(t.direktvergabe_kandidaten) && t.direktvergabe_kandidaten.length > 0
  )
  const erledigt = tickets.filter(t => t.status === "erledigt")
  const monatsKosten = tickets
    .filter(t => t.kosten_final && new Date(t.created_at).getMonth() === new Date().getMonth())
    .reduce((s, t) => s + (t.kosten_final || 0), 0)

  const dringendeOffene = offene.filter(t => t.prioritaet === "notfall").length

  // === Pipeline-Action-Items: Befunde / Nachträge / abgelaufene Auktionen ===
  // (siehe SIMULATION-REPORT.md M-K1 — ohne diese Sektion bleibt die
  // gesamte Diagnose-Pipeline für den Verwalter unsichtbar)
  const befundeWartend = tickets.filter(
    t => t.ticket_typ === "diagnose"
      && t.befund_text
      && t.status !== "erledigt",
  )
  const auktionenAbgelaufen = tickets.filter(
    t => t.status === "auktion"
      && t.ticket_typ === "standard"
      && t.auktion_ende
      && new Date(t.auktion_ende).getTime() < Date.now(),
  )
  const hatPipelineAction = befundeWartend.length > 0
    || offeneNachtraege.length > 0
    || auktionenAbgelaufen.length > 0
  const hatAttention = offene.length > 0 || dringendeOffene > 0 || hatPipelineAction

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto pt-16 md:pt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-ink">Übersicht</h1>
            <span
              title="Live-Updates aktiv"
              aria-label="Live-Updates aktiv"
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-50 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              Live
            </span>
          </div>
          <p className="text-sm text-ink-muted mt-1.5">
            {tickets.length} {tickets.length === 1 ? "Vorgang" : "Vorgänge"}
            {hatAttention && ` · `}
            {hatAttention && (
              <span className="text-danger font-medium">
                {offene.length} {offene.length === 1 ? "wartet" : "warten"} auf dich
              </span>
            )}
            {neueLive > 0 && ` · ${neueLive} Live-Update${neueLive === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sprint AD — Mieter-First-Konzept-Bestätigung (25.05.):
              "+ Neues Ticket"-Primary-CTA entfernt. Mieter-Wizard ist
              jetzt der primäre Eingabe-Pfad. Verwalter-Wizard bleibt
              als Sonderfall erreichbar über Sidebar > "Mein Bereich"
              (telefonische Aufnahme falls Mieter nicht selber meldet). */}
          <Link
            href="/dashboard-verwalter/marktplatz"
            className="inline-flex items-center gap-2 text-sm font-semibold bg-accent text-white px-5 py-2.5 rounded-xl hover:bg-accent-hover transition-colors"
          >
            Handwerker-Marktplatz
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* Sprint AB1 — KPIs als beruhigte Inline-Strip statt 4 farbige
          Cards. Designer-Audit: weniger Highlights, mehr Klarheit.
          Throughput-Chart als einklappbares Akkordeon (default zu). */}
      {kpis && tickets.length > 0 && (
        <section className="mb-6 space-y-3">
          <div className="bg-white border border-line rounded-2xl px-5 py-3 flex flex-wrap items-center gap-x-8 gap-y-2">
            <KpiStripItem label="Offen" value={kpis.offene_tickets} />
            <KpiStripItem label="Neu diese Woche" value={kpis.neu_diese_woche} />
            <KpiStripItem label="In Bearbeitung" value={kpis.in_bearbeitung} />
            <KpiStripItem label="Erledigt diese Woche" value={kpis.erledigt_diese_woche} />
          </div>
          <Accordion
            title="Throughput · 4 Wochen"
            meta="Neu vs. Erledigt"
            persistKey="verwalter-throughput-chart"
            defaultOpen={false}
          >
            <ThroughputChart data={kpis.throughput_4w} />
          </Accordion>
        </section>
      )}

      {/* Attention Banner — wenn dringende offene Meldungen */}
      {dringendeOffene > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-danger/8 border-2 border-danger/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">⚠️</span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-danger">
                {dringendeOffene} {dringendeOffene === 1 ? "dringende Meldung" : "dringende Meldungen"}
              </div>
              <div className="text-xs text-[#854240] mt-0.5">
                Sofortige Bearbeitung empfohlen — scrollen für Details
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty-State: Verwalter ohne Tickets → Onboarding-Hilfe (V2) */}
      {tickets.length === 0 && (
        <section className="mb-8 bg-white border border-line rounded-2xl p-8">
          <div className="max-w-xl">
            <div className="text-xs font-bold text-accent uppercase tracking-wider mb-2">
              Willkommen bei Reparo
            </div>
            <h2 className="text-2xl font-semibold text-ink mb-3">
              Noch keine Tickets — los geht&apos;s
            </h2>
            <p className="text-sm text-ink-secondary mb-6 leading-relaxed">
              Tickets entstehen entweder durch Mieter-Meldungen (sobald du Objekte
              und Mieter angelegt hast) oder direkt durch dich, wenn du
              Handwerker beauftragst.
            </p>
            <div className="space-y-3">
              <Link
                href="/dashboard-verwalter/marktplatz"
                className="flex items-center justify-between gap-3 bg-surface border border-line rounded-xl p-4 hover:border-accent/40 transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-ink">Handwerker-Marktplatz</div>
                  <div className="text-xs text-ink-muted">Direktanfragen freigeben, HW auswählen</div>
                </div>
                <span className="text-accent text-lg">→</span>
              </Link>
              <Link
                href="/dashboard-verwalter/handwerker"
                className="flex items-center justify-between gap-3 bg-surface border border-line rounded-xl p-4 hover:border-accent/40 transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-ink">Handwerker-Pool</div>
                  <div className="text-xs text-ink-muted">Stamm-Handwerker hinzufügen</div>
                </div>
                <span className="text-accent text-lg">→</span>
              </Link>
              <Link
                href="/dashboard-verwalter/reporting"
                className="flex items-center justify-between gap-3 bg-surface border border-line rounded-xl p-4 hover:border-accent/40 transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-ink">Reporting</div>
                  <div className="text-xs text-ink-muted">Provisionen + Ausgaben überblicken</div>
                </div>
                <span className="text-accent text-lg">→</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Audit-R7c: positive Bestätigung wenn Pipeline leer.
          Sichtbar nur wenn der Verwalter überhaupt schon Tickets hatte
          (sonst ist der Empty-State weiter oben relevanter). */}
      {!hatPipelineAction && tickets.length > 0 && erledigt.length > 0 && (
        <section className="mb-6 bg-status-erledigt/5 border border-status-erledigt/20 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">🎉</span>
          <div className="flex-1 text-sm text-ink">
            <span className="font-semibold">Pipeline ist sauber.</span>
            {" "}Keine offenen Befunde, keine Nachträge, keine abgelaufenen Vergaben.
          </div>
        </section>
      )}

      {/* Pipeline-Action: Befunde + Nachträge + abgelaufene Auktionen */}
      {hatPipelineAction && (
        <section className="mb-6 bg-white border border-[#7C6CAB]/20 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-rolle-admin animate-pulse" />
            <h2 className="text-sm font-semibold text-rolle-admin uppercase tracking-wider">Wartet auf deine Entscheidung</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {befundeWartend.length > 0 && (
              <button
                onClick={() => router.push(`/dashboard-verwalter/ticket/${befundeWartend[0].id}`)}
                className="text-left bg-surface border border-line rounded-xl p-4 hover:border-[#7C6CAB]/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope size={16} className="text-rolle-admin" />
                  <span className="text-[10px] font-bold text-rolle-admin uppercase tracking-wider">Diagnose-Befunde</span>
                </div>
                <div className="text-3xl font-bold text-ink tabular-nums">{befundeWartend.length}</div>
                <div className="text-xs text-ink-secondary mt-1 flex items-center gap-1">
                  {befundeWartend.length === 1 ? "Befund mit Festpreis-Angebot" : "Befunde mit Festpreis-Angebot"}
                  <ArrowRight size={11} className="ml-0.5" />
                </div>
              </button>
            )}
            {offeneNachtraege.length > 0 && (
              <button
                onClick={() => router.push(`/dashboard-verwalter/ticket/${offeneNachtraege[0].ticket_id}`)}
                className="text-left bg-surface border border-line rounded-xl p-4 hover:border-warm/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileEdit size={16} className="text-warm" />
                  <span className="text-[10px] font-bold text-warm uppercase tracking-wider">Nachträge</span>
                </div>
                <div className="text-3xl font-bold text-ink tabular-nums">{offeneNachtraege.length}</div>
                <div className="text-xs text-ink-secondary mt-1 flex items-center gap-1">
                  {offeneNachtraege.length === 1 ? "Nachtrag offen" : "Nachträge offen"}
                  <ArrowRight size={11} className="ml-0.5" />
                </div>
              </button>
            )}
            {auktionenAbgelaufen.length > 0 && (
              <button
                onClick={() => router.push(`/dashboard-verwalter/ticket/${auktionenAbgelaufen[0].id}`)}
                className="text-left bg-surface border border-line rounded-xl p-4 hover:border-danger/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-danger" />
                  <span className="text-[10px] font-bold text-danger uppercase tracking-wider">Kein HW gefunden</span>
                </div>
                <div className="text-3xl font-bold text-ink tabular-nums">{auktionenAbgelaufen.length}</div>
                <div className="text-xs text-ink-secondary mt-1 flex items-center gap-1">
                  Keine Vergabe — erneut ausschreiben
                  <ArrowRight size={11} className="ml-0.5" />
                </div>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Auktions-Ersparnis-Widget */}
      {ersparnis.eligibleCount > 0 && (
        <ErsparnisWidget data={ersparnis} />
      )}

      {/* KPI Grid — F9: Status-Kacheln click-through auf gefilterte Ticket-Liste */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <Kpi
          label="Eingegangen"
          value={offene.length}
          accent={offene.length > 0 ? "warn" : "muted"}
          sub={offene.length === 0 ? "alles bearbeitet" : "warten auf dich"}
          href="/dashboard-verwalter/tickets?status=offen"
        />
        <Kpi
          label="Vergabe läuft"
          value={marktplatz.length + vergabeAktiv.length}
          accent="primary"
          sub={marktplatz.length > 0 ? `${vergabeAktiv.length} direkt · ${marktplatz.length} Marktplatz` : "direkt per System"}
          href="/dashboard-verwalter/marktplatz"
        />
        <Kpi
          label="In Arbeit"
          value={inArbeit.length}
          accent="info"
          sub="bei Handwerker"
          href="/dashboard-verwalter/tickets?status=in_bearbeitung"
        />
        <Kpi
          label="Kosten Monat"
          value={`${monatsKosten.toLocaleString("de")} €`}
          accent="muted"
          sub="diesen Monat"
        />
      </div>

      {/* Eingehende Meldungen — wichtigster Block */}
      {offene.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-ink">Neue Meldungen von Mietern</h2>
            <span className="text-xs bg-danger/10 text-danger font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
              Neu
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {offene.map(t => {
              const farben = PRIO_FARBEN[t.prioritaet] || PRIO_FARBEN.normal
              return (
                <article key={t.id} className="bg-white rounded-2xl border border-line p-5 hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className={`w-1 self-stretch rounded-full ${farben.bar} flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <h3 className="text-base font-semibold text-ink">{t.titel}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border flex-shrink-0 ${farben.pill}`}>
                          {PRIO_LABEL[t.prioritaet] || t.prioritaet}
                        </span>
                      </div>

                      <div className="text-xs text-ink-muted mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {t.eingetragen_von_verwalter && (
                          <span
                            title="Vom Verwalter telefonisch aufgenommen"
                            className="inline-flex items-center gap-1 text-rolle-verwalter font-medium"
                          >
                            📞 telefonisch
                          </span>
                        )}
                        {t.wohnung && <span>{t.wohnung}</span>}
                        {t.einsatzort_adresse && (
                          <span className="text-accent">📍 {t.einsatzort_adresse}</span>
                        )}
                        <span>·</span>
                        <span>{new Date(t.created_at).toLocaleDateString("de", { day: "numeric", month: "short" })}</span>
                      </div>

                      {t.beschreibung && (
                        <p className="text-sm text-ink-secondary line-clamp-2 mb-3">{t.beschreibung}</p>
                      )}

                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-xs text-ink-muted">
                          KI-Schätzung: <span className="text-ink font-medium">{kostenSchaetzung(t)} €</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/dashboard-verwalter/ticket/${t.id}`)}
                            className="text-xs text-ink-secondary hover:text-ink px-3 py-1.5 transition-colors"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => router.push("/dashboard-verwalter/marktplatz")}
                            className="text-xs font-semibold bg-accent text-white px-3.5 py-1.5 rounded-lg hover:bg-accent-hover transition-colors"
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

      {/* Vergabe läuft — direktvergabe + auktion (Sprint AM Phase 3) */}
      {(marktplatz.length > 0 || vergabeAktiv.length > 0) && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-4">
            Vergabe läuft <span className="text-ink-muted font-normal">({marktplatz.length + vergabeAktiv.length})</span>
          </h2>
          <div className="flex flex-col gap-2">
            {vergabeAktiv.map(t => (
              <button
                key={t.id}
                onClick={() => router.push(`/dashboard-verwalter/ticket/${t.id}`)}
                className="text-left bg-white rounded-xl border border-accent/20 p-4 hover:border-accent/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{t.titel}</div>
                    <div className="text-xs text-ink-muted truncate">
                      {t.wohnung && `${t.wohnung} · `}
                      {t.einsatzort_adresse}
                    </div>
                  </div>
                  <span className="text-xs text-accent font-medium flex-shrink-0">
                    Direktvergabe läuft
                  </span>
                </div>
              </button>
            ))}
            {marktplatz.map(t => (
              <button
                key={t.id}
                onClick={() => router.push(`/dashboard-verwalter/ticket/${t.id}`)}
                className="text-left bg-white rounded-xl border border-line p-4 hover:border-warm/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-warm flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{t.titel}</div>
                    <div className="text-xs text-ink-muted truncate">
                      {t.wohnung && `${t.wohnung} · `}
                      {t.einsatzort_adresse}
                    </div>
                  </div>
                  <span className="text-xs text-warm-dark font-medium flex-shrink-0">
                    Marktplatz (Fallback)
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
          <h2 className="text-sm font-semibold text-ink uppercase tracking-wide mb-4">
            In Arbeit <span className="text-ink-muted font-normal">({inArbeit.length})</span>
          </h2>
          <div className="flex flex-col gap-2">
            {inArbeit.map(t => (
              <button
                key={t.id}
                onClick={() => router.push(`/dashboard-verwalter/ticket/${t.id}`)}
                className="text-left bg-white rounded-xl border border-line p-4 hover:border-accent/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-rolle-mieter flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{t.titel}</div>
                    <div className="text-xs text-ink-muted truncate">
                      {t.wohnung && `${t.wohnung} · `}
                      {t.einsatzort_adresse}
                    </div>
                  </div>
                  <span className="text-xs text-rolle-mieter font-medium flex-shrink-0">In Arbeit</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {tickets.length === 0 && (
        <div className="bg-white rounded-2xl border border-line p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📥</span>
          </div>
          <h2 className="text-lg font-semibold text-ink mb-2">Noch keine Vorgänge</h2>
          <p className="text-sm text-ink-muted mb-6 max-w-sm mx-auto">
            Sobald deine Mieter Schäden melden oder du Aufträge auf dem Marktplatz vergibst, erscheinen sie hier.
          </p>
          <Link
            href="/dashboard-verwalter/marktplatz"
            className="inline-block text-sm font-semibold bg-accent text-white px-5 py-2.5 rounded-xl hover:bg-accent-hover transition-colors"
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
            className="text-xs text-ink-muted hover:text-accent transition-colors"
          >
            {erledigt.length} {erledigt.length === 1 ? "erledigter Vorgang" : "erledigte Vorgänge"} im Archiv →
          </Link>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Auktions-Ersparnis: Berechnung + Widget
// ============================================================

type TicketMitGeboten = Ticket & { angebote?: Array<{ preis: number | null }> | null }

interface EinzelErsparnis {
  ticket: TicketMitGeboten
  baseline: number
  bezahlt: number
  absolut: number
  prozent: number
}

interface ErsparnisAggregat {
  eligibleCount: number
  gesamtAbsolut: number
  monatAbsolut: number
  durchschnittProzent: number
  letzte5: EinzelErsparnis[]
  trend: { delta: number | null; richtung: "up" | "down" | "flat" | "none" }
}

function einzelErsparnis(t: TicketMitGeboten): EinzelErsparnis | null {
  const preise = (t.angebote ?? []).map(a => a.preis ?? 0).filter(p => p > 0)
  if (preise.length < 2) return null // kein Wettbewerb
  const bezahlt = t.kosten_final ?? 0
  if (bezahlt <= 0) return null
  const baseline = Math.max(...preise)
  if (baseline <= bezahlt) return null
  const absolut = baseline - bezahlt
  const prozent = (absolut / baseline) * 100
  return { ticket: t, baseline, bezahlt, absolut, prozent }
}

function ersparnisAggregat(erledigt: TicketMitGeboten[]): ErsparnisAggregat {
  const einzel = erledigt
    .map(einzelErsparnis)
    .filter((e): e is EinzelErsparnis => e !== null)

  const heute = new Date()
  const dieserMonat = heute.getMonth()
  const dieserYear = heute.getFullYear()
  const vorMonatDate = new Date(dieserYear, dieserMonat - 1, 1)
  const vorMonat = vorMonatDate.getMonth()
  const vorYear = vorMonatDate.getFullYear()

  const ausDiesemMonat = einzel.filter(e => {
    const d = new Date(e.ticket.created_at)
    return d.getMonth() === dieserMonat && d.getFullYear() === dieserYear
  })
  const ausVorMonat = einzel.filter(e => {
    const d = new Date(e.ticket.created_at)
    return d.getMonth() === vorMonat && d.getFullYear() === vorYear
  })

  const summe = (arr: EinzelErsparnis[]) => arr.reduce((s, e) => s + e.absolut, 0)
  const gesamtAbsolut = summe(einzel)
  const monatAbsolut = summe(ausDiesemMonat)
  const vorMonatAbsolut = summe(ausVorMonat)

  const durchschnittProzent = einzel.length > 0
    ? einzel.reduce((s, e) => s + e.prozent, 0) / einzel.length
    : 0

  let trendDelta: number | null = null
  let trendRichtung: "up" | "down" | "flat" | "none" = "none"
  if (vorMonatAbsolut === 0 && monatAbsolut === 0) {
    trendRichtung = "none"
  } else if (vorMonatAbsolut === 0) {
    trendDelta = 100
    trendRichtung = "up"
  } else {
    trendDelta = Math.round(((monatAbsolut - vorMonatAbsolut) / vorMonatAbsolut) * 100)
    trendRichtung = trendDelta > 0 ? "up" : trendDelta < 0 ? "down" : "flat"
  }

  // Letzte 5 sortiert nach created_at desc
  const letzte5 = [...einzel]
    .sort((a, b) => new Date(b.ticket.created_at).getTime() - new Date(a.ticket.created_at).getTime())
    .slice(0, 5)

  return {
    eligibleCount: einzel.length,
    gesamtAbsolut: Math.round(gesamtAbsolut * 100) / 100,
    monatAbsolut: Math.round(monatAbsolut * 100) / 100,
    durchschnittProzent: Math.round(durchschnittProzent * 10) / 10,
    letzte5,
    trend: { delta: trendDelta, richtung: trendRichtung },
  }
}

function ErsparnisWidget({ data }: { data: ErsparnisAggregat }) {
  const TrendIcon = data.trend.richtung === "up" ? TrendingUp
                  : data.trend.richtung === "down" ? TrendingDown
                  : Minus
  return (
    <section className="mb-8 rounded-2xl border border-accent/25 bg-gradient-to-br from-[#3D8B7A]/[0.06] to-[#3D8B7A]/[0.02] p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
            <PiggyBank size={20} className="text-accent" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-accent">
              System-Ersparnis
            </div>
            <div className="text-xs text-ink-secondary mt-0.5">
              Versus höchster Marktpreis · {data.eligibleCount} Ticket{data.eligibleCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        {data.trend.delta !== null && (
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
            data.trend.richtung === "up" ? "bg-accent/15 text-accent"
            : data.trend.richtung === "down" ? "bg-danger/10 text-danger"
            : "bg-line text-ink-secondary"
          }`}>
            <TrendIcon size={12} /> {Math.abs(data.trend.delta)} % vs. Vormonat
          </span>
        )}
      </div>

      {/* Drei-Spalten KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-muted font-medium mb-1">
            Gesamt
          </div>
          <div className="text-3xl font-bold tabular-nums text-accent">
            {data.gesamtAbsolut.toLocaleString("de", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-muted font-medium mb-1">
            Diesen Monat
          </div>
          <div className="text-2xl font-semibold tabular-nums text-ink">
            {data.monatAbsolut.toLocaleString("de", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-ink-muted font-medium mb-1">
            Ø pro Auftrag
          </div>
          <div className="text-2xl font-semibold tabular-nums text-ink">
            {data.durchschnittProzent.toFixed(1)} %
          </div>
        </div>
      </div>

      {/* Letzte 5 Liste */}
      {data.letzte5.length > 0 && (
        <div className="pt-4 border-t border-accent/15">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted font-medium mb-2">
            Letzte abgeschlossene Aufträge
          </div>
          <ul className="space-y-1">
            {data.letzte5.map(e => (
              <li key={e.ticket.id} className="flex items-center gap-3 text-sm py-1">
                <span className="flex-1 min-w-0 truncate text-ink">{e.ticket.titel}</span>
                <span className="text-xs text-ink-muted tabular-nums hidden sm:inline">
                  {e.bezahlt.toLocaleString("de")} € statt {e.baseline.toLocaleString("de")} €
                </span>
                <span className="font-semibold tabular-nums text-accent flex-shrink-0">
                  − {e.absolut.toLocaleString("de", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                </span>
                <span className="text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full tabular-nums flex-shrink-0">
                  −{Math.round(e.prozent)} %
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Kpi({ label, value, sub, accent, href }: {
  label: string
  value: string | number
  sub?: string
  accent?: "primary" | "warn" | "info" | "muted"
  href?: string
}) {
  const farben = {
    primary: "text-accent",
    warn: "text-danger",
    info: "text-rolle-mieter",
    muted: "text-ink",
  }
  const innerCls = `bg-white rounded-2xl border border-line p-4 block ${
    href ? "hover:border-accent/30 hover:shadow-sm transition-all cursor-pointer" : ""
  }`
  const content = (
    <>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-medium mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${farben[accent || "muted"]}`}>{value}</div>
      {sub && <div className="text-xs text-ink-muted mt-1">{sub}</div>}
    </>
  )
  if (href) {
    return <Link href={href} className={innerCls}>{content}</Link>
  }
  return <div className={innerCls}>{content}</div>
}

// Sprint AB1 — inline KPI-Strip-Item für Enterprise-Look.
// Ersetzt das frühere KpiTile (Sprint H) — keine Card, kein Akzent-
// Farbe, weniger Highlight. Designer-Audit: Verwalter braucht
// operative Ruhe, nicht 4 farbige Kacheln.
function KpiStripItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold tabular-nums text-ink">{value}</span>
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  )
}
