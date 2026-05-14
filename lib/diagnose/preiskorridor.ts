// Preiskorridor-Berechnung für Projekt-Vergabe nach Diagnose.
//
// Logik:
//  1) Historische Vergleichspreise: erledigte Projekt-Tickets im gleichen
//     Gewerk mit ähnlichem Aufwand (±30 % Stunden).
//  2) Wenn ≥ 5 Vergleichspreise: Korridor = Median ± KORRIDOR_PROZENT.
//  3) Sonst Fallback: Diagnose-Handwerker-Angebot ± KORRIDOR_FALLBACK_PROZENT.
//
// Beide Prozentwerte sind in einer Settings-Tabelle/Env überschreibbar
// (Phase 3). Für jetzt: Hard-Default 15 %.

import type { SupabaseClient } from "@supabase/supabase-js"

const KORRIDOR_PROZENT = 0.15            // ± 15 % um Median (historisch)
const KORRIDOR_FALLBACK_PROZENT = 0.15   // ± 15 % um Angebot (Fallback)
const MIN_VERGLEICHE = 5
const AUFWAND_TOLERANZ = 0.30            // ± 30 % Stunden gilt als "ähnlich"

type AnyClient = SupabaseClient

export interface PreisKorridor {
  min: number
  max: number
  basis: "historisch" | "fallback"
  vergleichsanzahl: number
}

interface ErledigtZeile {
  projekt_angebot: number | null
  kosten_final: number | null
  befund_aufwand_stunden: number | null
}

function median(werte: number[]): number {
  if (werte.length === 0) return 0
  const sorted = [...werte].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export async function berechnePreisKorridor(
  supabase: AnyClient,
  params: {
    gewerk: string | null
    aufwandStunden: number | null
    angebotDiagnoseHw: number
  },
): Promise<PreisKorridor> {
  const { gewerk, aufwandStunden, angebotDiagnoseHw } = params

  // Versuche historische Vergleichspreise zu holen
  if (gewerk && aufwandStunden && aufwandStunden > 0) {
    const min = aufwandStunden * (1 - AUFWAND_TOLERANZ)
    const max = aufwandStunden * (1 + AUFWAND_TOLERANZ)
    const { data } = await supabase
      .from("tickets")
      .select("projekt_angebot, kosten_final, befund_aufwand_stunden")
      .eq("ticket_typ", "projekt")
      .eq("status", "erledigt")
      .eq("gewerk", gewerk)
      .gte("befund_aufwand_stunden", min)
      .lte("befund_aufwand_stunden", max)
      .limit(50)
      .returns<ErledigtZeile[]>()

    const preise = (data ?? [])
      .map(z => z.kosten_final ?? z.projekt_angebot ?? 0)
      .filter(p => p > 0)

    if (preise.length >= MIN_VERGLEICHE) {
      const m = median(preise)
      return {
        min: Math.round(m * (1 - KORRIDOR_PROZENT) * 100) / 100,
        max: Math.round(m * (1 + KORRIDOR_PROZENT) * 100) / 100,
        basis: "historisch",
        vergleichsanzahl: preise.length,
      }
    }
  }

  // Fallback: ± 15 % um das Angebot des Diagnose-Handwerkers
  return {
    min: Math.round(angebotDiagnoseHw * (1 - KORRIDOR_FALLBACK_PROZENT) * 100) / 100,
    max: Math.round(angebotDiagnoseHw * (1 + KORRIDOR_FALLBACK_PROZENT) * 100) / 100,
    basis: "fallback",
    vergleichsanzahl: 0,
  }
}

/** Prüft ob ein Angebot innerhalb des Korridors liegt. */
export function imKorridor(angebot: number, korridor: PreisKorridor): boolean {
  return angebot >= korridor.min && angebot <= korridor.max
}
