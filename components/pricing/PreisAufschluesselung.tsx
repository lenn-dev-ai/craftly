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
          <span className="text-[#6B665E]">Handwerkerkosten</span>
          <span className="text-[#3D8B7A] font-medium tabular-nums">{formatEUR(auftragswert)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#8C857B]">
            Reparo-Gebühr {istEarlyAdopter ? "(0 %)" : `(${formatProzent(provisionRate)})`}
          </span>
          <span className="text-[#8C857B] tabular-nums">{formatEUR(provisionBetrag)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-[#EDE8E1] mt-1.5 pt-1.5">
          <span className="font-semibold text-[#2D2A26]">Gesamt</span>
          <span className="font-bold text-[#2D2A26] tabular-nums">{formatEUR(gesamt)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-[#EDE8E1] rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wide">
          Kosten-Aufschlüsselung
        </h3>
        {istEarlyAdopter && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#854F0B] bg-[#FAF1DE] border border-[#C4956A]/30 px-2 py-0.5 rounded">
            Early Adopter
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Handwerkerkosten — grün */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-[#2D2A26]">Handwerkerkosten</div>
            <div className="text-[11px] text-[#8C857B] mt-0.5">Geht 1:1 an den Handwerker</div>
          </div>
          <div className="text-sm font-semibold text-[#3D8B7A] tabular-nums">
            {formatEUR(auftragswert)}
          </div>
        </div>

        {/* Reparo-Gebühr — dezent */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-[#6B665E]">
              Reparo-Gebühr
              <span className="text-[#8C857B] font-normal ml-1.5">
                ({istEarlyAdopter ? "0 %" : formatProzent(provisionRate)})
              </span>
            </div>
            <div className="text-[11px] text-[#8C857B] mt-0.5">
              {istEarlyAdopter
                ? "Onboarding-Phase aktiv"
                : "Plattform, Support, Vermittlung"}
            </div>
          </div>
          <div
            className={`text-sm tabular-nums ${
              istEarlyAdopter ? "text-[#3D8B7A] font-semibold" : "text-[#6B665E]"
            }`}
          >
            {formatEUR(provisionBetrag)}
          </div>
        </div>

        {/* Gesamt — bold */}
        <div className="flex items-start justify-between gap-3 border-t border-[#EDE8E1] pt-3">
          <div className="text-base font-semibold text-[#2D2A26]">Gesamt</div>
          <div className="text-lg font-bold text-[#2D2A26] tabular-nums">
            {formatEUR(gesamt)}
          </div>
        </div>
      </div>

      {/* Early-Adopter-Hinweis */}
      {istEarlyAdopter && earlyAdopterBis && (
        <div className="mt-4 p-3 rounded-xl bg-[#FAF1DE] border border-[#C4956A]/30 text-xs text-[#854F0B]">
          <strong>Ihre Onboarding-Phase:</strong> 0 % Gebühr bis {formatDatum(earlyAdopterBis)}.
          Danach werden 5 % auf den Auftragswert berechnet — der Handwerker bekommt weiterhin
          den vollen Stundensatz.
        </div>
      )}
    </div>
  )
}
