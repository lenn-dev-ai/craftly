"use client"
// Sprint AX — Handwerker-Agent: Panel zeigt eingehende Direktvergaben
// mit Agent-Empfehlung. Kern-UX: HW sieht sofort "✓ Annehmen" oder "✗ Ablehnen"
// + Begründung und kann mit einem Klick reagieren.

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { scoreEinladung, type EinladungInput, type HwPreferences, type AgentScore } from "@/lib/agent/score-einladung"
import { useToast } from "@/components/Toast"

interface OffeneEinladung {
  id: string
  ticket_id: string
  erstellt_am: string | null
  tickets: {
    titel: string
    gewerk: string | null
    einsatzort_adresse: string | null
    einsatzort_lat: number | null
    einsatzort_lng: number | null
    kosten_final: number | null
    dringlichkeit: string | null
  } | null
}

interface EinladungMitScore {
  einladung: OffeneEinladung
  score: AgentScore
}

interface Props {
  hwId: string
  hwPreferences: HwPreferences
  onChanged?: () => void
}

export default function AgentPanel({ hwId, hwPreferences, onChanged }: Props) {
  const { show } = useToast()
  const [items, setItems] = useState<EinladungMitScore[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("einladungen")
      .select(`
        id, ticket_id, erstellt_am,
        tickets ( titel, gewerk, einsatzort_adresse, einsatzort_lat, einsatzort_lng, kosten_final, dringlichkeit )
      `)
      .eq("handwerker_id", hwId)
      .eq("status", "offen")
      .order("erstellt_am", { ascending: false })
      .limit(10)
      .returns<OffeneEinladung[]>()

    if (error || !data) { setLoading(false); return }

    const scored: EinladungMitScore[] = data.map(einladung => {
      const t = einladung.tickets
      const input: EinladungInput = {
        id: einladung.id,
        ticket_id: einladung.ticket_id,
        titel: t?.titel ?? "Auftrag",
        gewerk: t?.gewerk ?? null,
        einsatzort_adresse: t?.einsatzort_adresse ?? null,
        einsatzort_lat: t?.einsatzort_lat ?? null,
        einsatzort_lng: t?.einsatzort_lng ?? null,
        kosten_final: t?.kosten_final ?? null,
        dringlichkeit: t?.dringlichkeit ?? null,
      }
      return { einladung, score: scoreEinladung(input, hwPreferences) }
    })

    // Empfohlene zuerst, dann nach Score
    scored.sort((a, b) => b.score.score - a.score.score)
    setItems(scored)
    setLoading(false)
  }, [hwId, hwPreferences])

  useEffect(() => { void load() }, [load])

  async function handleAction(einladungId: string, action: "annehmen" | "ablehnen") {
    setActing(einladungId)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/einladungen/${einladungId}/${action}`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        show(action === "annehmen" ? "Auftrag angenommen ✓" : "Abgelehnt", action === "annehmen" ? "success" : "info")
        setItems(prev => prev.filter(i => i.einladung.id !== einladungId))
        onChanged?.()
      } else {
        const j = await res.json().catch(() => ({})) as { error?: string }
        show(j.error ?? "Fehler beim " + action, "error")
      }
    } finally {
      setActing(null)
    }
  }

  if (loading) return null
  if (items.length === 0) return null

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">
            Agent · {items.length} neue Anfrage{items.length !== 1 ? "n" : ""}
          </h2>
          <p className="text-xs text-ink-muted">Meine Empfehlungen — du entscheidest</p>
        </div>
      </div>

      {/* Karten */}
      <div className="space-y-3">
        {items.map(({ einladung, score }) => {
          const t = einladung.tickets
          const isActing = acting === einladung.id
          const empfehlungColor =
            score.empfehlung === "annehmen"
              ? "border-l-[3px] border-l-emerald-400"
              : score.empfehlung === "ablehnen"
              ? "border-l-[3px] border-l-rose-400"
              : "border-l-[3px] border-l-amber-400"

          return (
            <div
              key={einladung.id}
              className={`bg-white rounded-2xl border border-line p-4 ${empfehlungColor}`}
            >
              {/* Titel + Dringlichkeit */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-medium text-sm text-ink leading-snug">
                  {t?.titel ?? "Auftrag"}
                </div>
                {t?.dringlichkeit === "notfall" && (
                  <span className="text-[10px] font-semibold text-danger bg-danger/10 px-2 py-0.5 rounded-full flex-shrink-0">
                    NOTFALL
                  </span>
                )}
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted mb-3">
                {t?.einsatzort_adresse && (
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    {t.einsatzort_adresse.split(",")[0]}
                  </span>
                )}
                {score.distanzKm != null && (
                  <span className="text-ink-muted">{score.distanzKm} km</span>
                )}
                {t?.kosten_final != null && (
                  <span className="font-medium text-ink">{t.kosten_final} €</span>
                )}
              </div>

              {/* Agent-Empfehlung */}
              <div className={`rounded-xl px-3 py-2 mb-3 text-xs flex items-start gap-2 ${
                score.empfehlung === "annehmen"
                  ? "bg-emerald-50 text-emerald-800"
                  : score.empfehlung === "ablehnen"
                  ? "bg-rose-50 text-rose-800"
                  : "bg-amber-50 text-amber-800"
              }`}>
                <span className="font-bold flex-shrink-0">
                  {score.empfehlung === "annehmen" ? "✓ Empfohlen" : score.empfehlung === "ablehnen" ? "✗ Eher ablehnen" : "? Prüfen"}
                </span>
                <span>{score.gruende.slice(0, 2).join(" · ")}</span>
              </div>

              {/* Aktions-Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(einladung.id, "annehmen")}
                  disabled={isActing}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40"
                >
                  {isActing ? "…" : "Annehmen"}
                </button>
                <button
                  onClick={() => handleAction(einladung.id, "ablehnen")}
                  disabled={isActing}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-surface text-ink-muted border border-line hover:border-line/60 transition-colors disabled:opacity-40"
                >
                  Ablehnen
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
