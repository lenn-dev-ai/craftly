// Smart-Score-Engine: bewertet Handwerker-Angebote auf Basis von
// Preis, Nähe, Bewertung und einem Routen-Bonus. Gewichtung variiert
// nach Dringlichkeit.

export type Dringlichkeit = "notfall" | "zeitnah" | "planbar"

export type SichtbarkeitsStufe = "gold" | "silber" | "bronze"

export interface ScoreInput {
  /** Angebotspreis dieses Handwerkers */
  angebotPreis: number
  /** Durchschnittspreis aller Angebote für dieses Ticket (>0) */
  durchschnittPreis: number
  /** Entfernung zum Einsatzort in km */
  entfernungKm: number
  /** Maximaler Such-Radius in km (Skalierung der Nähe-Achse) */
  maxRadius: number
  /** Bewertung des Handwerkers (1.0 .. 5.0) */
  bewertung: number
  /** Hat der Handwerker am selben Tag bereits einen Job in der Nähe? */
  istRoutenBonus: boolean
  /** Notfall (sofort), zeitnah (24-48h), planbar (3-7 Tage) */
  dringlichkeit: Dringlichkeit
  /** Anzahl abgeschlossener Aufträge — nur für Tie-Break */
  erfahrung?: number
  /** Optional: Sichtbarkeits-Stufe aus Verfügbarkeits-Score. Default 'bronze' (× 1.00). */
  sichtbarkeitsStufe?: SichtbarkeitsStufe
}

export interface ScoreBreakdown {
  preisScore: number
  naeheScore: number
  bewertungScore: number
  routenBonus: number
  sichtbarkeitsBonus: number
  total: number
}

interface Gewicht {
  preis: number
  naehe: number
  bewertung: number
}

const GEWICHTE: Record<Dringlichkeit, Gewicht> = {
  // Notfall: Geschwindigkeit zählt, Preis ist sekundär.
  notfall: { preis: 0.0, naehe: 0.6, bewertung: 0.4 },
  // Zeitnah und Planbar: ausgewogene Mischung.
  zeitnah: { preis: 0.4, naehe: 0.35, bewertung: 0.25 },
  planbar: { preis: 0.4, naehe: 0.35, bewertung: 0.25 },
}

const ROUTEN_BONUS_MULTIPLIER = 1.1

const SICHTBARKEITS_MULTIPLIER: Record<SichtbarkeitsStufe, number> = {
  gold: 1.10,
  silber: 1.05,
  bronze: 1.00,
}

function clamp(value: number, min: number, max: number): number {
  if (!isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function preisScoreVon(angebot: number, durchschnitt: number): number {
  if (durchschnitt <= 0 || !isFinite(durchschnitt)) return 50
  // Verhältnis 0.5 → 100 Punkte (50% unter Schnitt = bestmöglich)
  // Verhältnis 1.0 → 50 Punkte (genau Schnitt)
  // Verhältnis 1.5 → 0 Punkte (50% über Schnitt = schlechtest)
  const ratio = angebot / durchschnitt
  return clamp((1 - (ratio - 0.5)) * 100, 0, 100)
}

function naeheScoreVon(entfernung: number, radius: number): number {
  if (radius <= 0 || !isFinite(radius)) return 0
  return clamp((1 - entfernung / radius) * 100, 0, 100)
}

function bewertungScoreVon(bewertung: number): number {
  return clamp((bewertung / 5) * 100, 0, 100)
}

export function berechneSmartScore(input: ScoreInput): number {
  return berechneSmartScoreBreakdown(input).total
}

export function berechneSmartScoreBreakdown(input: ScoreInput): ScoreBreakdown {
  const g = GEWICHTE[input.dringlichkeit]

  const preisScore = preisScoreVon(input.angebotPreis, input.durchschnittPreis)
  const naeheScore = naeheScoreVon(input.entfernungKm, input.maxRadius)
  const bewertungScore = bewertungScoreVon(input.bewertung)

  const grundScore =
    preisScore * g.preis + naeheScore * g.naehe + bewertungScore * g.bewertung

  const mitRoutenBonus = input.istRoutenBonus
    ? grundScore * ROUTEN_BONUS_MULTIPLIER
    : grundScore

  const stufe = input.sichtbarkeitsStufe ?? "bronze"
  const sichtbarkeitsMult = SICHTBARKEITS_MULTIPLIER[stufe]
  const mitBonus = mitRoutenBonus * sichtbarkeitsMult

  return {
    preisScore: Math.round(preisScore * 100) / 100,
    naeheScore: Math.round(naeheScore * 100) / 100,
    bewertungScore: Math.round(bewertungScore * 100) / 100,
    routenBonus: input.istRoutenBonus
      ? Math.round((mitRoutenBonus - grundScore) * 100) / 100
      : 0,
    sichtbarkeitsBonus: sichtbarkeitsMult > 1.0
      ? Math.round((mitBonus - mitRoutenBonus) * 100) / 100
      : 0,
    total: Math.round(clamp(mitBonus, 0, 100) * 100) / 100,
  }
}

export function getGewichte(d: Dringlichkeit): Readonly<Gewicht> {
  return GEWICHTE[d]
}
