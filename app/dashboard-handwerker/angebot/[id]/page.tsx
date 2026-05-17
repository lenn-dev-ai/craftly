"use client"

import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useId, useState } from "react"
import { createClient } from "@/lib/supabase"
import { formatGewerk, type Ticket, type Angebot } from "@/types"

const PRIO_COLORS: Record<string, string> = {
  normal: "bg-green-500/20 text-green-400",
  hoch: "bg-yellow-500/20 text-yellow-400",
  dringend: "bg-danger/20 text-danger",
}

export default function AngebotAbgeben() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const preisId = useId()
  const terminId = useId()
  const nachrichtId = useId()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  // F11: Vollkalkulation — kein freier Festpreis mehr. Der HW bekommt den
  // vom System berechneten empfohlener_preis aus seiner einladungen-Zeile
  // angezeigt und nimmt an oder lehnt ab. Bis die echte Reject-API gebaut
  // ist, ist "Annehmen" der einzige Aktions-Pfad.
  const [systemPreis, setSystemPreis] = useState<number | null>(null)
  const [fruehesterTermin, setFruehesterTermin] = useState("")
  const [nachricht, setNachricht] = useState("")

  // Existing bids count for market info
  const [bidCount, setBidCount] = useState(0)

  const loadTicket = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data, error } = await supabase
      .from("tickets")
      .select(`
        *,
        objekte:objekt_id(*),
        angebote(id),
        einladungen(empfohlener_preis, status, handwerker_id)
      `)
      .eq("id", id)
      .single()

    if (error || !data) {
      setError("Ticket nicht gefunden")
      setLoading(false)
      return
    }
    setTicket(data as Ticket)
    setBidCount(data.angebote?.length || 0)

    // Eigene Einladung suchen, um den System-Vorschlag-Preis zu zeigen.
    type EinladungMini = { handwerker_id: string; empfohlener_preis: number | null; status: string | null }
    const meine = ((data.einladungen as EinladungMini[] | null) || []).find(e => e.handwerker_id === user.id)
    setSystemPreis(meine?.empfohlener_preis ?? null)

    setLoading(false)
  }, [id, supabase, router])

  useEffect(() => {
    if (id) loadTicket()
  }, [id, loadTicket])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError("")

    // F11: Preis kommt aus dem System-Vorschlag, nicht aus User-Input.
    if (systemPreis == null || systemPreis <= 0) {
      setError("Für diesen Auftrag liegt noch kein System-Preis vor — bitte beim Verwalter melden.")
      setSubmitting(false)
      return
    }

    // API-Route nutzen: schreibt Bid, markiert Einladung, triggert
    // Smart-Score-Recompute. Direct-Insert würde den Score überspringen.
    const res = await fetch("/api/auction/bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticket_id: id,
        preis: systemPreis,
        fruehester_termin: fruehesterTermin || null,
        nachricht: nachricht || null,
      }),
    })
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: "Unbekannter Fehler" }))
      setError("Fehler beim Senden: " + msg)
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setSubmitting(false)
    setTimeout(() => router.push("/dashboard-handwerker"), 2000)
  }

  // Calculate minimum date (today)
  const today = new Date().toISOString().split("T")[0]

  // Countdown for auction
  function timeLeft() {
    if (!ticket?.auktion_ende) return null
    const end = new Date(ticket.auktion_ende).getTime()
    const now = Date.now()
    const diff = end - now
    if (diff <= 0) return "Abgelaufen"
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h}h ${m}m verbleibend`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#3D8B7A]" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="bg-white border border-accent/30 rounded-2xl p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">Auftrag angenommen!</h2>
          <p className="text-gray-400 text-sm">
            Du hast den Auftrag über {systemPreis ?? "—"} € angenommen. Du wirst weitergeleitet…
          </p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-gray-400">Ticket nicht gefunden</p>
      </div>
    )
  }

  const tl = timeLeft()

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-line px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-ink transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold">Auftrag annehmen</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Ticket Info Card */}
        <div className="bg-white border border-line rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-base font-semibold text-ink leading-tight pr-3">{ticket.titel}</h2>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${PRIO_COLORS[ticket.prioritaet] || PRIO_COLORS.normal}`}>
              {ticket.prioritaet}
            </span>
          </div>
          {ticket.beschreibung && (
            <p className="text-sm text-gray-400 mb-3 line-clamp-3">{ticket.beschreibung}</p>
          )}
          <div className="flex flex-wrap gap-2 text-[11px]">
            {ticket.gewerk && (
              <span className="bg-surface text-gray-300 px-2 py-0.5 rounded-full">{formatGewerk(ticket.gewerk)}</span>
            )}
            {ticket.objekte && (
              <span className="bg-surface text-gray-300 px-2 py-0.5 rounded-full">{(ticket.objekte as any).name}</span>
            )}
            {tl && (
              <span className="bg-rolle-mieter/10 text-rolle-mieter px-2 py-0.5 rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {tl}
              </span>
            )}
          </div>
        </div>

        {/* Market Info */}
        <div className="bg-white border border-line rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-ink">{bidCount} Angebot{bidCount !== 1 ? "e" : ""} bisher</p>
            <p className="text-xs text-gray-500">Gib ein wettbewerbsfähiges Angebot ab</p>
          </div>
        </div>

        {/* Bid Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* F11: System-Preis (read-only). Reparo arbeitet im Vollkalkulations-
              Modus — kein freies Angebot mehr, der HW akzeptiert oder lehnt ab. */}
          <div className="bg-white border border-line rounded-2xl p-5">
            <label htmlFor={preisId} className="block text-sm font-medium text-ink mb-1">
              Festpreis (vom System bestimmt)
            </label>
            <p className="text-[11px] text-ink-muted mb-3">
              Reparo kalkuliert den Festpreis aus Gewerk, Aufwand, Anfahrt und Dringlichkeit.
              Inkl. Material, kein Stundensatz.
            </p>
            <div className="flex items-center gap-3">
              <div
                id={preisId}
                className="flex-1 bg-surface border border-line rounded-xl px-4 py-3 text-ink text-2xl font-bold tabular-nums"
                aria-label="System-Festpreis in Euro"
              >
                {systemPreis != null ? systemPreis.toLocaleString("de") : "—"} €
              </div>
            </div>
            {systemPreis == null && (
              <p className="text-[11px] text-danger mt-2">
                Für diesen Auftrag liegt noch kein System-Preis vor — bitte beim Verwalter melden.
              </p>
            )}
            <p className="text-[11px] text-ink-muted mt-2">
              Reparo zieht 5 % Plattformgebühr ab. Du bekommst den Rest 1:1 ausgezahlt.
            </p>
          </div>

          {/* Date */}
          <div className="bg-white border border-line rounded-2xl p-5">
            <label htmlFor={terminId} className="block text-sm font-medium text-ink mb-3">
              Frühester Termin
            </label>
            <input
              id={terminId}
              type="date"
              min={today}
              value={fruehesterTermin}
              onChange={(e) => setFruehesterTermin(e.target.value)}
              className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-ink placeholder:text-gray-600 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all [color-scheme:dark]"
            />
            <p className="text-[11px] text-gray-500 mt-2">Wann könntest du frühestens anfangen?</p>
          </div>

          {/* Message */}
          <div className="bg-white border border-line rounded-2xl p-5">
            <label htmlFor={nachrichtId} className="block text-sm font-medium text-ink mb-3">
              Nachricht an Verwalter
            </label>
            <textarea
              id={nachrichtId}
              rows={3}
              value={nachricht}
              onChange={(e) => setNachricht(e.target.value)}
              placeholder="Beschreibe kurz deine Vorgehensweise, Erfahrung oder gib weitere Details..."
              className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-ink text-sm placeholder:text-gray-600 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl px-4 py-3 text-danger text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || systemPreis == null}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-[#3D8B7A] to-[#5B6ABF] text-black hover:shadow-lg hover:shadow-[#00D4AA]/20 active:scale-[0.98]"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                  <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Wird gesendet…
              </span>
            ) : (
              systemPreis != null
                ? `Auftrag über ${systemPreis.toLocaleString("de")} € annehmen`
                : "Kein System-Preis verfügbar"
            )}
          </button>
        </form>

        {/* Footer note */}
        <p className="text-center text-[11px] text-gray-600 pb-6">
          Mit der Annahme stimmst du den Nutzungsbedingungen zu.
          <br />Die Annahme ist verbindlich bis zum Ablauf der Auktion.
        </p>
      </div>
    </div>
  )
}
