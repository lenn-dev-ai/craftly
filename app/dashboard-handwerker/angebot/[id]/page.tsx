"use client"

import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import type { Ticket, Angebot } from "@/types"

const PRIO_COLORS: Record<string, string> = {
  normal: "bg-green-500/20 text-green-400",
  hoch: "bg-yellow-500/20 text-yellow-400",
  dringend: "bg-[#C4574B]/20 text-[#C4574B]",
}

export default function AngebotAbgeben() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [preis, setPreis] = useState("")
  const [fruehesterTermin, setFruehesterTermin] = useState("")
  const [nachricht, setNachricht] = useState("")

  // Existing bids count for market info
  const [bidCount, setBidCount] = useState(0)

  const loadTicket = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("tickets")
      .select(`
        *,
        objekte:objekt_id(*),
        angebote(id)
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
    setLoading(false)
  }, [id, supabase])

  useEffect(() => {
    if (id) loadTicket()
  }, [id, loadTicket])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError("")

    const preisNum = parseFloat(preis)
    if (isNaN(preisNum) || preisNum <= 0) {
      setError("Bitte einen gültigen Preis eingeben")
      setSubmitting(false)
      return
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError("Nicht eingeloggt")
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase
      .from("angebote")
      .insert({
        ticket_id: id,
        handwerker_id: user.id,
        preis: preisNum,
        fruehester_termin: fruehesterTermin || null,
        nachricht: nachricht || null,
        status: "eingereicht",
      })

    if (insertError) {
      setError("Fehler beim Senden: " + insertError.message)
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
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#3D8B7A]" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center px-4">
        <div className="bg-white border border-[#3D8B7A]/30 rounded-2xl p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-[#3D8B7A]/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#3D8B7A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#2D2A26] mb-2">Angebot gesendet!</h2>
          <p className="text-gray-400 text-sm">Dein Angebot über {preis}€ wurde erfolgreich eingereicht. Du wirst weitergeleitet...</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <p className="text-gray-400">Ticket nicht gefunden</p>
      </div>
    )
  }

  const tl = timeLeft()

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2A26]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#FAF8F5]/95 backdrop-blur border-b border-[#EDE8E1] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-[#2D2A26] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold">Angebot abgeben</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Ticket Info Card */}
        <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-base font-semibold text-[#2D2A26] leading-tight pr-3">{ticket.titel}</h2>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${PRIO_COLORS[ticket.prioritaet] || PRIO_COLORS.normal}`}>
              {ticket.prioritaet}
            </span>
          </div>
          {ticket.beschreibung && (
            <p className="text-sm text-gray-400 mb-3 line-clamp-3">{ticket.beschreibung}</p>
          )}
          <div className="flex flex-wrap gap-2 text-[11px]">
            {ticket.gewerk && (
              <span className="bg-[#FAF8F5] text-gray-300 px-2 py-0.5 rounded-full">{ticket.gewerk}</span>
            )}
            {ticket.objekte && (
              <span className="bg-[#FAF8F5] text-gray-300 px-2 py-0.5 rounded-full">{(ticket.objekte as any).name}</span>
            )}
            {tl && (
              <span className="bg-[#5B6ABF]/10 text-[#5B6ABF] px-2 py-0.5 rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {tl}
              </span>
            )}
          </div>
        </div>

        {/* Market Info */}
        <div className="bg-white border border-[#EDE8E1] rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#3D8B7A]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[#3D8B7A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[#2D2A26]">{bidCount} Angebot{bidCount !== 1 ? "e" : ""} bisher</p>
            <p className="text-xs text-gray-500">Gib ein wettbewerbsfähiges Angebot ab</p>
          </div>
        </div>

        {/* Bid Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Price */}
          <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
            <label className="block text-sm font-medium text-[#2D2A26] mb-3">
              Dein Preis <span className="text-[#3D8B7A]">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={preis}
                onChange={(e) => setPreis(e.target.value)}
                placeholder="z.B. 350"
                className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-3 pr-12 text-[#2D2A26] text-lg font-semibold placeholder:text-gray-600 focus:outline-none focus:border-[#3D8B7A]/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">Netto-Preis inkl. Anfahrt & Material</p>
          </div>

          {/* Date */}
          <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
            <label className="block text-sm font-medium text-[#2D2A26] mb-3">
              Frühester Termin
            </label>
            <input
              type="date"
              min={today}
              value={fruehesterTermin}
              onChange={(e) => setFruehesterTermin(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-3 text-[#2D2A26] placeholder:text-gray-600 focus:outline-none focus:border-[#3D8B7A]/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all [color-scheme:dark]"
            />
            <p className="text-[11px] text-gray-500 mt-2">Wann könntest du frühestens anfangen?</p>
          </div>

          {/* Message */}
          <div className="bg-white border border-[#EDE8E1] rounded-2xl p-5">
            <label className="block text-sm font-medium text-[#2D2A26] mb-3">
              Nachricht an Verwalter
            </label>
            <textarea
              rows={3}
              value={nachricht}
              onChange={(e) => setNachricht(e.target.value)}
              placeholder="Beschreibe kurz deine Vorgehensweise, Erfahrung oder gib weitere Details..."
              className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-3 text-[#2D2A26] text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#3D8B7A]/50 focus:ring-1 focus:ring-[#00D4AA]/30 transition-all resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-[#C4574B]/10 border border-[#C4574B]/20 rounded-xl px-4 py-3 text-[#C4574B] text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !preis}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-[#3D8B7A] to-[#5B6ABF] text-black hover:shadow-lg hover:shadow-[#00D4AA]/20 active:scale-[0.98]"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                  <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Wird gesendet...
              </span>
            ) : (
              `Angebot über ${preis ? preis + "€" : "..."} absenden`
            )}
          </button>
        </form>

        {/* Footer note */}
        <p className="text-center text-[11px] text-gray-600 pb-6">
          Mit dem Absenden stimmst du den Nutzungsbedingungen zu.
          <br />Dein Angebot ist verbindlich bis zum Ablauf der Auktion.
        </p>
      </div>
    </div>
  )
}
