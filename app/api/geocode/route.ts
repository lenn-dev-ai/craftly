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

  // Audit-Fix (2026-06-15, Sprint AU2): Rate-Limit analog zur KI-Quota —
  // schützt vor Bot-Missbrauch, der die App-IP bei Nominatim sperren könnte.
  const { data: quotaResult, error: quotaErr } = await supabase
    .rpc("try_consume_geocode_quota", { _max_per_day: 60 })
    .single<{ allowed: boolean; remaining: number; reset_at: string }>()
  if (quotaErr) {
    return NextResponse.json(
      { error: "Quota-Check fehlgeschlagen: " + quotaErr.message },
      { status: 500 },
    )
  }
  if (!quotaResult?.allowed) {
    return NextResponse.json(
      {
        error: "Tageslimit für Adresssuche erreicht (60/Tag). Bitte versuch's morgen wieder.",
        resetAt: quotaResult?.reset_at,
      },
      { status: 429 },
    )
  }

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
