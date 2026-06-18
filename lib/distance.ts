const ERDRADIUS_KM = 6371

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return ERDRADIUS_KM * c
}

export function formatiereDistanz(km: number): string {
  if (!isFinite(km) || km < 0) return "—"
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`
  return `${Math.round(km)} km`
}

export function schaetzeFahrzeitMin(km: number, durchschnittKmh = 40): number {
  if (!isFinite(km) || km <= 0) return 0
  return Math.round((km / durchschnittKmh) * 60)
}

export function formatiereFahrzeit(minuten: number): string {
  if (!isFinite(minuten) || minuten <= 0) return "—"
  if (minuten < 60) return `${minuten} min`
  const std = Math.floor(minuten / 60)
  const min = minuten % 60
  return min === 0 ? `${std} h` : `${std} h ${min} min`
}

// Sprint BC — Mapbox Directions API (echte Fahrzeiten statt Luftlinie×Schätzung)
// Nutzt NEXT_PUBLIC_MAPBOX_TOKEN (bereits für Karten-Darstellung gesetzt).
// Fallback auf Haversine wenn Token fehlt oder API nicht erreichbar.
// Wird serverseitig aufgerufen (tages-briefing, ki-hw-empfehlung).
export async function fetchMapboxRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<{ distanzKm: number; fahrzeitMin: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN
  if (!token) return null

  try {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=false&steps=false&access_token=${token}`
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const data = await res.json() as {
      routes?: Array<{
        legs: Array<{ distance: number; duration: number }>
      }>
      message?: string
    }
    if (data.message) {
      // API-Fehler (z.B. ungültiger Token)
      console.warn("[fetchMapboxRoute] API-Fehler:", data.message)
      return null
    }
    const leg = data.routes?.[0]?.legs?.[0]
    if (!leg) return null
    return {
      distanzKm: Math.round((leg.distance / 1000) * 10) / 10,
      fahrzeitMin: Math.round(leg.duration / 60),
    }
  } catch {
    return null
  }
}

export type DistanzKategorie = "nah" | "mittel" | "weit" | "ausserhalb"

export function distanzKategorie(km: number, radiusKm?: number): DistanzKategorie {
  if (radiusKm && km > radiusKm) return "ausserhalb"
  if (km <= 5) return "nah"
  if (km <= 15) return "mittel"
  return "weit"
}
