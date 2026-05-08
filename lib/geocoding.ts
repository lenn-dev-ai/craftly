// Nominatim-Geocoding (kostenlos, DSGVO-konform).
// Rate-Limit: 1 req/s, User-Agent erforderlich. Für höheres Volumen
// später eigener Photon/Nominatim-Container oder Pelias.

export interface GeoResult {
  latitude: number
  longitude: number
  display_name: string
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const USER_AGENT = "Reparo-App/1.0 (kontakt@reparo.app)"

export class GeocodingError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "GeocodingError"
  }
}

export async function geocodeAddress(adresse: string): Promise<GeoResult | null> {
  const trimmed = adresse?.trim()
  if (!trimmed) return null

  // ", Deutschland" anhängen wenn nicht bereits ein Land genannt ist —
  // verhindert false-positives bei "Hauptstr. 1" → US-Treffer.
  const query = /\b(deutschland|germany|österreich|schweiz)\b/i.test(trimmed)
    ? trimmed
    : `${trimmed}, Deutschland`

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      throw new GeocodingError(`Nominatim ${res.status}`)
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
    if (!Array.isArray(data) || data.length === 0) return null

    const lat = parseFloat(data[0].lat)
    const lon = parseFloat(data[0].lon)
    if (!isFinite(lat) || !isFinite(lon)) return null

    return {
      latitude: lat,
      longitude: lon,
      display_name: data[0].display_name,
    }
  } catch (err) {
    if (err instanceof GeocodingError) throw err
    throw new GeocodingError("Geocoding fehlgeschlagen", err)
  }
}
