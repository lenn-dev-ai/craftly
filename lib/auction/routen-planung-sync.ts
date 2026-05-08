// Routen-Planung-Sync: pflegt routen_planung pro (handwerker, datum).
// Wird nach Auftragsvergabe aufgerufen, damit der Tagesplan eines Handwerkers
// die neue Aufgabe enthält und die nächste Smart-Score-Berechnung
// (für andere Auktionen am selben Tag) den Routen-Bonus korrekt setzt.

import type { SupabaseClient } from "@supabase/supabase-js"
import { haversineKm } from "@/lib/distance"
import { optimiereRoute, type RoutenPunkt } from "./route-bundling"

type AnyClient = SupabaseClient

/**
 * Fügt das Ticket dem Tagesplan des Handwerkers hinzu (oder legt einen Plan an),
 * berechnet die optimierte Reihenfolge neu (Nearest-Neighbor) und persistiert.
 *
 * Idempotent: doppelte Aufrufe für dasselbe Ticket fügen es nicht erneut ein.
 *
 * Best-effort: Schlägt eine der Queries fehl, gibt die Funktion einen
 * `skipped`-Grund zurück. Der Vergabe-Flow soll dadurch nicht abbrechen.
 */
export async function fuegeTicketZuTagesplan(
  supabase: AnyClient,
  handwerkerId: string,
  ticketId: string,
  datum: string, // YYYY-MM-DD
): Promise<{ ok: boolean; skipped?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return { ok: false, skipped: "ungueltiges-datum" }
  }

  // Startort des Handwerkers
  const { data: hw } = await supabase
    .from("profiles")
    .select("startort_lat, startort_lng, lat, lng")
    .eq("id", handwerkerId)
    .single<{
      startort_lat: number | null
      startort_lng: number | null
      lat: number | null
      lng: number | null
    }>()
  const startLat = hw?.startort_lat ?? hw?.lat
  const startLng = hw?.startort_lng ?? hw?.lng
  if (startLat == null || startLng == null) {
    return { ok: false, skipped: "kein-startort" }
  }

  // Bestehender Plan (falls vorhanden)
  const { data: bestehend } = await supabase
    .from("routen_planung")
    .select("ticket_ids")
    .eq("handwerker_id", handwerkerId)
    .eq("datum", datum)
    .maybeSingle<{ ticket_ids: string[] | null }>()

  const bestehendeIds = bestehend?.ticket_ids ?? []
  if (bestehendeIds.includes(ticketId)) {
    return { ok: true, skipped: "bereits-im-plan" }
  }
  const alleIds = [...bestehendeIds, ticketId]

  // Lat/Lng aller Tickets im Plan laden
  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, einsatzort_lat, einsatzort_lng, einsatzort_adresse")
    .in("id", alleIds)
    .returns<Array<{
      id: string
      einsatzort_lat: number | null
      einsatzort_lng: number | null
      einsatzort_adresse: string | null
    }>>()

  const punkte: RoutenPunkt[] = (tickets ?? [])
    .filter(t => t.einsatzort_lat != null && t.einsatzort_lng != null)
    .map(t => ({
      ticketId: t.id,
      latitude: t.einsatzort_lat as number,
      longitude: t.einsatzort_lng as number,
      adresse: t.einsatzort_adresse ?? undefined,
    }))

  if (punkte.length === 0) {
    return { ok: false, skipped: "keine-geo-tickets" }
  }

  const route = optimiereRoute(startLat, startLng, punkte)

  const { error } = await supabase.from("routen_planung").upsert(
    {
      handwerker_id: handwerkerId,
      datum,
      ticket_ids: alleIds,
      optimierte_reihenfolge: route.reihenfolge.map(p => p.ticketId),
      gesamt_fahrzeit_min: route.gesamtFahrzeitMin,
      gesamt_distanz_km: route.gesamtDistanzKm,
    },
    { onConflict: "handwerker_id,datum" },
  )
  if (error) return { ok: false, skipped: `db-error:${error.message}` }
  return { ok: true }
}

/** Markiert eine bestehende Lücke als irrelevant für Distanz-Vergleich. */
export const ROUTEN_BONUS_RADIUS_KM = 5

/** Hilfs-Re-Export für UI: prüft ob Punkt in Bonus-Radius eines Stops liegt. */
export function liegtInBonusRadius(
  punktLat: number,
  punktLng: number,
  stopLat: number,
  stopLng: number,
): boolean {
  return haversineKm(punktLat, punktLng, stopLat, stopLng) <= ROUTEN_BONUS_RADIUS_KM
}
