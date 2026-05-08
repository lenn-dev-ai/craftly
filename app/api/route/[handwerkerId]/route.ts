import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { optimiereRoute, type RoutenPunkt } from "@/lib/auction/route-bundling"

// GET /api/route/[handwerkerId]?datum=YYYY-MM-DD
// Liefert die optimierte Tagesroute (Nearest-Neighbor) für einen
// Handwerker, basierend auf seinen termine-Einträgen für das Datum.
// Auth: der Handwerker selbst oder ein Admin.
export async function GET(
  request: NextRequest,
  { params }: { params: { handwerkerId: string } },
) {
  const handwerkerId = params.handwerkerId
  const datum = request.nextUrl.searchParams.get("datum") ??
    new Date().toISOString().slice(0, 10)
  if (!handwerkerId) {
    return NextResponse.json({ error: "handwerkerId erforderlich" }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return NextResponse.json({ error: "datum muss YYYY-MM-DD sein" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle, startort_lat, startort_lng, lat, lng")
    .eq("id", user.id)
    .single()
  if (!profile) return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 404 })
  if (user.id !== handwerkerId && profile.rolle !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: hwProfile } = await supabase
    .from("profiles")
    .select("startort_lat, startort_lng, lat, lng")
    .eq("id", handwerkerId)
    .single()

  const startLat = hwProfile?.startort_lat ?? hwProfile?.lat
  const startLng = hwProfile?.startort_lng ?? hwProfile?.lng
  if (startLat == null || startLng == null) {
    return NextResponse.json(
      { error: "Handwerker hat keinen Startort gesetzt" },
      { status: 422 },
    )
  }

  const { data: termine } = await supabase
    .from("termine")
    .select("ticket_id, einsatzort_lat, einsatzort_lng, einsatzort_adresse, von")
    .eq("handwerker_id", handwerkerId)
    .eq("datum", datum)
    .order("von")
    .returns<Array<{
      ticket_id: string | null
      einsatzort_lat: number | null
      einsatzort_lng: number | null
      einsatzort_adresse: string | null
      von: string
    }>>()

  const punkte: RoutenPunkt[] = (termine ?? [])
    .filter(t => t.ticket_id && t.einsatzort_lat != null && t.einsatzort_lng != null)
    .map(t => ({
      ticketId: t.ticket_id as string,
      latitude: t.einsatzort_lat as number,
      longitude: t.einsatzort_lng as number,
      adresse: t.einsatzort_adresse ?? undefined,
    }))

  const route = optimiereRoute(startLat, startLng, punkte)

  // Optional: Persistieren in routen_planung — beim regulären Tagesabruf
  // ist das ein einfaches Caching, daher upsert auf (handwerker_id,datum).
  if (route.reihenfolge.length > 0) {
    await supabase.from("routen_planung").upsert(
      {
        handwerker_id: handwerkerId,
        datum,
        ticket_ids: punkte.map(p => p.ticketId),
        optimierte_reihenfolge: route.reihenfolge.map(r => r.ticketId),
        gesamt_fahrzeit_min: route.gesamtFahrzeitMin,
        gesamt_distanz_km: route.gesamtDistanzKm,
      },
      { onConflict: "handwerker_id,datum" },
    )
  }

  return NextResponse.json({
    handwerkerId,
    datum,
    startLat,
    startLng,
    ...route,
  })
}
