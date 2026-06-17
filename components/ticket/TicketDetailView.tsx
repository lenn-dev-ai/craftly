"use client"
import { useCallback, useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Ticket, Angebot, Nachricht, UserProfile, Einladung, Bewertung, formatGewerk } from "@/types"
import { Badge, PrioBadge, TypBadge, Avatar, Button, Card, Input, LoadingSpinner } from "@/components/ui"
import PreisAufschluesselung from "@/components/pricing/PreisAufschluesselung"
import DiagnosePipeline from "@/components/ticket/DiagnosePipeline"
import NachtragsBox from "@/components/ticket/NachtragsBox"
import { ReklamationButton } from "@/components/ticket/ReklamationButton"
import { ReklamationStatusBox } from "@/components/ticket/ReklamationStatusBox"
import { useToast } from "@/components/Toast"
import { useActiveRole } from "@/lib/context/ActiveRoleContext"
import { authFetch } from "@/lib/auth/clientFetch"

function berechneValueScore(angebot: Angebot, alleAngebote: Angebot[]): number {
  if (alleAngebote.length === 0) return 0
  const preise = alleAngebote.map(a => a.preis)
  const minPreis = Math.min(...preise)
  const maxPreis = Math.max(...preise)
  const preisRange = maxPreis - minPreis || 1
  const preisScore = 1 - ((angebot.preis - minPreis) / preisRange)
  const bewertung = angebot.handwerker?.bewertung_avg || 3
  const qualScore = Math.min(bewertung / 5, 1)
  let terminScore = 0.5
  if (angebot.fruehester_termin) {
    const tage = Math.max(0, (new Date(angebot.fruehester_termin).getTime() - Date.now()) / 86400000)
    terminScore = Math.max(0, 1 - (tage / 30))
  }
  return Math.round((preisScore * 0.4 + qualScore * 0.3 + terminScore * 0.3) * 100)
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating || 0)
  const half = (rating || 0) - full >= 0.5
  return (
    <span className="text-xs tracking-wide">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? "text-warm" : (i === full && half) ? "text-warm/50" : "text-line"}>★</span>
      ))}
      <span className="ml-1 text-ink-muted">{(rating || 0).toFixed(1)}</span>
    </span>
  )
}

function ValueScoreRing({ score }: { score: number }) {
  const r = 22, c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const color = score >= 75 ? "#3D8B7A" : score >= 50 ? "#C4956A" : "#C4574B"
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  )
}

// C4: Phasen-Indikator für Standard-Tickets. Synchron zu dem Mini-Pipeline-
// Block in app/dashboard-mieter/page.tsx — beide nutzen Mieter-Mental-
// Model "gemeldet → auktion → reparatur → erledigt".
// Quick-Win 3 (Audit Sprint AB2): Mieter sehen Laien-Begriffe
// ("Handwerker wird gesucht" / "Fertig"), Verwalter/Handwerker behalten
// die Geschäfts-Begriffe ("Auktion" / "Erledigt") — analog zu PIPELINE_STEPS
// in app/dashboard-mieter/page.tsx (Audit-R5).
const PHASEN: { key: string; label: string; labelDirekt: string; labelMieter: string }[] = [
  { key: "offen",          label: "Gemeldet",  labelDirekt: "Gemeldet", labelMieter: "Gemeldet" },
  // Sprint AU-Fix: Bei Direktvergabe (vergabemodus === "direkt") wurde nie
  // eine Auktion gestartet — die Phase heißt dann "Vergabe" statt "Auktion",
  // sonst wirkt der Indikator bei Sofort-Vergabe-Tickets widersprüchlich
  // ("Modus: Sofort-Vergabe" + Phasenleiste zeigt "Auktion").
  { key: "auktion",        label: "Auktion",   labelDirekt: "Vergabe",  labelMieter: "Handwerker wird gesucht" },
  { key: "in_bearbeitung", label: "Reparatur", labelDirekt: "Reparatur", labelMieter: "Reparatur" },
  { key: "erledigt",       label: "Erledigt",  labelDirekt: "Erledigt", labelMieter: "Fertig" },
]
function phasenIndex(status: string): number {
  // Sprint AL: "fertiggestellt_hw" ist ein Zwischenstatus innerhalb der
  // Reparatur-Phase (HW fertig, Verwalter prüft noch) — visuell bleibt die
  // Phasen-Anzeige auf "Reparatur", erst "erledigt" springt weiter.
  if (status === "fertiggestellt_hw") return PHASEN.findIndex(p => p.key === "in_bearbeitung")
  // Audit-Fix (Reklamations-Transparenz, 2026-06-15): "reklamiert" ist ein
  // Folgestatus von "erledigt" (Mieter hat nach Abnahme reklamiert) — die
  // Phasenleiste soll dabei NICHT auf "Gemeldet" zurückspringen, sondern
  // wie "erledigt" auf der letzten Stufe bleiben.
  if (status === "reklamiert") return PHASEN.findIndex(p => p.key === "erledigt")
  const idx = PHASEN.findIndex(p => p.key === status)
  return idx < 0 ? 0 : idx
}
function PhasenIndikator({ status, mieterSicht = false, vergabemodus }: { status: string; mieterSicht?: boolean; vergabemodus?: string }) {
  const aktiv = phasenIndex(status)
  return (
    <div className="mt-4 pt-4 border-t border-line">
      <div className="flex items-center gap-1 mb-1.5">
        {PHASEN.map((_, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= aktiv ? "bg-accent" : "bg-line"}`} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px]">
        {PHASEN.map((p, i) => (
          <span key={p.key} className={i <= aktiv ? "text-accent font-medium" : "text-ink-muted"}>
            {mieterSicht ? p.labelMieter : vergabemodus === "direkt" ? p.labelDirekt : p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xs font-bold bg-warm/20 text-warm px-2 py-0.5 rounded-full border border-warm/30">🥇 #1 Empfohlen</span>
  if (rank === 2) return <span className="text-xs font-bold bg-surface text-ink-secondary px-2 py-0.5 rounded-full border border-line">🥈 #2</span>
  if (rank === 3) return <span className="text-xs font-bold bg-[#854F0B]/20 text-warm-dark/80 px-2 py-0.5 rounded-full border border-warm/20">🥉 #3</span>
  return <span className="text-xs text-ink-muted px-2 py-0.5">#{rank}</span>
}

function kiPreisempfehlung(titel: string): string {
  const t = (titel || "").toLowerCase()
  if (t.includes("heizung") || t.includes("therme")) return "800–2.500"
  if (t.includes("wasser") || t.includes("rohr") || t.includes("leck")) return "300–1.200"
  if (t.includes("elektr") || t.includes("strom")) return "150–600"
  if (t.includes("tür") || t.includes("schloss") || t.includes("fenster")) return "200–800"
  if (t.includes("schimmel") || t.includes("feucht")) return "500–2.000"
  return "250–600"
}

function AuktionCountdown({ end, mieterSicht = false }: { end: string; mieterSicht?: boolean }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const calc = () => Math.max(0, Math.floor((new Date(end).getTime() - Date.now()) / 1000))
    setSecs(calc())
    const id = setInterval(() => setSecs(calc()), 1000)
    return () => clearInterval(id)
  }, [end])
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  const fmt = (n: number) => String(n).padStart(2, "0")
  const totalDuration = Math.max(1, (new Date(end).getTime() - Date.now()) / 1000 + secs)
  const progress = Math.min(100, Math.max(0, ((totalDuration - secs) / totalDuration) * 100))
  const expired = secs === 0
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 sm:p-6 border ${expired ? "bg-danger/5 border-danger/20" : "bg-gradient-to-r from-[#3D8B7A]/5 via-[#5B6ABF]/5 to-[#3D8B7A]/5 border-accent/20"}`}>
      {/* Item 2: vorher gap-6 + große AI-Icon-Box hat die Komponente auf
          Mobile (390 px) asymmetrisch wirken lassen — Icon links am Rand,
          Countdown rechts. Engere Gaps + kleineres Icon zentriert das. */}
      <div className="flex items-center justify-between gap-3 sm:gap-6">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
            <span className="text-base sm:text-lg font-bold text-accent">AI</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-accent">
                {mieterSicht ? "Handwerker wird gesucht" : "Auktion läuft"}
              </span>
              {!expired && <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
            </div>
            <div className="text-[11px] sm:text-xs text-ink-muted">
              {mieterSicht
                ? "Wir suchen automatisch den besten Handwerker für deinen Schaden"
                : "Handwerker bieten in Echtzeit — bestes Preis-Leistungs-Verhältnis gewinnt"}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {expired ? (
            <div className="text-lg font-bold text-danger">Abgelaufen</div>
          ) : (
            <>
              <div className="font-mono text-2xl sm:text-3xl font-bold tracking-wider">
                <span className="text-accent">{fmt(h)}</span>
                <span className="text-line mx-0.5">:</span>
                <span className="text-rolle-mieter">{fmt(m)}</span>
                <span className="text-line mx-0.5">:</span>
                <span className="text-ink-secondary">{fmt(s)}</span>
              </div>
              <div className="text-[10px] text-ink-muted mt-1">verbleibend</div>
            </>
          )}
        </div>
      </div>
      {!expired && (
        <div className="mt-4 h-1.5 bg-surface rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#3D8B7A] to-[#5B6ABF] rounded-full transition-all duration-1000" style={{ width: `${100 - progress}%` }} />
        </div>
      )}
    </div>
  )
}

export default function TicketDetailView() {
  const router = useRouter()
  const { show } = useToast()
  const params = useParams()
  const id = params.id as string
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([])
  const [chatText, setChatText] = useState("")
  const [angebotForm, setAngebotForm] = useState({ preis: "", termin: "", dauer: "", nachricht: "" })
  const [sending, setSending] = useState(false)
  const [submittingBid, setSubmittingBid] = useState(false)
  const [einladungen, setEinladungen] = useState<Einladung[]>([])
  const [bewertungen, setBewertungen] = useState<Bewertung[]>([])
  // K1.2: Vorgeschlagene Termin-Slots des Mieters (Doodle-Style).
  // Genau so wie der HW sie via K1.1 abgeschickt hat — alle 2-3 teilen
  // sich eine vorschlag_gruppe_id.
  const [terminVorschlaege, setTerminVorschlaege] = useState<
    Array<{ id: string; datum: string; von: string; bis: string; titel: string; status: string; vorschlag_gruppe_id: string | null; handwerker_id: string }>
  >([])
  const [bestaetigterTermin, setBestaetigterTermin] = useState<
    { id: string; datum: string; von: string; bis: string } | null
  >(null)
  const [slotChoiceLoading, setSlotChoiceLoading] = useState(false)
  const [slotChoiceError, setSlotChoiceError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [kostenFinal, setKostenFinal] = useState("")
  const [showKosten, setShowKosten] = useState(false)
  const [vergebenConfirm, setVergebenConfirm] = useState<string | null>(null)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  // Sprint AL: Handwerker-Self-Service-Abschluss
  const [showHwAbschluss, setShowHwAbschluss] = useState(false)
  const [hwKommentar, setHwKommentar] = useState("")
  const [hwAbschlussLoading, setHwAbschlussLoading] = useState(false)
  const [hwZurueckweisenLoading, setHwZurueckweisenLoading] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  // F5: ActiveRole muss hier oben mitgezogen werden (Rules of Hooks),
  // damit isVerwalter/isHandwerker weiter unten den Layout-Kontext kennen.
  const { rolle: aktiveRolle } = useActiveRole()

  const load = useCallback(async () => {
    // Agent-Review BUG-1: ohne try-catch propagierte jeder Fehler aus den
    // Supabase-Queries (RLS-Block, fehlende FK-Joins, Network) zur globalen
    // error.tsx-Boundary → User sah "Ein Fehler ist aufgetreten" ohne
    // Diagnose-Möglichkeit. Jetzt: lokaler Error-State + Retry, nichts
    // crasht den ganzen Tree.
    setLoadError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const [profileRes, ticketRes, msgsRes] = await Promise.all([
        supabase.from("profiles").select("id, email, name, rolle, firma, early_adopter_bis, created_at").eq("id", user.id).single(),
        supabase.from("tickets")
          .select("*, objekte(*), ersteller:profiles!erstellt_von(id, name, email, telefon, rolle), angebote(*, handwerker:profiles(id, name, firma, gewerk, bewertung_avg, auftraege_anzahl))")
          .eq("id", id).single(),
        supabase.from("nachrichten")
          .select("*, absender:profiles(id, name, firma, rolle)")
          .eq("ticket_id", id).order("created_at"),
      ])

      if (ticketRes.error) {
        console.error("[TicketDetailView] tickets load:", ticketRes.error)
        // PGRST116 = no rows = ticket existiert nicht oder RLS blockt
        if (ticketRes.error.code === "PGRST116") {
          setLoadError("Dieses Ticket existiert nicht oder du hast keinen Zugriff.")
        } else {
          setLoadError("Ticket konnte nicht geladen werden: " + ticketRes.error.message)
        }
        setLoading(false)
        return
      }
      if (!ticketRes.data) {
        setLoadError("Ticket nicht gefunden.")
        setLoading(false)
        return
      }

      setCurrentUser(profileRes.data ?? null)
      setTicket(ticketRes.data)
      setNachrichten(msgsRes.data || [])

      // Schadens-Foto via Signed URL (wenn vorhanden)
      if (ticketRes.data.foto_url) {
        const { getSchadensFotoUrl } = await import("@/lib/storage/schadens-foto")
        const url = await getSchadensFotoUrl(supabase, ticketRes.data.foto_url)
        setFotoUrl(url)
      } else {
        setFotoUrl(null)
      }

      // Best-effort: Einladungen/Bewertungen — wenn sie failen, ist das
      // kein Blocker (z. B. RLS gibt einer Rolle keinen Lese-Zugriff).
      const { data: einl, error: einlErr } = await supabase
        .from("einladungen")
        .select("*, handwerker:handwerker_id(id,name,firma,gewerk,bewertung_avg)")
        .eq("ticket_id", id)
      if (einlErr) console.warn("[TicketDetailView] einladungen:", einlErr.message)
      setEinladungen(einl || [])

      const { data: bew, error: bewErr } = await supabase
        .from("bewertungen").select("*").eq("ticket_id", id)
      if (bewErr) console.warn("[TicketDetailView] bewertungen:", bewErr.message)
      setBewertungen(bew || [])

      // K1.2: Termine zum Ticket — Vorschläge (status='vorgeschlagen')
      // und ggf. der bereits bestätigte Slot. abgelehnt/abgelaufen werden
      // gefiltert, weil sie für den Mieter nicht mehr handlungsrelevant
      // sind. Defensiv: status-Spalte könnte in alten DBs noch fehlen
      // (K1-Schema-Migration), darum die Catch-Ebene.
      try {
        const { data: ter, error: terErr } = await supabase
          .from("termine")
          .select("id, datum, von, bis, titel, status, vorschlag_gruppe_id, handwerker_id")
          .eq("ticket_id", id)
        if (terErr) {
          console.warn("[TicketDetailView] termine:", terErr.message)
        } else if (ter) {
          setTerminVorschlaege(ter.filter(t => t.status === "vorgeschlagen"))
          const best = ter.find(t => t.status === "bestaetigt")
          setBestaetigterTermin(best ? { id: best.id, datum: best.datum, von: best.von, bis: best.bis } : null)
        }
      } catch (err) {
        console.warn("[TicketDetailView] termine load:", err)
      }

      setLoading(false)
      if (chatRef.current) {
        setTimeout(() => {
          if (chatRef.current) chatRef.current.scrollTo(0, chatRef.current.scrollHeight)
        }, 100)
      }
    } catch (err) {
      console.error("[TicketDetailView] unerwarteter Fehler:", err)
      setLoadError(err instanceof Error ? err.message : "Unerwarteter Fehler beim Laden des Tickets.")
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  // Auto-Scroll bei neuen Nachrichten — reagiert auf jeden length-Wechsel
  // (initial load, eigenes send, künftige Realtime-Inserts). Robuster als
  // setTimeout in load(), weil auch Mid-Session-Updates erfasst werden.
  useEffect(() => {
    if (!chatRef.current) return
    chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" })
  }, [nachrichten.length])

  async function sendChat() {
    if (!chatText.trim() || !currentUser) return
    setSending(true)
    const supabase = createClient()
    // FIX-11: error-Check, sonst verschwindet die Nachricht stillos im
    // Nichts (z.B. RLS-Block, Foreign-Key-Fail, Netzwerk-Drop).
    const { error } = await supabase.from("nachrichten").insert({
      ticket_id: id, absender_id: currentUser.id, text: chatText.trim(),
    })
    if (error) {
      show("Nachricht konnte nicht gesendet werden: " + error.message, "error")
      setSending(false)
      return
    }
    setChatText("")
    await load()
    setSending(false)
  }

  async function submitAngebot() {
    if (!angebotForm.preis || !currentUser) return
    setSubmittingBid(true)
    // API-Route: schreibt Bid, markiert Einladung, triggert Smart-Score-Recompute
    const res = await authFetch("/api/auftraege/annehmen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticket_id: id,
        preis: Number(angebotForm.preis),
        fruehester_termin: angebotForm.termin || null,
        geschaetzte_dauer: angebotForm.dauer || null,
        nachricht: angebotForm.nachricht || null,
      }),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Unbekannter Fehler" }))
      show("Angebot konnte nicht eingereicht werden: " + error, "error")
      setSubmittingBid(false)
      return
    }
    setAngebotForm({ preis: "", termin: "", dauer: "", nachricht: "" })
    await load()
    setSubmittingBid(false)
  }

  async function vergeben(angebotId: string) {
    if (!currentUser) return

    const res = await authFetch("/api/auction/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket_id: id, angebot_id: angebotId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      show(data?.error || "Vergabe fehlgeschlagen", "error")
      return
    }

    show("Auftrag vergeben.", "success")
    setVergebenConfirm(null)
    await load()
  }

  async function abschliessen() {
    const supabase = createClient()
    const updates: Record<string, unknown> = { status: "erledigt" }
    if (kostenFinal) updates.kosten_final = Number(kostenFinal)
    const { error: closeErr } = await supabase.from("tickets").update(updates).eq("id", id)
    if (closeErr) {
      show("Abschließen fehlgeschlagen: " + closeErr.message, "error")
      return
    }

    if (currentUser) {
      // LT-7: System-Nachricht ist best-effort (Abschluss steht bereits in
      // tickets.status='erledigt'). Wenn Insert failt, nur loggen — sonst
      // würde der User denken der Abschluss wäre fehlgeschlagen, obwohl er
      // durchgegangen ist.
      const { error: nachrichtErr } = await supabase.from("nachrichten").insert({
        ticket_id: id,
        absender_id: currentUser.id,
        text: `✓ Auftrag abgeschlossen.${kostenFinal ? ` Endkosten: ${kostenFinal} €.` : ""}`,
      })
      if (nachrichtErr) {
        console.warn("[abschliessen] System-Nachricht fail:", nachrichtErr.message)
      }
    }

    show("Auftrag abgeschlossen.", "success")
    setShowKosten(false)
    await load()
  }

  // Sprint AL — Handwerker-Self-Service-Abschluss (Feature #216)
  // HW meldet seine Arbeit als fertig (optional mit Kommentar). Status
  // wechselt zu "fertiggestellt_hw" — Verwalter sieht ein Bestätigungs-
  // Banner und kann annehmen (-> erledigt, abschliessen()) oder
  // zurückweisen (-> zurück zu in_bearbeitung).
  async function hwAbschliessen() {
    if (!currentUser) return
    setHwAbschlussLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from("tickets").update({
      status: "fertiggestellt_hw",
      hw_abschluss_kommentar: hwKommentar.trim() || null,
      hw_abschluss_am: new Date().toISOString(),
    }).eq("id", id)
    if (error) {
      show("Konnte nicht gemeldet werden: " + error.message, "error")
      setHwAbschlussLoading(false)
      return
    }

    const { error: nachrichtErr } = await supabase.from("nachrichten").insert({
      ticket_id: id,
      absender_id: currentUser.id,
      text: `✓ Arbeit als abgeschlossen gemeldet.${hwKommentar.trim() ? ` Kommentar: ${hwKommentar.trim()}` : ""} Der Verwalter prüft den Abschluss.`,
    })
    if (nachrichtErr) {
      console.warn("[hwAbschliessen] System-Nachricht fail:", nachrichtErr.message)
    }

    show("Als abgeschlossen gemeldet — der Verwalter wird benachrichtigt.", "success")
    setShowHwAbschluss(false)
    setHwKommentar("")
    setHwAbschlussLoading(false)
    await load()
  }

  // Verwalter weist den HW-Abschluss zurück: Status zurück auf
  // in_bearbeitung, HW wird per System-Nachricht im Chat informiert.
  async function hwAbschlussZurueckweisen() {
    if (!currentUser) return
    setHwZurueckweisenLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from("tickets").update({
      status: "in_bearbeitung",
    }).eq("id", id)
    if (error) {
      show("Zurückweisen fehlgeschlagen: " + error.message, "error")
      setHwZurueckweisenLoading(false)
      return
    }

    const { error: nachrichtErr } = await supabase.from("nachrichten").insert({
      ticket_id: id,
      absender_id: currentUser.id,
      text: `Der Abschluss wurde zurückgewiesen — bitte die Arbeit fortsetzen bzw. Rücksprache halten.`,
    })
    if (nachrichtErr) {
      console.warn("[hwAbschlussZurueckweisen] System-Nachricht fail:", nachrichtErr.message)
    }

    show("Abschluss zurückgewiesen — Handwerker wurde informiert.", "success")
    setHwZurueckweisenLoading(false)
    await load()
  }

  async function bewertenSpeichern(sterne: number, kommentar: string) {
    if (!ticket?.zugewiesener_hw || !currentUser) return
    const supabase = createClient()
    // Profil-Aggregat (bewertung_avg, auftraege_anzahl) wird per
    // SECURITY-DEFINER-Trigger im Postgres automatisch aktualisiert.
    const { error: insertErr } = await supabase.from("bewertungen").insert({
      ticket_id: id,
      handwerker_id: ticket.zugewiesener_hw,
      bewerter_id: currentUser.id,
      sterne,
      kommentar: kommentar || null,
    })
    if (insertErr) {
      show("Bewertung konnte nicht gespeichert werden: " + insertErr.message, "error")
      return
    }
    await load()
  }

  if (loading) return <LoadingSpinner />
  if (loadError) return (
    <div className="p-6 max-w-md mx-auto">
      <Card className="bg-white border border-danger/20">
        <div className="text-center space-y-3">
          <div className="text-base font-semibold text-ink">Ticket konnte nicht geladen werden</div>
          <p className="text-sm text-ink-secondary">{loadError}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => { setLoading(true); load() }} variant="secondary" size="sm">
              Erneut versuchen
            </Button>
            <Button onClick={() => router.back()} variant="ghost" size="sm">
              Zurück
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
  if (!ticket) return <div className="p-6 text-sm text-gray-500">Ticket nicht gefunden.</div>

  // F5: Admin-Accounts dürfen alle Layouts betreten (siehe RoleGuard), aber
  // wenn der Admin gerade in der Mieter- oder Handwerker-Sicht ist, sollen
  // Verwalter-Aktionen (z.B. "Handwerker auswählen") NICHT erscheinen —
  // sonst rutscht der User unfreiwillig in einen anderen Layout-Stack.
  // Der ActiveRoleContext-Default ist "verwaltung", d.h. in /dashboard-admin
  // ohne Provider gilt weiter "Verwalter-Sicht".
  const istInVerwalterSicht = aktiveRolle === "verwaltung"
  const istInHandwerkerSicht = aktiveRolle === "handwerker"
  const isVerwalter =
    currentUser?.rolle === "verwalter" ||
    (currentUser?.rolle === "admin" && istInVerwalterSicht)
  const isHandwerker =
    currentUser?.rolle === "handwerker" ||
    (currentUser?.rolle === "admin" && istInHandwerkerSicht)
  const istMieter = currentUser?.id === ticket.erstellt_von

  // K1.2: Slot-Choice-Aktionen. Auth via Bearer-Token (B1.1-Pattern),
  // damit der API-Endpunkt den User auch in App-Router-Route-Handlern
  // sauber resolved.
  async function chooseSlot(action: "select" | "reject", terminId?: string) {
    const gruppeId = terminVorschlaege[0]?.vorschlag_gruppe_id
    if (!gruppeId) return
    setSlotChoiceError(null)
    setSlotChoiceLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await authFetch("/api/termine/select-slot", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          gruppe_id: gruppeId,
          action,
          termin_id: terminId,
        }),
      })
      const body = await res.json().catch(() => ({})) as { error?: string; message?: string }
      if (!res.ok) {
        // slot_conflict → lesbare Meldung aus .message (analog zum HW-seitigen google_conflict)
        setSlotChoiceError(
          body.error === "slot_conflict"
            ? (body.message ?? "Dieser Zeitslot ist beim Handwerker nicht mehr verfügbar. Bitte wähle 'Keiner passt' und bitte um neue Vorschläge.")
            : (body.error || "Aktion fehlgeschlagen.")
        )
      } else {
        show(action === "select" ? "Termin bestätigt." : "Vorschläge abgelehnt — HW wird informiert.", "success")
        await load()
      }
    } finally {
      setSlotChoiceLoading(false)
    }
  }
  const hatBereitsAngebot = ticket.angebote?.some(a => a.handwerker_id === currentUser?.id)
  const alleAngebote = ticket.angebote || []
  const sortiertAngebote = [...alleAngebote]
    .map((a, _, arr) => ({ ...a, valueScore: berechneValueScore(a, arr) }))
    .sort((a, b) => b.valueScore - a.valueScore)

  const avgPreis = alleAngebote.length > 0 ? Math.round(alleAngebote.reduce((s, a) => s + a.preis, 0) / alleAngebote.length) : 0
  const minPreis = alleAngebote.length > 0 ? Math.min(...alleAngebote.map(a => a.preis)) : 0
  const maxPreis = alleAngebote.length > 0 ? Math.max(...alleAngebote.map(a => a.preis)) : 0
  const savings = maxPreis > 0 ? Math.round(((maxPreis - minPreis) / maxPreis) * 100) : 0

  return (
    <div className="min-h-screen bg-surface text-ink pb-12">
      {/* Sprint R Phase 17 (Audit-Feedback ae98f00a):
          vorher hatte der mx-auto-Container das Hamburger-Padding INTERN
          (pl-14 pr-4) — Mobile-Folge: Content visuell nach rechts
          verschoben weil pl ≠ pr. Jetzt: Hamburger-Clearance auf den
          OUTER-Container, mx-auto-Box bleibt symmetrisch zentriert. */}
      <div className="pl-14 pr-4 md:px-6">
        <div className="max-w-4xl mx-auto py-4 md:py-6">
        {/* Navigation */}
        <button onClick={() => router.back()} className="text-sm text-ink-muted hover:text-ink-secondary mb-6 flex items-center gap-2 transition-colors">
          ← Zurück
        </button>

        {/* Ticket Header */}
        <div className="bg-white border border-line rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-ink mb-2 break-words">{ticket.titel}</h1>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {/* Reihenfolge: Status (primär gefüllt) → Prio (nur wenn !=normal) →
                    Typ (subtil) → Meta. Audit Punkt 4: nur EIN gefüllter Chip. */}
                <Badge status={ticket.status} mieterSicht={istMieter} />
                <PrioBadge prio={ticket.prioritaet} />
                {ticket.ticket_typ && ticket.ticket_typ !== "standard" && (
                  <TypBadge typ={ticket.ticket_typ as "diagnose" | "projekt"} />
                )}
                {ticket.wohnung && <span className="text-xs text-ink-muted bg-surface px-2 py-1 rounded-lg">{ticket.wohnung}</span>}
                {/* Loop-23 (27.05.): Mieter-/Wohneinheits-Nr als prominentes
                    Badge — Verwalter sieht beim ersten Blick die Zuordnung. */}
                {ticket.wohneinheit_referenz && (
                  <span className="text-xs text-rolle-verwalter bg-rolle-verwalter/10 border border-rolle-verwalter/20 px-2 py-1 rounded-lg font-mono font-medium">
                    #{ticket.wohneinheit_referenz}
                  </span>
                )}
              </div>
              {ticket.beschreibung && <p className="text-sm text-ink-secondary leading-relaxed break-words whitespace-pre-wrap">{ticket.beschreibung}</p>}
            </div>
            {isVerwalter && ticket.status === "in_bearbeitung" && !showKosten && (
              <Button size="sm" onClick={() => setShowKosten(true)}>Abschließen</Button>
            )}
          </div>
          {/* C4: Phasen-Indikator für Standard-Aufträge — Diagnose-/
              Projekt-Tickets bekommen die ausführlichere DiagnosePipeline
              weiter unten. Phasen orientieren sich am Mieter-Dashboard. */}
          {(!ticket.ticket_typ || ticket.ticket_typ === "standard") && (
            <PhasenIndikator status={ticket.status} mieterSicht={istMieter} vergabemodus={ticket.vergabemodus} />
          )}

          {/* Ticket meta */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-line text-xs text-ink-muted">
            <span>Erstellt: {new Date(ticket.created_at).toLocaleDateString("de", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
            {ticket.gewerk && <span>Gewerk: {formatGewerk(ticket.gewerk)}</span>}
            {ticket.vergabemodus && <span>Modus: {ticket.vergabemodus === "auktion" ? "Auktion" : ticket.vergabemodus === "direkt" ? "Sofort-Vergabe" : "Planauftrag"}</span>}
          </div>
        </div>

        {/* F7: Kontext-Karten für Verwalter — Objekt, Mieter, KI-Einschätzung.
            Nur in Verwalter-Sicht sichtbar; Mieter/HW-Sicht kriegt das nicht. */}
        {isVerwalter && (ticket.objekte || ticket.ersteller || ticket.ki_schadensart) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {ticket.objekte && (
              <Card className="bg-white border border-line">
                <div className="text-[10px] text-ink-muted uppercase tracking-wider font-medium mb-2">Objekt</div>
                <div className="text-sm font-semibold text-ink mb-1">{ticket.objekte.name}</div>
                <div className="text-xs text-ink-secondary leading-relaxed">
                  {ticket.objekte.adresse}
                  {ticket.objekte.plz && <><br />{ticket.objekte.plz}</>}
                </div>
                {(ticket.wohnung || typeof ticket.objekte.einheiten_anzahl === "number") && (
                  <div className="text-[11px] text-ink-muted mt-2 pt-2 border-t border-line space-y-0.5">
                    {ticket.wohnung && <div>Wohnung: <span className="text-ink-secondary">{ticket.wohnung}</span></div>}
                    {ticket.wohneinheit_referenz && <div>Mieter-/WE-Nr: <span className="text-ink-secondary font-mono">{ticket.wohneinheit_referenz}</span></div>}
                    {typeof ticket.objekte.einheiten_anzahl === "number" && (
                      <div>{ticket.objekte.einheiten_anzahl} Einheiten gesamt</div>
                    )}
                  </div>
                )}
              </Card>
            )}
            {ticket.ersteller && (
              <Card className="bg-white border border-line">
                <div className="text-[10px] text-ink-muted uppercase tracking-wider font-medium mb-2">Mieter</div>
                <div className="text-sm font-semibold text-ink mb-1">{ticket.ersteller.name || "—"}</div>
                <div className="text-xs text-ink-secondary leading-relaxed space-y-0.5">
                  {ticket.ersteller.email && (
                    <div>
                      <a href={`mailto:${ticket.ersteller.email}`} className="hover:text-accent break-all">
                        {ticket.ersteller.email}
                      </a>
                    </div>
                  )}
                  {ticket.ersteller.telefon && (
                    <div>
                      <a href={`tel:${ticket.ersteller.telefon}`} className="hover:text-accent">
                        {ticket.ersteller.telefon}
                      </a>
                    </div>
                  )}
                  {!ticket.ersteller.email && !ticket.ersteller.telefon && (
                    <div className="text-ink-muted">Keine Kontaktdaten hinterlegt</div>
                  )}
                </div>
              </Card>
            )}
            {(ticket.ki_schadensart || typeof ticket.ki_confidence === "number") && (
              <Card className="bg-white border border-line">
                <div className="text-[10px] text-ink-muted uppercase tracking-wider font-medium mb-2">KI-Einschätzung</div>
                {ticket.ki_schadensart && (
                  <div className="text-sm font-semibold text-ink mb-1 capitalize">
                    {ticket.ki_schadensart.replace(/_/g, " ")}
                  </div>
                )}
                {ticket.gewerk && (
                  <div className="text-xs text-ink-secondary">
                    Vorhergesagtes Gewerk: <span className="text-ink">{formatGewerk(ticket.gewerk)}</span>
                  </div>
                )}
                {typeof ticket.ki_confidence === "number" && (
                  <div className="text-[11px] text-ink-muted mt-2 pt-2 border-t border-line">
                    Confidence: <span className={
                      ticket.ki_confidence >= 0.8 ? "text-accent font-semibold" :
                      ticket.ki_confidence >= 0.5 ? "text-warm font-semibold" :
                      "text-danger font-semibold"
                    }>{Math.round(ticket.ki_confidence * 100)} %</span>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* K1.2: Termin-Vorschläge (Doodle-Style) */}
        {bestaetigterTermin ? (
          <div className="bg-accent/5 border border-accent/30 rounded-2xl p-5 mb-6">
            <div className="text-[10px] uppercase tracking-wider text-accent font-bold mb-1">Termin bestätigt</div>
            <div className="text-base font-semibold text-ink">
              {new Date(bestaetigterTermin.datum).toLocaleDateString("de", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
            </div>
            <div className="text-sm text-ink-secondary">
              {bestaetigterTermin.von.slice(0, 5)} – {bestaetigterTermin.bis.slice(0, 5)} Uhr
            </div>
          </div>
        ) : terminVorschlaege.length > 0 && istMieter ? (
          <div className="bg-white border border-line rounded-2xl p-5 mb-6">
            <div className="text-[10px] uppercase tracking-wider text-ink-muted font-bold mb-1">Termin wählen</div>
            <h3 className="text-base font-semibold text-ink mb-3">Der Handwerker hat {terminVorschlaege.length} Termine vorgeschlagen</h3>
            <p className="text-xs text-ink-muted mb-4">
              Wähle einen Termin aus. Die anderen verfallen automatisch.
            </p>
            <div className="space-y-2 mb-3">
              {terminVorschlaege
                .sort((a, b) => (a.datum + a.von).localeCompare(b.datum + b.von))
                .map(t => (
                <button
                  key={t.id}
                  onClick={() => chooseSlot("select", t.id)}
                  disabled={slotChoiceLoading}
                  className="w-full text-left border border-line rounded-xl p-3 hover:border-accent/40 hover:bg-accent/5 transition-all disabled:opacity-50"
                >
                  <div className="text-sm font-semibold text-ink">
                    {new Date(t.datum).toLocaleDateString("de", { weekday: "short", day: "2-digit", month: "short" })}
                  </div>
                  <div className="text-xs text-ink-secondary">
                    {t.von.slice(0, 5)} – {t.bis.slice(0, 5)} Uhr
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => chooseSlot("reject")}
              disabled={slotChoiceLoading}
              className="w-full text-xs text-ink-muted hover:text-danger py-2 disabled:opacity-50"
            >
              Keiner passt — neue Slots vorschlagen lassen
            </button>
            {slotChoiceError && (
              <div className="mt-3 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {slotChoiceError}
              </div>
            )}
          </div>
        ) : terminVorschlaege.length > 0 && (isHandwerker || isVerwalter) ? (
          <div className="bg-warm-light border border-warm/30 rounded-2xl p-4 mb-6">
            <div className="text-[10px] uppercase tracking-wider text-warm-dark font-bold mb-1">Wartet auf Mieter</div>
            <p className="text-xs text-warm-dark/90">
              {terminVorschlaege.length} Termin{terminVorschlaege.length === 1 ? "" : "e"} vorgeschlagen — der Mieter wählt einen aus.
            </p>
          </div>
        ) : null}

        {/* Diagnose/Projekt-Pipeline */}
        {(ticket.ticket_typ === "diagnose" || ticket.ticket_typ === "projekt") && (
          <DiagnosePipeline ticket={ticket} currentUser={currentUser} onReload={load} />
        )}

        {/* Nachträge — sichtbar für Projekt-Tickets während/nach Bearbeitung */}
        {ticket.ticket_typ === "projekt" &&
          (ticket.status === "in_bearbeitung" || ticket.status === "fertiggestellt_hw" || ticket.status === "erledigt") && (
          <NachtragsBox ticket={ticket} currentUser={currentUser} onReload={load} />
        )}

        {/* Schadens-Foto (Signed URL, 30 Min gültig) */}
        {fotoUrl && (
          <div className="mb-6">
            <div className="rounded-2xl overflow-hidden border border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fotoUrl}
                alt={`Foto vom Schaden: ${ticket.titel}`}
                className="w-full max-h-96 object-contain bg-surface"
              />
            </div>
          </div>
        )}

        {/* === PENALTY-MARKER === */}
        {ticket.penalty_status === "manual_pending" && (
          <Card className="mb-6 border-warm/30 bg-warm-light">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-warm/20 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-warm-dark">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-warm-dark">
                  Frist-Penalty offen
                  {ticket.penalty_amount_cents && (
                    <> · €{(ticket.penalty_amount_cents / 100).toFixed(2)}</>
                  )}
                </div>
                <p className="text-xs text-warm-dark/80 mt-0.5">
                  Der HW hat die 14-Tage-Frist überschritten. Reparo verrechnet die Penalty separat.
                </p>
              </div>
            </div>
          </Card>
        )}
        {ticket.penalty_status === "paid" && (
          <div className="mb-3 text-xs text-ink-muted flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Frist-Penalty verrechnet
            {ticket.penalty_amount_cents && (
              <> (€{(ticket.penalty_amount_cents / 100).toFixed(2)})</>
            )}
          </div>
        )}

        {/* === AUCTION HERO === Audit-R5: Mieter-Sicht zeigt
            "Handwerker wird gesucht" statt "Auktion läuft".
            Sprint AU F9: bei Direktvergabe kein AuktionCountdown — HW
            wurde direkt angefragt, kein offener Bietermarkt. */}
        {ticket.status === "auktion" && ticket.auktion_ende && !ticket.direktvergabe_gestartet && (
          <div className="mb-6">
            <AuktionCountdown end={ticket.auktion_ende} mieterSicht={istMieter} />
            {/* Auction Stats */}
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="bg-white border border-line rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-accent">{sortiertAngebote.length}</div>
                <div className="text-[10px] text-ink-muted mt-1">Angebote</div>
              </div>
              <div className="bg-white border border-line rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-rolle-mieter">
                  {minPreis > 0
                    ? (minPreis === maxPreis ? `${minPreis}` : `${minPreis}–${maxPreis}`)
                    : "—"}
                </div>
                <div className="text-[10px] text-ink-muted mt-1">Preisspanne EUR</div>
              </div>
              <div className="bg-white border border-line rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-warm">{savings > 0 ? `${savings}%` : "—"}</div>
                <div className="text-[10px] text-ink-muted mt-1">Potenzielle Ersparnis</div>
              </div>
            </div>
          </div>
        )}

        {/* Kosten-Eingabe beim Abschließen */}
        {showKosten && (
          <Card className="mb-6 border-accent/30 bg-white">
            <h2 className="text-sm font-semibold text-ink mb-2">Ticket abschließen</h2>
            <p className="text-xs text-ink-muted mb-3">Trage die tatsächlichen Kosten ein, bevor du das Ticket abschließt.</p>
            <Input label="Endkosten in EUR" type="number" placeholder="z.B. 450" value={kostenFinal} onChange={e => setKostenFinal(e.target.value)} />
            <div className="flex gap-2 mt-3">
              <Button onClick={abschliessen}>Abschließen</Button>
              <button onClick={() => setShowKosten(false)} className="text-sm text-ink-muted hover:text-ink-secondary px-3">Abbrechen</button>
            </div>
          </Card>
        )}

        {/* Erledigte Ticket Info — Audit-Fix: bleibt auch nach "reklamiert" sichtbar,
            da der Auftrag selbst weiterhin abgeschlossen ist (Reklamation betrifft
            die Qualität, nicht den Status der Beauftragung). */}
        {(ticket.status === "erledigt" || ticket.status === "reklamiert") && (
          <div className="bg-accent/5 border border-accent/20 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">✓</div>
              <div>
                <div className="text-sm font-semibold text-accent">Auftrag abgeschlossen</div>
                {ticket.kosten_final && <div className="text-xs text-ink-muted mt-0.5">Endkosten: {ticket.kosten_final.toLocaleString("de")} EUR</div>}
              </div>
            </div>
          </div>
        )}

        {/* Provisions-Aufschlüsselung — sichtbar für Verwalter wenn kosten_final gesetzt */}
        {isVerwalter
          && ticket.kosten_final != null
          && ticket.kosten_final > 0
          && (ticket.status === "in_bearbeitung" || ticket.status === "erledigt" || ticket.status === "reklamiert") && (
          <div className="mb-6">
            <PreisAufschluesselung
              auftragswert={ticket.kosten_final}
              provisionRate={
                currentUser?.early_adopter_bis &&
                new Date(currentUser.early_adopter_bis).getTime() > Date.now()
                  ? 0
                  : Math.round(0.05 * ((ticket as { surge_faktor?: number }).surge_faktor ?? 1) * 10000) / 10000
              }
              earlyAdopterBis={currentUser?.early_adopter_bis ?? null}
            />
          </div>
        )}

        {/* Bewertung-UI: nur Mieter, nur wenn erledigt + nicht schon bewertet */}
        {ticket.status === "erledigt"
          && currentUser?.id === ticket.erstellt_von
          && ticket.zugewiesener_hw
          && !bewertungen.some(b => b.bewerter_id === currentUser.id)
          && (
          <BewertungForm onSubmit={bewertenSpeichern} />
        )}

        {/* Sprint U Phase 2 — Mieter-Reklamations-Button (nach Bewertung sichtbar).
            DB-Status-Set: erledigt | reklamiert. "abgenommen" existiert nicht
            in der CHECK-Constraint (Cowork-Initial-Code-Drift). */}
        {ticket.status === "erledigt"
          && currentUser?.id === ticket.erstellt_von && (
          <ReklamationButton ticketId={ticket.id} />
        )}

        {/* Reklamations-Transparenz (Audit-Fix 2026-06-15): zeigt Grund, Details,
            Status und nächsten Schritt — für Mieter UND Verwalter, sobald eine
            Reklamation zu diesem Ticket existiert. Die Box lädt sich selbst und
            rendert nichts, falls (noch) keine Reklamation vorliegt — daher reicht
            ein grobes Status-Gate (erledigt | reklamiert). Verwalter erhalten
            zusätzlich Steuerelemente zum Status-Update. */}
        {(ticket.status === "erledigt" || ticket.status === "reklamiert")
          && (currentUser?.id === ticket.erstellt_von || isVerwalter) && (
          <ReklamationStatusBox ticketId={ticket.id} canManage={isVerwalter} />
        )}

        {/* Bewertung-Bestätigung wenn bereits abgegeben */}
        {ticket.status === "erledigt"
          && currentUser?.id === ticket.erstellt_von
          && bewertungen.some(b => b.bewerter_id === currentUser.id) && (
          <div className="bg-white border border-line rounded-2xl p-5 mb-6">
            <div className="text-sm font-semibold text-ink mb-1">Danke für deine Bewertung</div>
            {(() => {
              const meine = bewertungen.find(b => b.bewerter_id === currentUser?.id)
              if (!meine) return null
              return (
                <div className="text-xs text-ink-muted">
                  <span className="text-warm">{"★".repeat(meine.sterne)}{"☆".repeat(5 - meine.sterne)}</span>
                  {meine.kommentar && <p className="mt-2 italic">„{meine.kommentar}“</p>}
                </div>
              )
            })()}
          </div>
        )}

        {/* Zugewiesener Handwerker Info */}
        {ticket.status === "in_bearbeitung" && ticket.zugewiesener_hw && (
          <div className="bg-rolle-mieter/5 border border-[#5B6ABF]/20 rounded-2xl p-5 mb-6">
            <div className="text-xs text-ink-muted mb-3 font-medium">BEAUFTRAGTER HANDWERKER</div>
            {(() => {
              const hw = alleAngebote.find(a => a.handwerker_id === ticket.zugewiesener_hw)
              if (!hw) return null
              return (
                <div className="flex items-center gap-3">
                  <Avatar name={hw.handwerker?.name || "?"} size="md" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink">{hw.handwerker?.name}</div>
                    <div className="text-xs text-ink-muted">{hw.handwerker?.firma}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-accent">{hw.preis} EUR</div>
                    <div className="text-[10px] text-ink-muted">Angenommener Preis</div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Sprint AL — Handwerker-Self-Service-Abschluss (Feature #216):
            HW meldet Arbeit als fertig, optional mit Kommentar. */}
        {isHandwerker && ticket.status === "in_bearbeitung" && (
          <Card className="mb-6 bg-white border border-line">
            {!showHwAbschluss ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Arbeit erledigt?</h3>
                  <p className="text-xs text-ink-muted mt-0.5">Melde dem Verwalter, dass du mit der Reparatur fertig bist.</p>
                </div>
                <Button size="sm" onClick={() => setShowHwAbschluss(true)}>Arbeit abgeschlossen melden</Button>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-ink mb-2">Arbeit abgeschlossen melden</h3>
                <Input
                  label="Kommentar für den Verwalter (optional)"
                  type="text"
                  placeholder="z.B. Dichtung ersetzt, Leitung gespült"
                  value={hwKommentar}
                  onChange={e => setHwKommentar(e.target.value)}
                />
                <div className="flex gap-2 mt-3">
                  <Button onClick={hwAbschliessen} disabled={hwAbschlussLoading}>
                    {hwAbschlussLoading ? "Wird gemeldet..." : "Melden"}
                  </Button>
                  <button onClick={() => setShowHwAbschluss(false)} className="text-sm text-ink-muted hover:text-ink-secondary px-3">
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Sprint AL — Verwalter-Bestätigungs-Banner: HW hat Arbeit als
            abgeschlossen gemeldet, Verwalter muss bestätigen oder
            zurückweisen. */}
        {isVerwalter && ticket.status === "fertiggestellt_hw" && !showKosten && (
          <Card className="mb-6 border-status-auktion/30 bg-status-auktion/5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-status-auktion/15 flex items-center justify-center flex-shrink-0 text-status-auktion font-bold">!</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink">Handwerker meldet: Arbeit abgeschlossen</div>
                {ticket.hw_abschluss_kommentar && (
                  <p className="text-xs text-ink-secondary mt-1 italic">„{ticket.hw_abschluss_kommentar}“</p>
                )}
                {ticket.hw_abschluss_am && (
                  <p className="text-[10px] text-ink-muted mt-1">
                    Gemeldet am {new Date(ticket.hw_abschluss_am).toLocaleDateString("de", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </p>
                )}
                <p className="text-xs text-ink-muted mt-2">Bitte prüfen und bestätigen — oder zurückweisen, falls noch etwas fehlt.</p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => setShowKosten(true)}>Bestätigen & Abschließen</Button>
                  <button onClick={hwAbschlussZurueckweisen} disabled={hwZurueckweisenLoading} className="text-xs text-ink-muted hover:text-danger px-3 disabled:opacity-50">
                    {hwZurueckweisenLoading ? "..." : "Zurückweisen"}
                  </button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Sprint AL — Mieter-Info: HW hat Arbeit gemeldet, wird geprüft. */}
        {istMieter && ticket.status === "fertiggestellt_hw" && (
          <Card className="mb-6 border-status-auktion/30 bg-status-auktion/5">
            <div className="text-sm font-semibold text-ink">Dein Handwerker hat die Arbeit als abgeschlossen gemeldet</div>
            <p className="text-xs text-ink-muted mt-1">Dein Verwalter prüft den Abschluss — du wirst informiert, sobald alles final ist.</p>
          </Card>
        )}

        {/* Handwerker einladen (Verwalter, offen) */}
        {isVerwalter && ticket.status === "offen" && (
          <Card className="mb-6 bg-white border border-line">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-ink">Handwerker einladen</h3>
              <Button size="sm" onClick={() => router.push("/dashboard-verwalter/tickets/" + id + "/handwerker")}>Handwerker auswählen</Button>
            </div>
            {einladungen.length > 0 ? (
              <div className="space-y-2">
                {einladungen.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                    <div className="flex items-center gap-2">
                      <Avatar name={e.handwerker?.name || "?"} size="sm" />
                      <div>
                        <div className="text-sm font-medium text-ink">{e.handwerker?.name}</div>
                        <div className="text-xs text-ink-muted">{e.handwerker?.firma}</div>
                      </div>
                    </div>
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (
                      e.status === "angebot" ? "bg-accent/10 text-accent" :
                      e.status === "abgelehnt" ? "bg-danger/10 text-danger" :
                      "bg-warm/10 text-warm"
                    )}>
                      {e.status === "angebot" ? "Angebot erhalten" : e.status === "abgelehnt" ? "Abgelehnt" : "Eingeladen"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-muted">Noch keine Handwerker eingeladen.</p>
            )}
          </Card>
        )}

        {/* === ANGEBOTE — VERWALTER VIEW === */}
        {isVerwalter && sortiertAngebote.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ink">
                Eingegangene Angebote
                <span className="ml-2 text-sm font-normal text-ink-muted">({sortiertAngebote.length})</span>
              </h2>
              {avgPreis > 0 && (
                <span className="text-xs text-ink-muted bg-surface px-3 py-1 rounded-lg">
                  Ø {avgPreis.toLocaleString("de")} EUR
                </span>
              )}
            </div>

            <div className="space-y-4">
              {sortiertAngebote.map((a, idx) => {
                const rank = idx + 1
                const hw = a.handwerker
                const isTop = rank === 1 && sortiertAngebote.length > 1
                const isAngenommen = a.status === "angenommen"
                const isAbgelehnt = a.status === "abgelehnt"
                return (
                  <div key={a.id} className={`rounded-2xl border transition-all ${
                    isAngenommen ? "bg-accent/5 border-accent/30" :
                    isAbgelehnt ? "bg-surface border-line opacity-50" :
                    isTop ? "bg-gradient-to-r from-[#3D8B7A]/5 to-[#5B6ABF]/5 border-accent/25 shadow-lg shadow-[#3D8B7A]/5" :
                    "bg-white border-line hover:border-line"
                  }`}>
                    <div className="p-5">
                      {/* Top row: rank + HW info + score */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar name={hw?.name || "?"} size="md" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-ink">{hw?.name || "Handwerker"}</span>
                              <RankBadge rank={rank} />
                              {isAngenommen && <span className="text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-full font-medium">✓ Beauftragt</span>}
                            </div>
                            <div className="text-xs text-ink-muted">{hw?.firma || "Firma"}</div>
                            <div className="flex items-center gap-3 mt-1">
                              <StarRating rating={hw?.bewertung_avg || 0} />
                              {(hw?.auftraege_anzahl ?? 0) > 0 && (
                                <span className="text-[10px] text-ink-muted">{hw!.auftraege_anzahl} Aufträge</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ValueScoreRing score={a.valueScore} />
                      </div>

                      {/* Price + Details row */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-surface rounded-xl p-3">
                          <div className="text-[10px] text-ink-muted mb-1">Preis</div>
                          <div className="text-lg font-bold text-accent">{a.preis.toLocaleString("de")} EUR</div>
                        </div>
                        <div className="bg-surface rounded-xl p-3">
                          <div className="text-[10px] text-ink-muted mb-1">Frühester Termin</div>
                          <div className="text-sm font-medium text-ink">
                            {a.fruehester_termin ? new Date(a.fruehester_termin).toLocaleDateString("de", { day: "2-digit", month: "2-digit" }) : "Flexibel"}
                          </div>
                        </div>
                        <div className="bg-surface rounded-xl p-3">
                          <div className="text-[10px] text-ink-muted mb-1">Geschätzte Dauer</div>
                          <div className="text-sm font-medium text-ink">{a.geschaetzte_dauer ? a.geschaetzte_dauer + " Tage" : "—"}</div>
                        </div>
                      </div>

                      {/* Message */}
                      {a.nachricht && (
                        <div className="bg-surface rounded-lg p-3 mb-4 border-l-2 border-[#5B6ABF]/30">
                          <div className="text-xs text-ink-secondary italic">„{a.nachricht}“</div>
                        </div>
                      )}

                      {/* Compact Preis-Aufschlüsselung — was Verwalter wirklich zahlt */}
                      <div className="bg-surface rounded-xl p-3 mb-4 border border-line">
                        <PreisAufschluesselung
                          auftragswert={a.preis}
                          provisionRate={
                            currentUser?.early_adopter_bis &&
                            new Date(currentUser.early_adopter_bis).getTime() > Date.now()
                              ? 0
                              : Math.round(0.05 * ((ticket as { surge_faktor?: number }).surge_faktor ?? 1) * 10000) / 10000
                          }
                          earlyAdopterBis={currentUser?.early_adopter_bis ?? null}
                          compact
                        />
                      </div>

                      {/* Action */}
                      {a.status === "eingereicht" && isVerwalter && (
                        <div className="flex items-center gap-3">
                          {vergebenConfirm === a.id ? (
                            <>
                              <span className="text-xs text-ink-muted">Wirklich an {hw?.name} vergeben?</span>
                              <Button size="sm" onClick={() => vergeben(a.id)}>Ja, vergeben</Button>
                              <button onClick={() => setVergebenConfirm(null)} className="text-xs text-ink-muted hover:text-ink-secondary">Abbrechen</button>
                            </>
                          ) : (
                            <Button size="sm" onClick={() => setVergebenConfirm(a.id)}>
                              {isTop ? "✓ Auftrag vergeben" : "Auftrag vergeben"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty angebote state for Verwalter */}
        {isVerwalter && sortiertAngebote.length === 0 && ticket.status === "auktion" && (
          <Card className="mb-6 bg-white border border-line">
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-rolle-mieter/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-rolle-mieter">[~]</span>
              </div>
              <div className="text-sm text-ink-secondary font-medium mb-1">Warten auf Angebote</div>
              <div className="text-xs text-ink-muted">Handwerker können jetzt bieten — Angebote erscheinen hier automatisch.</div>
            </div>
          </Card>
        )}

        {/* === HANDWERKER BID FORM === */}
        {isHandwerker && !hatBereitsAngebot && ticket.status === "auktion" && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-[#3D8B7A]/8 to-[#5B6ABF]/8 border border-accent/20 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                  <span className="text-sm font-bold text-accent">#</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-ink">Auftrag annehmen</h2>
                  <div className="text-xs text-ink-muted">
                    {alleAngebote.length} andere{alleAngebote.length === 1 ? " Annahme" : " Annahmen"} bereits eingegangen
                  </div>
                </div>
              </div>

              {/* KI Preisempfehlung */}
              <div className="bg-rolle-mieter/10 border border-[#5B6ABF]/20 rounded-xl p-4 mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-rolle-mieter bg-rolle-mieter/20 px-2 py-0.5 rounded">AI</span>
                  <span className="text-xs font-medium text-rolle-mieter">KI-Preisempfehlung</span>
                </div>
                <div className="text-lg font-bold text-ink">EUR {kiPreisempfehlung(ticket.titel)}</div>
                <div className="text-[10px] text-ink-muted mt-1">Basierend auf vergleichbaren Aufträgen in deiner Region</div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <Input label="Dein Preis (EUR) *" type="number" placeholder="z.B. 450"
                  value={angebotForm.preis} onChange={e => setAngebotForm({ ...angebotForm, preis: e.target.value })} />
                <Input label="Frühester Termin" type="date"
                  value={angebotForm.termin} onChange={e => setAngebotForm({ ...angebotForm, termin: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Input label="Geschätzte Dauer (Tage)" type="number" placeholder="z.B. 2"
                  value={angebotForm.dauer} onChange={e => setAngebotForm({ ...angebotForm, dauer: e.target.value })} />
                <Input label="Nachricht (Optional)" type="text" placeholder="z.B. Material inklusive"
                  value={angebotForm.nachricht} onChange={e => setAngebotForm({ ...angebotForm, nachricht: e.target.value })} />
              </div>

              <Button onClick={submitAngebot} disabled={submittingBid || !angebotForm.preis} className="w-full">
                {submittingBid ? "Wird eingereicht..." : "Angebot einreichen →"}
              </Button>
            </div>
          </div>
        )}

        {/* Handwerker: eigenes Angebot anzeigen */}
        {isHandwerker && hatBereitsAngebot && (
          <Card className="mb-6 bg-accent/5 border border-accent/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">✓</div>
              <div className="flex-1">
                <div className="text-sm font-medium text-accent">Dein Angebot wurde eingereicht</div>
                {(() => {
                  const meinAngebot = alleAngebote.find(a => a.handwerker_id === currentUser?.id) as
                    (typeof alleAngebote[number] & {
                      smart_score?: number | null
                      entfernung_km?: number | null
                      fahrzeit_min?: number | null
                      ist_routen_bonus?: boolean | null
                    }) | undefined
                  if (!meinAngebot) return null
                  return (
                    <>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {meinAngebot.preis.toLocaleString("de")} EUR
                        {meinAngebot.status === "angenommen" && <span className="ml-2 text-accent font-medium">— Angenommen!</span>}
                        {meinAngebot.status === "abgelehnt" && <span className="ml-2 text-danger font-medium">— Leider nicht ausgewählt</span>}
                      </div>
                      {meinAngebot.smart_score != null && (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="bg-white rounded-lg p-2.5 border border-line">
                            <div className="text-[10px] text-ink-muted uppercase tracking-wide">Smart-Score</div>
                            <div className="text-lg font-bold text-accent tabular-nums">{meinAngebot.smart_score.toFixed(1)}</div>
                          </div>
                          {meinAngebot.entfernung_km != null && (
                            <div className="bg-white rounded-lg p-2.5 border border-line">
                              <div className="text-[10px] text-ink-muted uppercase tracking-wide">Distanz</div>
                              <div className="text-sm font-semibold text-ink tabular-nums">{meinAngebot.entfernung_km.toFixed(1)} km</div>
                            </div>
                          )}
                          {meinAngebot.fahrzeit_min != null && (
                            <div className="bg-white rounded-lg p-2.5 border border-line">
                              <div className="text-[10px] text-ink-muted uppercase tracking-wide">Fahrzeit</div>
                              <div className="text-sm font-semibold text-ink tabular-nums">{meinAngebot.fahrzeit_min} min</div>
                            </div>
                          )}
                          {meinAngebot.ist_routen_bonus && (
                            <div className="bg-warm/10 rounded-lg p-2.5 border border-warm/30">
                              <div className="text-[10px] text-warm uppercase tracking-wide font-bold">Routen-Bonus</div>
                              <div className="text-sm font-semibold text-warm">+10 %</div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          </Card>
        )}

        {/* === CHAT ===
            Audit-Befund: Overflow + zu wenig Kontrast (text-line und
            bg-surface auf demselben Hintergrund waren visuell unsichtbar).
            Plus: lange Wörter brachen aus den Bubbles aus (kein break-words). */}
        <Card className="bg-white border border-line">
          <h2 className="text-sm font-semibold text-ink mb-3">Nachrichten</h2>
          <div ref={chatRef} className="bg-surface rounded-xl p-3 sm:p-4 h-72 sm:h-80 overflow-y-auto overflow-x-hidden mb-3 flex flex-col gap-3">
            {nachrichten.length === 0 ? (
              <div className="text-xs text-ink-muted text-center py-8">Noch keine Nachrichten</div>
            ) : nachrichten.map(m => {
              const isMe = m.absender_id === currentUser?.id
              const zeit = new Date(m.created_at).toLocaleTimeString("de", { hour: "2-digit", minute: "2-digit" })
              const datum = new Date(m.created_at).toLocaleDateString("de", { day: "2-digit", month: "2-digit" })
              const rolle = (m.absender as { rolle?: string } | undefined)?.rolle
              return (
                <div key={m.id} className={"flex " + (isMe ? "justify-end" : "justify-start")}>
                  <div className={"max-w-[85%] sm:max-w-xs min-w-0 " + (isMe ? "" : "flex gap-2 items-end")}>
                    {!isMe && <div className="flex-shrink-0"><Avatar name={m.absender?.name || "?"} size="sm" /></div>}
                    <div className="min-w-0 flex-1">
                      <div className={"text-[10px] mb-0.5 flex items-center gap-1.5 flex-wrap " + (isMe ? "justify-end" : "")}>
                        <span className="font-medium text-ink-secondary truncate max-w-[120px]">{isMe ? "Du" : (m.absender?.name || "Unbekannt")}</span>
                        {rolle && <span className="text-[9px] text-ink-secondary bg-white border border-line px-1.5 py-0.5 rounded">{rolle}</span>}
                        <span className="text-ink-muted">{datum} {zeit}</span>
                      </div>
                      <div className={"text-sm px-3 py-2 rounded-xl leading-relaxed break-words whitespace-pre-wrap " + (
                        isMe ? "bg-accent text-white" : "bg-white border border-line text-ink"
                      )}>
                        {m.text}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Nachricht..." value={chatText} onChange={e => setChatText(e.target.value)}
              onKeyPress={e => e.key === "Enter" && sendChat()} />
            <Button onClick={sendChat} disabled={sending}>{sending ? "..." : "Senden"}</Button>
          </div>
        </Card>
      </div>
      </div>
    </div>
  )
}

function BewertungForm({ onSubmit }: { onSubmit: (sterne: number, kommentar: string) => Promise<void> }) {
  const [sterne, setSterne] = useState(0)
  const [hover, setHover] = useState(0)
  const [kommentar, setKommentar] = useState("")
  const [saving, setSaving] = useState(false)

  async function speichern() {
    if (sterne === 0) return
    setSaving(true)
    await onSubmit(sterne, kommentar)
    setSaving(false)
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-6 mb-6">
      <h3 className="text-base font-semibold text-ink mb-1">Wie zufrieden warst du?</h3>
      <p className="text-xs text-ink-muted mb-4">Deine Bewertung hilft anderen Mietern und beeinflusst das Ranking des Handwerkers.</p>

      <div className="flex items-center gap-1 mb-4" role="radiogroup" aria-label="Sterne-Bewertung">
        {[1, 2, 3, 4, 5].map(n => {
          const aktiv = n <= (hover || sterne)
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={sterne === n}
              aria-label={`${n} Stern${n === 1 ? "" : "e"}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setSterne(n)}
              className="text-3xl transition-transform hover:scale-110"
            >
              <span className={aktiv ? "text-warm" : "text-line"}>★</span>
            </button>
          )
        })}
        {sterne > 0 && (
          <span className="ml-3 text-sm text-ink-secondary font-medium">
            {sterne === 5 ? "Hervorragend" : sterne === 4 ? "Gut" : sterne === 3 ? "Okay" : sterne === 2 ? "Mittelmäßig" : "Schlecht"}
          </span>
        )}
      </div>

      <textarea
        value={kommentar}
        onChange={e => setKommentar(e.target.value)}
        placeholder="Kommentar (optional) — was war besonders gut, was hätte besser sein können?"
        rows={3}
        className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors resize-none"
      />

      <button
        onClick={speichern}
        disabled={sterne === 0 || saving}
        className="mt-3 text-sm font-bold bg-accent text-white px-5 py-2.5 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Speichert…" : "Bewertung absenden"}
      </button>
    </div>
  )
}
