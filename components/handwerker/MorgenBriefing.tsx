"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { type TagesBriefingResponse } from "@/app/api/hw/tages-briefing/route"

// Sprint AV — KI Tages-Briefing Widget für das HW-Dashboard.
//
// Zeigt:
//   - KI-generierte Zusammenfassung des Tages (Claude Haiku)
//   - Heutige Termine in optimaler Reihenfolge mit Fahrzeiten
//   - Gesamtfahrzeit + Gesamtdistanz
//   - CTA zur Karte für Detailansicht
//
// Wird automatisch für den aktuellen Tag geladen.
// Wenn keine Termine heute: kompakte "Freier Tag"-Anzeige.

function Skeleton() {
  return (
    <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-[#3D8B7A]/5 to-white p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-accent/10" />
        <div className="h-4 w-32 bg-accent/10 rounded" />
      </div>
      <div className="h-3 w-full bg-accent/8 rounded mb-2" />
      <div className="h-3 w-4/5 bg-accent/8 rounded mb-4" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-accent/6 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function FahrzeitPill({ min }: { min: number }) {
  if (min <= 0) return null
  return (
    <span className="text-[10px] text-ink-muted flex items-center gap-0.5 ml-2 shrink-0">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="opacity-50">
        <path d="M6 1v4.5l3 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      {min} min
    </span>
  )
}

export default function MorgenBriefing() {
  const [data, setData] = useState<TagesBriefingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const heute = new Date().toISOString().slice(0, 10)
    fetch(`/api/hw/tages-briefing?datum=${heute}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: TagesBriefingResponse) => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) return <Skeleton />
  if (error || !data) return null  // Stille Fehler — Widget hat keinen Pflicht-Content

  const { stops, gesamtFahrzeitMin, gesamtDistanzKm, aktiveAuftraege, kiText } = data

  return (
    <div className="rounded-2xl border border-accent/25 bg-gradient-to-br from-[#3D8B7A]/6 to-white overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-accent/10">
        <div className="flex items-center gap-2.5">
          {/* KI-Stern — visueller Marker dass das KI-generiert ist */}
          <div className="w-8 h-8 rounded-xl bg-[#3D8B7A]/12 flex items-center justify-center shrink-0">
            <span className="text-sm">✦</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-ink leading-none">Dein heutiger Tag</div>
            <div className="text-[10px] text-ink-muted mt-0.5">KI-Assistent · {new Date().toLocaleDateString("de", { weekday: "long", day: "numeric", month: "long" })}</div>
          </div>
        </div>
        {stops.length > 0 && (
          <Link
            href="/dashboard-handwerker/karte"
            className="text-[11px] font-medium text-accent hover:text-[#2D6B5A] transition-colors shrink-0"
          >
            Karte →
          </Link>
        )}
      </div>

      {/* KI Text */}
      {kiText && (
        <div className="px-5 pt-4 pb-2">
          <p className="text-sm text-ink-secondary leading-relaxed">{kiText}</p>
        </div>
      )}

      {stops.length === 0 ? (
        /* Freier Tag */
        <div className="px-5 py-4 flex items-center gap-3 text-sm text-ink-muted">
          <span className="text-xl">🌤️</span>
          <span>Heute keine geplanten Termine.
            {aktiveAuftraege > 0 && ` Du hast ${aktiveAuftraege} offene ${aktiveAuftraege === 1 ? "Auftrag" : "Aufträge"} — Zeit zum Planen?`}
          </span>
        </div>
      ) : (
        /* Stops-Liste */
        <div className="px-5 pb-4 pt-2">
          <div className="space-y-1.5 mt-1">
            {stops.map((stop, idx) => (
              <div
                key={stop.id}
                className="flex items-center gap-2.5 bg-white/70 rounded-xl px-3 py-2.5 border border-white hover:border-accent/20 transition-colors"
              >
                {/* Schritt-Nummer */}
                <div className="w-5 h-5 rounded-full bg-[#3D8B7A]/12 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-accent">{idx + 1}</span>
                </div>

                {/* Inhalt */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-ink truncate">{stop.titel}</div>
                  {stop.adresse && (
                    <div className="text-[10px] text-ink-muted truncate mt-0.5">📍 {stop.adresse}</div>
                  )}
                </div>

                {/* Uhrzeit + Fahrzeit */}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[11px] font-medium text-ink-secondary tabular-nums">
                    {stop.von.slice(0, 5)}
                  </span>
                  <FahrzeitPill min={stop.fahrzeitVorher} />
                </div>
              </div>
            ))}
          </div>

          {/* Footer-Stats */}
          {(gesamtFahrzeitMin > 0 || gesamtDistanzKm > 0) && (
            <div className="mt-3 pt-3 border-t border-accent/10 flex items-center gap-4 text-[11px] text-ink-muted">
              {gesamtFahrzeitMin > 0 && (
                <span>
                  <span className="font-semibold text-ink">{gesamtFahrzeitMin} min</span> Fahrtzeit gesamt
                </span>
              )}
              {gesamtDistanzKm > 0 && (
                <span>
                  <span className="font-semibold text-ink">{gesamtDistanzKm.toFixed(1)} km</span> Route
                </span>
              )}
              {aktiveAuftraege > 0 && (
                <span className="ml-auto">
                  {aktiveAuftraege} Auftr. offen
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
