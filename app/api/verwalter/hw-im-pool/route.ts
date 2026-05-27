import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { haversineKm } from "@/lib/distance"

// Sprint AK Phase 4 (27.05.2026): Pool-Read für Verwalter-Marktplatz.
//
// Liest alle profiles WHERE rolle='handwerker' die im Radius zum
// Verwalter-Startort (oder Ticket-Einsatzort) liegen UND mind. ein
// Gewerk-Match haben. Markiert pro Eintrag, ob er bereits in
// stamm_handwerker des aktuellen Verwalters ist.
//
// Hintergrund: Sprint AK Stufe 2 MVP hat im Marktplatz nur Stamm-HW
// gezeigt — Lennart-Feedback 444f646e (27.05.) kritisierte das zu Recht
// als Verlust der Auctions-Logik. Diese Route schließt das Loch:
// Frontend kombiniert Stamm-HW (oben, prio) + Radius-Pool (unten, alle).
//
// Input (POST):
//   {
//     max_distance_km?: number     (default 50)
//     gewerk?: string              (optional Filter; sonst alle Gewerke)
//     ticket_id?: string           (optional; nutzt Ticket-Einsatzort
//                                   statt Verwalter-Startort als Center)
//   }
//
// Output:
//   {
//     center: { lat, lng, quelle: 'verwalter' | 'ticket' }
//     handwerker: [{
//       id, name, firma, gewerk, plz_bereich,
//       bewertung_avg, auftraege_anzahl,
//       entfernung_km, ist_stamm
//     }]
//   }

interface Body {
  max_distance_km?: unknown
  gewerk?: unknown
  ticket_id?: unknown
}

const DEFAULT_MAX_KM = 50
const MAX_RESULTS = 100

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle, startort_lat, startort_lng, lat, lng")
    .eq("id", user.id)
    .maybeSingle<{
      rolle: string
      startort_lat: number | null
      startort_lng: number | null
      lat: number | null
      lng: number | null
    }>()
  if (!profile || (profile.rolle !== "verwalter" && profile.rolle !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Body = {}
  try { body = await request.json() } catch { /* leerer Body ok */ }

  const maxKm = typeof body.max_distance_km === "number" && body.max_distance_km > 0 && body.max_distance_km <= 500
    ? body.max_distance_km
    : DEFAULT_MAX_KM
  const filterGewerk = typeof body.gewerk === "string" && body.gewerk.length > 0 ? body.gewerk.toLowerCase() : null
  const ticketId = typeof body.ticket_id === "string" ? body.ticket_id : null

  // Center bestimmen: Ticket-Einsatzort hat Vorrang, sonst Verwalter-Startort.
  let centerLat: number | null = null
  let centerLng: number | null = null
  let centerQuelle: "verwalter" | "ticket" = "verwalter"
  if (ticketId) {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, einsatzort_lat, einsatzort_lng, verwalter_id")
      .eq("id", ticketId)
      .maybeSingle<{ id: string; einsatzort_lat: number | null; einsatzort_lng: number | null; verwalter_id: string | null }>()
    if (ticket && ticket.einsatzort_lat != null && ticket.einsatzort_lng != null) {
      centerLat = ticket.einsatzort_lat
      centerLng = ticket.einsatzort_lng
      centerQuelle = "ticket"
    }
  }
  if (centerLat == null || centerLng == null) {
    centerLat = profile.startort_lat ?? profile.lat
    centerLng = profile.startort_lng ?? profile.lng
  }
  if (centerLat == null || centerLng == null) {
    return NextResponse.json({
      error: "Kein Standort für Radius-Suche bekannt — bitte Verwalter-Profil mit Startort vervollständigen oder Ticket mit Einsatzort wählen.",
      handwerker: [],
    }, { status: 422 })
  }

  // Alle HW abfragen — Filter nach Gewerk auf DB-Ebene falls gesetzt,
  // sonst Filter im Code (für handwerker_gewerke[]-Array-Match).
  let query = supabase
    .from("profiles")
    .select("id, name, firma, gewerk, handwerker_gewerke, plz_bereich, bewertung_avg, auftraege_anzahl, startort_lat, startort_lng, lat, lng")
    .eq("rolle", "handwerker")
  if (filterGewerk && filterGewerk !== "allgemein") {
    // OR auf single-gewerk-Feld + array-Feld; PostgREST-Syntax mit .or
    query = query.or(`gewerk.ilike.%${filterGewerk}%,handwerker_gewerke.cs.{${filterGewerk}}`)
  }
  const { data: hwRows } = await query.returns<Array<{
    id: string
    name: string | null
    firma: string | null
    gewerk: string | null
    handwerker_gewerke: string[] | null
    plz_bereich: string | null
    bewertung_avg: number | null
    auftraege_anzahl: number | null
    startort_lat: number | null
    startort_lng: number | null
    lat: number | null
    lng: number | null
  }>>()

  // Stamm-HW-IDs des aktuellen Verwalters für ist_stamm-Markierung
  const { data: stammRows } = await supabase
    .from("stamm_handwerker")
    .select("handwerker_id")
    .eq("verwalter_id", user.id)
  const stammIds = new Set((stammRows ?? []).map((r: { handwerker_id: string }) => r.handwerker_id))

  // Radius-Filter + Entfernungs-Sortierung
  const handwerker = (hwRows ?? [])
    .map(hw => {
      const lat = hw.startort_lat ?? hw.lat
      const lng = hw.startort_lng ?? hw.lng
      if (lat == null || lng == null) return null
      const km = haversineKm(centerLat as number, centerLng as number, lat, lng)
      if (km > maxKm) return null
      return {
        id: hw.id,
        name: hw.name,
        firma: hw.firma,
        gewerk: hw.gewerk,
        handwerker_gewerke: hw.handwerker_gewerke,
        plz_bereich: hw.plz_bereich,
        bewertung_avg: hw.bewertung_avg,
        auftraege_anzahl: hw.auftraege_anzahl,
        entfernung_km: Math.round(km * 10) / 10,
        ist_stamm: stammIds.has(hw.id),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.entfernung_km - b.entfernung_km)
    .slice(0, MAX_RESULTS)

  return NextResponse.json({
    center: { lat: centerLat, lng: centerLng, quelle: centerQuelle },
    handwerker,
  })
}
