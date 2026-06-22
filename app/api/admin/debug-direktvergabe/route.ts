import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { bildeKandidatenliste, naechsterVerfuegbarerKandidat, type DirektvergabeTicketKontext } from "@/lib/auction/direktvergabe"
import { konfigFuer } from "@/lib/auction/auction-manager"
import { haversineKm } from "@/lib/distance"
import type { Dringlichkeit } from "@/lib/auction/smart-score"

// TEMPORÄR — Diagnose der Direktvergabe-Anomalie. Nach Klärung löschen.
// GET /api/admin/debug-direktvergabe?gewerk=heizung_sanitaer&lat=52.54&lng=13.37&dringlichkeit=notfall
export async function GET(request: NextRequest) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: prof } = await supabase.from("profiles").select("rolle").eq("id", user.id).single<{ rolle: string }>()
  if (prof?.rolle !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sp = request.nextUrl.searchParams
  const gewerk = sp.get("gewerk") ?? "heizung_sanitaer"
  const lat = parseFloat(sp.get("lat") ?? "52.5400")
  const lng = parseFloat(sp.get("lng") ?? "13.3700")
  const dringlichkeit = (sp.get("dringlichkeit") ?? "notfall") as Dringlichkeit

  const ticket: DirektvergabeTicketKontext = {
    id: "debug", titel: "debug", beschreibung: null, gewerk,
    dringlichkeit, einsatzort_lat: lat, einsatzort_lng: lng, einsatzort_adresse: null,
  }
  const config = konfigFuer(dringlichkeit)

  // (1) Manuelle Replik der Kandidaten-Query (mit Fehler-Sichtbarkeit!)
  const admin = createServiceRoleClient()
  let q = admin.from("profiles")
    .select("id, gewerk, startort_lat, startort_lng, lat, lng, radius_km")
    .eq("rolle", "handwerker")
  if (gewerk && gewerk !== "allgemein") q = q.ilike("gewerk", `%${gewerk}%`)
  const { data: rohHw, error: queryError } = await q

  const replik = (rohHw ?? []).map(hw => {
    const hwLat = hw.startort_lat ?? hw.lat
    const hwLng = hw.startort_lng ?? hw.lng
    const dist = hwLat != null && hwLng != null ? haversineKm(hwLat, hwLng, lat, lng) : null
    const radius = hw.radius_km ?? config.radiusKm
    return { id: hw.id, gewerk: hw.gewerk, dist, radius, imRadius: dist != null && dist <= radius }
  })

  // (2) Echte Engine-Funktionen
  let kandidaten: unknown = null
  let kandidatenError: string | null = null
  try {
    kandidaten = await bildeKandidatenliste(ticket)
  } catch (e) {
    kandidatenError = e instanceof Error ? e.message : String(e)
  }

  let index: number | null | string = null
  try {
    const liste = Array.isArray(kandidaten) ? kandidaten : []
    index = liste.length > 0 ? await naechsterVerfuegbarerKandidat(liste as never, 0, dringlichkeit) : "n/a (leer)"
  } catch (e) {
    index = `error: ${e instanceof Error ? e.message : String(e)}`
  }

  return NextResponse.json({
    input: { gewerk, lat, lng, dringlichkeit, configRadius: config.radiusKm },
    queryError: queryError?.message ?? null,
    rohHwCount: rohHw?.length ?? 0,
    replik,
    bildeKandidatenliste: { result: kandidaten, error: kandidatenError },
    naechsterVerfuegbarerKandidat: index,
  }, { headers: { "Cache-Control": "no-store" } })
}
