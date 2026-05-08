// Auktions-Manager: drei Stufen — Notfall (Sofort-Match), Zeitnah
// (48h-Auktion), Planbar (7-Tage-Auktion). Surge-Faktor wirkt auf die
// Provisions-Rate (siehe lib/pricing/commission.ts).

import type { Dringlichkeit } from "./smart-score"

export interface AuktionsConfig {
  dringlichkeit: Dringlichkeit
  /** Suchradius in km (wird bei leerer Treffermenge stufenweise erweitert) */
  radiusKm: number
  /** 0 = sofort-Match (Notfall), >0 = Auktions-Laufzeit */
  auktionsDauerStunden: number
  /** Multiplikator auf die Basis-Provision (5%). 1.20 = +20% = 6% */
  surgeFaktor: number
  /** Antwortziel als Hinweis im UI */
  antwortzielText: string
}

export const AUKTIONS_CONFIGS: Record<Dringlichkeit, AuktionsConfig> = {
  notfall: {
    dringlichkeit: "notfall",
    radiusKm: 10,
    auktionsDauerStunden: 0,
    surgeFaktor: 1.2,
    antwortzielText: "1–4 Stunden",
  },
  zeitnah: {
    dringlichkeit: "zeitnah",
    radiusKm: 15,
    auktionsDauerStunden: 48,
    surgeFaktor: 1.1,
    antwortzielText: "2–7 Tage",
  },
  planbar: {
    dringlichkeit: "planbar",
    radiusKm: 25,
    auktionsDauerStunden: 168, // 7 Tage
    surgeFaktor: 1.0,
    antwortzielText: "Flexibel terminierbar",
  },
}

/**
 * Stufenweise Radius-Erweiterung wenn keine Handwerker im ersten Radius
 * gefunden werden. Reihenfolge: Konfig → +5 → +15 → 50km Cap.
 */
export function radiusEskalation(start: number): number[] {
  const cap = 50
  const kandidaten = [start, Math.min(cap, start + 5), Math.min(cap, start + 15), cap]
  const stufen: number[] = []
  for (const k of kandidaten) {
    if (!stufen.includes(k)) stufen.push(k)
  }
  return stufen.sort((a, b) => a - b)
}

export function berechneAuktionsEnde(
  start: Date,
  dauerStunden: number,
): Date | null {
  if (dauerStunden <= 0) return null
  return new Date(start.getTime() + dauerStunden * 3600 * 1000)
}

export function konfigFuer(d: Dringlichkeit): AuktionsConfig {
  return AUKTIONS_CONFIGS[d]
}

export interface SurgeBerechnung {
  basisRate: number
  effektiveRate: number
  finalRate: number
  isEarlyAdopter: boolean
}

export function effektiveProvisionsRate(
  basisRate: number,
  surge: number,
  isEarlyAdopter: boolean,
): SurgeBerechnung {
  const effektiv = Math.round(basisRate * surge * 10000) / 10000
  return {
    basisRate,
    effektiveRate: effektiv,
    finalRate: isEarlyAdopter ? 0 : effektiv,
    isEarlyAdopter,
  }
}
