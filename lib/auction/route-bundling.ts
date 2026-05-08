// Routen-Bündelung: TSP via Nearest-Neighbor und Routen-Bonus-Erkennung
// für den Smart-Score. Nutzt Distanz-Helpers aus lib/distance.

import { haversineKm, schaetzeFahrzeitMin } from "@/lib/distance"

export interface RoutenPunkt {
  ticketId: string
  latitude: number
  longitude: number
  adresse?: string
}

export interface OptimierteRoute {
  reihenfolge: RoutenPunkt[]
  gesamtDistanzKm: number
  gesamtFahrzeitMin: number
}

/** Routen-Bonus greift wenn ein bereits geplanter Job am selben Tag
 *  innerhalb dieses Radius liegt. */
export const ROUTEN_BONUS_RADIUS_KM = 5

/** Nearest-Neighbor-TSP. Für ≤10 Punkte ausreichend, > 10 sollte später
 *  durch 2-opt oder OSRM-Trip-API ersetzt werden. */
export function optimiereRoute(
  startLat: number,
  startLng: number,
  punkte: RoutenPunkt[],
): OptimierteRoute {
  if (punkte.length === 0) {
    return { reihenfolge: [], gesamtDistanzKm: 0, gesamtFahrzeitMin: 0 }
  }

  const besucht = new Set<string>()
  const reihenfolge: RoutenPunkt[] = []
  let aktLat = startLat
  let aktLng = startLng
  let gesamtDistanz = 0

  while (besucht.size < punkte.length) {
    let naechster: RoutenPunkt | null = null
    let minDistanz = Infinity

    for (const p of punkte) {
      if (besucht.has(p.ticketId)) continue
      const d = haversineKm(aktLat, aktLng, p.latitude, p.longitude)
      if (d < minDistanz) {
        minDistanz = d
        naechster = p
      }
    }

    if (!naechster) break // sollte nie passieren
    besucht.add(naechster.ticketId)
    reihenfolge.push(naechster)
    gesamtDistanz += minDistanz
    aktLat = naechster.latitude
    aktLng = naechster.longitude
  }

  return {
    reihenfolge,
    gesamtDistanzKm: Math.round(gesamtDistanz * 100) / 100,
    gesamtFahrzeitMin: schaetzeFahrzeitMin(gesamtDistanz),
  }
}

/** Prüft ob ein Handwerker am `datum` schon einen Job in der Nähe des
 *  neuen Einsatzortes hat → Routen-Bonus für seinen Smart-Score. */
export interface BestehenderJob {
  latitude: number
  longitude: number
}

export function hatRoutenBonus(
  neuerEinsatzortLat: number,
  neuerEinsatzortLng: number,
  bestehendeJobs: BestehenderJob[],
  radiusKm: number = ROUTEN_BONUS_RADIUS_KM,
): boolean {
  return bestehendeJobs.some(j => {
    const d = haversineKm(neuerEinsatzortLat, neuerEinsatzortLng, j.latitude, j.longitude)
    return d <= radiusKm
  })
}
