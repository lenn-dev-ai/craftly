import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { geocodeAddress, GeocodingError } from "@/lib/geocoding"

// POST /api/geocode
// Body: { adresse: string }
// Auth: any logged-in user (Schutz vor Bot-Missbrauch der Nominatim-API).
export async function POST(request: NextRequest) {
  let body: { adresse?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const adresse = body.adresse?.trim()
  if (!adresse) {
    return NextResponse.json({ error: "adresse erforderlich" }, { status: 400 })
  }

  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const result = await geocodeAddress(adresse)
    if (!result) {
      return NextResponse.json(
        { error: "Adresse konnte nicht gefunden werden", adresse },
        { status: 404 },
      )
    }
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof GeocodingError ? err.message : "Unbekannter Fehler"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
