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

export type DistanzKategorie = "nah" | "mittel" | "weit" | "ausserhalb"

export function distanzKategorie(km: number, radiusKm?: number): DistanzKategorie {
  if (radiusKm && km > radiusKm) return "ausserhalb"
  if (km <= 5) return "nah"
  if (km <= 15) return "mittel"
  return "weit"
}
