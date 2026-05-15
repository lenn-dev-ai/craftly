"use client"
import {
  calculateCommission,
  formatEUR,
  formatProzent,
  formatDatum,
} from "@/lib/pricing/commission"

interface Props {
  auftragswert: number
  provisionRate: number
  earlyAdopterBis?: string | null
  compact?: boolean   // kompakte Variante für Listen / Karten
  className?: string
}

export default function PreisAufschluesselung({
  auftragswert,
  provisionRate,
  earlyAdopterBis,
  compact = false,
  className = "",
}: Props) {
  const { provisionBetrag, gesamt } = calculateCommission(auftragswert, provisionRate)
  const istEarlyAdopter = provisionRate === 0

  if (compact) {
    return (
      <div className={`text-xs ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-ink-secondary">Handwerkerkosten</span>
          <span className="text-accent font-medium tabular-nums">{formatEUR(auftragswert)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">
            Reparo-Gebühr {istEarlyAdopter ? "(0 %)" : `(${formatProzent(provisionRate)})`}
          </span>
          <span className="text-ink-muted tabular-nums">{formatEUR(provisionBetrag)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-line mt-1.5 pt-1.5">
          <span className="font-semibold text-ink">Gesamt</span>
          <span className="font-bold text-ink tabular-nums">{formatEUR(gesamt)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-line rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink uppercase tracking-wide">
          Kosten-Aufschlüsselung
        </h3>
        {istEarlyAdopter && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-warm-dark bg-warm-light border border-warm/30 px-2 py-0.5 rounded">
            Early Adopter
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Handwerkerkosten — grün */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-ink">Handwerkerkosten</div>
            <div className="text-[11px] text-ink-muted mt-0.5">Geht 1:1 an den Handwerker</div>
          </div>
          <div className="text-sm font-semibold text-accent tabular-nums">
            {formatEUR(auftragswert)}
          </div>
        </div>

        {/* Reparo-Gebühr — dezent */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-ink-secondary">
              Reparo-Gebühr
              <span className="text-ink-muted font-normal ml-1.5">
                ({istEarlyAdopter ? "0 %" : formatProzent(provisionRate)})
              </span>
            </div>
            <div className="text-[11px] text-ink-muted mt-0.5">
              {istEarlyAdopter
                ? "Onboarding-Phase aktiv"
                : "Plattform, Support, Vermittlung"}
            </div>
          </div>
          <div
            className={`text-sm tabular-nums ${
              istEarlyAdopter ? "text-accent font-semibold" : "text-ink-secondary"
            }`}
          >
            {formatEUR(provisionBetrag)}
          </div>
        </div>

        {/* Gesamt — bold */}
        <div className="flex items-start justify-between gap-3 border-t border-line pt-3">
          <div className="text-base font-semibold text-ink">Gesamt</div>
          <div className="text-lg font-bold text-ink tabular-nums">
            {formatEUR(gesamt)}
          </div>
        </div>
      </div>

      {/* Steuer-Hinweis — Audit Punkt 8 */}
      <div className="mt-3 text-[11px] text-ink-muted">
        Alle Beträge netto, zzgl. ges. MwSt. Die Rechnungslegung erfolgt direkt
        zwischen Handwerker und Auftraggeber.
      </div>

      {/* Early-Adopter-Hinweis */}
      {istEarlyAdopter && earlyAdopterBis && (
        <div className="mt-4 p-3 rounded-xl bg-warm-light border border-warm/30 text-xs text-warm-dark">
          <strong>Ihre Onboarding-Phase:</strong> 0 % Gebühr bis {formatDatum(earlyAdopterBis)}.
          Danach werden 5 % auf den Auftragswert berechnet — der Handwerker bekommt weiterhin
          den vollen Stundensatz.
        </div>
      )}
    </div>
  )
}
