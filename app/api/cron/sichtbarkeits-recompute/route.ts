import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// POST /api/cron/sichtbarkeits-recompute
//
// Recomputed für jeden Handwerker den verfuegbarkeit_score (0..100) und
// daraus die sichtbarkeit_stufe (bronze/silber/gold). Diese Stufe fließt
// als Multiplier in den Smart-Score (siehe lib/auction/smart-score.ts).
//
// Komponenten (Summe = 100):
//   - 30 Punkte: Zeitslot-Verfügbarkeit in nächsten 14 Tagen
//   - 50 Punkte: bewertung_avg (linear 0..5 → 0..50)
//   - 20 Punkte: Angebots-Aktivität (Anzahl Bids letzte 30 Tage)
//
// Stufe-Mapping:
//   ≥ 75 Punkte → gold
//   ≥ 50 Punkte → silber
//   sonst       → bronze
//
// Bei 100-1000 HW noch eine Update pro HW akzeptabel (≤ 2s Latenz).
// Bei mehr: SQL-Function wäre nächster Schritt.
//
// Sprint AK Stufe 3 (27.05.2026) — DEPRECATED-MARKIERUNG:
// Komponente 1 (Zeitslot-Verfügbarkeit) liefert ab jetzt für neue HW immer 0,
// weil das Slot-Konzept abgekündigt ist (siehe Konzept-Memo). Score wird
// dadurch zu sehr von Bewertung dominiert. Sprint AL ersetzt Komponente 1
// durch "Google-Cal verbunden + Antwort-Rate auf Einladungen".

const ZIEL_SLOTS = 20      // bei diesem Wert volle 30 Punkte
const ZIEL_BIDS_30D = 10   // bei diesem Wert volle 20 Punkte

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authViaSecret =
    !!cronSecret && request.headers.get("x-cron-secret") === cronSecret

  if (!authViaSecret) {
    const { supabase, user } = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("rolle").eq("id", user.id).single()
    if (profile?.rolle !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  const jetzt = new Date()
  const in14Tagen = new Date(jetzt.getTime() + 14 * 86400_000).toISOString().slice(0, 10)
  const vor30Tagen = new Date(jetzt.getTime() - 30 * 86400_000).toISOString()

  const { data: hws, error } = await admin
    .from("profiles")
    .select("id, bewertung_avg, sichtbarkeit_stufe, verfuegbarkeit_score")
    .eq("rolle", "handwerker")
    .returns<Array<{
      id: string
      bewertung_avg: number | null
      sichtbarkeit_stufe: string | null
      verfuegbarkeit_score: number | null
    }>>()
  if (error) return NextResponse.json({ error: "Query: " + error.message }, { status: 500 })

  let updated = 0
  const stufenVerteilung = { bronze: 0, silber: 0, gold: 0 }
  const stufenWechsel: Array<{ id: string; alt: string; neu: string }> = []

  for (const hw of hws ?? []) {
    // Komponente 1: Zeitslots verfügbar
    const { count: slots } = await admin
      .from("zeitslots")
      .select("id", { count: "exact", head: true })
      .eq("handwerker_id", hw.id)
      .eq("status", "verfuegbar")
      .gte("datum", jetzt.toISOString().slice(0, 10))
      .lte("datum", in14Tagen)
    const slotPunkte = Math.min(30, Math.round(((slots ?? 0) / ZIEL_SLOTS) * 30))

    // Komponente 2: Bewertung
    const bewertungPunkte = hw.bewertung_avg
      ? Math.min(50, Math.round((hw.bewertung_avg / 5) * 50))
      : 30 // Neuling-Default (entspricht ~3.0 / 5)

    // Komponente 3: Angebots-Aktivität
    const { count: bids } = await admin
      .from("angebote")
      .select("id", { count: "exact", head: true })
      .eq("handwerker_id", hw.id)
      .gte("created_at", vor30Tagen)
    const aktivitaetPunkte = Math.min(20, Math.round(((bids ?? 0) / ZIEL_BIDS_30D) * 20))

    const score = slotPunkte + bewertungPunkte + aktivitaetPunkte
    const stufe: "gold" | "silber" | "bronze" =
      score >= 75 ? "gold" : score >= 50 ? "silber" : "bronze"

    stufenVerteilung[stufe]++

    if (hw.sichtbarkeit_stufe && hw.sichtbarkeit_stufe !== stufe) {
      stufenWechsel.push({ id: hw.id, alt: hw.sichtbarkeit_stufe, neu: stufe })
    }

    await admin
      .from("profiles")
      .update({
        verfuegbarkeit_score: score,
        sichtbarkeit_stufe: stufe,
      })
      .eq("id", hw.id)
    updated++
  }

  return NextResponse.json({
    ok: true,
    geprueft: hws?.length ?? 0,
    updated,
    stufenVerteilung,
    stufenWechselAnzahl: stufenWechsel.length,
    stufenWechsel: stufenWechsel.slice(0, 20), // first 20 für Log
  })
}
