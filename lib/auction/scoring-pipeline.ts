// Re-Scoring-Pipeline: Wenn ein Angebot eingeht, müssen alle Angebote
// des Tickets neu bewertet werden, weil der Smart-Score relativ ist
// (Preis-Komponente vs. Durchschnitt aller Bids).

import type { SupabaseClient } from "@supabase/supabase-js"
import { berechneSmartScore, type Dringlichkeit } from "./smart-score"
import { haversineKm, schaetzeFahrzeitMin } from "@/lib/distance"
import { hatRoutenBonus, type BestehenderJob } from "./route-bundling"
import { konfigFuer } from "./auction-manager"

interface AngebotZeile {
  id: string
  handwerker_id: string
  preis: number
  fruehester_termin: string | null
}

interface HandwerkerZeile {
  id: string
  bewertung_avg: number | null
  startort_lat: number | null
  startort_lng: number | null
  lat: number | null
  lng: number | null
  radius_km: number | null
  sichtbarkeit_stufe: "gold" | "silber" | "bronze" | null
}

interface TicketZeile {
  id: string
  einsatzort_lat: number | null
  einsatzort_lng: number | null
  dringlichkeit: Dringlichkeit | null
}

/**
 * Re-scored alle Angebote eines Tickets und persistiert
 * smart_score, entfernung_km, fahrzeit_min, ist_routen_bonus.
 * Idempotent — kann bei jedem Bid neu aufgerufen werden.
 */
// SupabaseClient ohne Generics — das Repo nutzt keine generierten DB-Typen,
// daher reicht der untypisierte Default-Client.
type AnyClient = SupabaseClient

export async function reScoreTicket(
  supabase: AnyClient,
  ticketId: string,
): Promise<{ updated: number; skipped: string }> {
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, einsatzort_lat, einsatzort_lng, dringlichkeit")
    .eq("id", ticketId)
    .single<TicketZeile>()

  if (!ticket) return { updated: 0, skipped: "ticket-not-found" }
  if (ticket.einsatzort_lat == null || ticket.einsatzort_lng == null) {
    return { updated: 0, skipped: "no-geo" }
  }

  const dringlichkeit = ticket.dringlichkeit ?? "planbar"
  const config = konfigFuer(dringlichkeit)

  const { data: angebote } = await supabase
    .from("angebote")
    .select("id, handwerker_id, preis, fruehester_termin")
    .eq("ticket_id", ticketId)
    .returns<AngebotZeile[]>()

  if (!angebote || angebote.length === 0) return { updated: 0, skipped: "no-bids" }

  const hwIds = angebote.map(a => a.handwerker_id)
  const { data: handwerker } = await supabase
    .from("profiles")
    .select("id, bewertung_avg, startort_lat, startort_lng, lat, lng, radius_km, sichtbarkeit_stufe")
    .in("id", hwIds)
    .returns<HandwerkerZeile[]>()

  const hwById = new Map<string, HandwerkerZeile>(
    (handwerker ?? []).map(h => [h.id, h]),
  )

  // Routen-Bonus-Daten: bestehende Stops pro Handwerker pro Datum.
  // Quellen:
  //   1) termine — feste Auftrags-Termine (mit einsatzort_lat/lng)
  //   2) routen_planung — gebündelte Tagespläne (ticket_ids → tickets join)
  // Beide werden zusammengeführt; Duplikate sind unkritisch (gleicher Bonus).
  const termineMap = new Map<string, BestehenderJob[]>()
  const bidsMitDatum = angebote.filter(a => a.fruehester_termin)
  const datums = Array.from(new Set(bidsMitDatum.map(a => a.fruehester_termin!)))
  if (datums.length > 0) {
    // Quelle 1: termine
    const { data: termine } = await supabase
      .from("termine")
      .select("handwerker_id, datum, einsatzort_lat, einsatzort_lng")
      .in("handwerker_id", hwIds)
      .in("datum", datums)
      .returns<Array<{
        handwerker_id: string
        datum: string
        einsatzort_lat: number | null
        einsatzort_lng: number | null
      }>>()

    for (const t of termine ?? []) {
      if (t.einsatzort_lat == null || t.einsatzort_lng == null) continue
      const key = `${t.handwerker_id}|${t.datum}`
      const arr = termineMap.get(key) ?? []
      arr.push({ latitude: t.einsatzort_lat, longitude: t.einsatzort_lng })
      termineMap.set(key, arr)
    }

    // Quelle 2: routen_planung (geplante Bündel — kann Stops enthalten,
    // bevor sie als termine firm sind)
    const { data: planeintraege } = await supabase
      .from("routen_planung")
      .select("handwerker_id, datum, ticket_ids")
      .in("handwerker_id", hwIds)
      .in("datum", datums)
      .returns<Array<{
        handwerker_id: string
        datum: string
        ticket_ids: string[] | null
      }>>()

    const alleTicketIds = Array.from(
      new Set((planeintraege ?? []).flatMap(p => p.ticket_ids ?? [])),
    )
    if (alleTicketIds.length > 0) {
      const { data: planTickets } = await supabase
        .from("tickets")
        .select("id, einsatzort_lat, einsatzort_lng")
        .in("id", alleTicketIds)
        .returns<Array<{
          id: string
          einsatzort_lat: number | null
          einsatzort_lng: number | null
        }>>()
      const ticketGeoById = new Map(
        (planTickets ?? []).map(t => [t.id, t]),
      )
      for (const p of planeintraege ?? []) {
        const key = `${p.handwerker_id}|${p.datum}`
        const arr = termineMap.get(key) ?? []
        for (const tid of p.ticket_ids ?? []) {
          const geo = ticketGeoById.get(tid)
          if (!geo || geo.einsatzort_lat == null || geo.einsatzort_lng == null) continue
          arr.push({ latitude: geo.einsatzort_lat, longitude: geo.einsatzort_lng })
        }
        if (arr.length > 0) termineMap.set(key, arr)
      }
    }
  }

  const durchschnitt =
    angebote.reduce((s, a) => s + a.preis, 0) / angebote.length

  let updated = 0
  for (const a of angebote) {
    const hw = hwById.get(a.handwerker_id)
    if (!hw) continue

    const hwLat = hw.startort_lat ?? hw.lat
    const hwLng = hw.startort_lng ?? hw.lng
    if (hwLat == null || hwLng == null) continue

    const entfernung = haversineKm(
      hwLat,
      hwLng,
      ticket.einsatzort_lat,
      ticket.einsatzort_lng,
    )
    const fahrzeit = schaetzeFahrzeitMin(entfernung)

    const istRoutenBonus = a.fruehester_termin
      ? hatRoutenBonus(
          ticket.einsatzort_lat,
          ticket.einsatzort_lng,
          termineMap.get(`${a.handwerker_id}|${a.fruehester_termin}`) ?? [],
        )
      : false

    const radius = hw.radius_km ?? config.radiusKm

    const score = berechneSmartScore({
      angebotPreis: a.preis,
      durchschnittPreis: durchschnitt,
      entfernungKm: entfernung,
      maxRadius: radius,
      bewertung: hw.bewertung_avg ?? 3.0,
      istRoutenBonus,
      dringlichkeit,
      sichtbarkeitsStufe: hw.sichtbarkeit_stufe ?? "bronze",
    })

    await supabase
      .from("angebote")
      .update({
        smart_score: score,
        entfernung_km: Math.round(entfernung * 100) / 100,
        fahrzeit_min: fahrzeit,
        ist_routen_bonus: istRoutenBonus,
      })
      .eq("id", a.id)
    updated++
  }

  return { updated, skipped: "" }
}
