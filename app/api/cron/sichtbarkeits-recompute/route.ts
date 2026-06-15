import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// POST /api/cron/sichtbarkeits-recompute
//
// Recomputed für jeden Handwerker den verfuegbarkeit_score (0..100) und
// daraus die sichtbarkeit_stufe (bronze/silber/gold). Diese Stufe fließt
// als Multiplier in den Smart-Score (lib/auction/smart-score.ts):
//   gold ×1.10 | silber ×1.05 | bronze ×1.00
//
// Komponenten (Summe = 100) — Sprint AP (V2):
//   - 15 Punkte: Google-Cal verbunden (Row in hw_google_oauth)
//   - 15 Punkte: Antwort-Rate auf Direktanfragen (letzte 30 Tage)
//               einladungen.status!='offen' + stamm_anfragen.status!='gesendet'
//               / Gesamtanzahl Direktanfragen → prorated 0..15
//   - 50 Punkte: bewertung_avg (linear 0..5 → 0..50, Neuling-Default: 30)
//   - 20 Punkte: Direktvergabe-Aktivität letzte 30 Tage
//               (einladungen.status='angebot' + stamm_anfragen.status='angenommen')
//               → prorated 0..20 (Ziel: 5 Vergaben/Monat = 20 Punkte)
//
// Stufe-Mapping:
//   ≥ 75 Punkte → gold
//   ≥ 50 Punkte → silber
//   sonst       → bronze
//
// Bei 100-1000 HW noch eine Update pro HW akzeptabel (≤ 2s Latenz).
// Bei mehr: SQL-Function wäre nächster Schritt.

const ZIEL_VERGABEN_30D = 5    // bei diesem Wert volle 20 Punkte

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
  const vor30Tagen = new Date(Date.now() - 30 * 86400_000).toISOString()

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
    // Komponente 1a: Google-Cal verbunden (15 Punkte)
    const { count: googleCalCount } = await admin
      .from("hw_google_oauth")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", hw.id)
    const googleCalPunkte = (googleCalCount ?? 0) > 0 ? 15 : 0

    // Komponente 1b: Antwort-Rate letzte 30 Tage (15 Punkte)
    const [
      { count: einlGesamt },
      { count: einlBeantwortet },
      { count: stammGesamt },
      { count: stammBeantwortet },
    ] = await Promise.all([
      admin.from("einladungen").select("id", { count: "exact", head: true })
        .eq("handwerker_id", hw.id).gte("created_at", vor30Tagen),
      admin.from("einladungen").select("id", { count: "exact", head: true })
        .eq("handwerker_id", hw.id).gte("created_at", vor30Tagen).neq("status", "offen"),
      admin.from("stamm_anfragen").select("id", { count: "exact", head: true })
        .eq("handwerker_id", hw.id).gte("created_at", vor30Tagen),
      admin.from("stamm_anfragen").select("id", { count: "exact", head: true })
        .eq("handwerker_id", hw.id).gte("created_at", vor30Tagen).neq("status", "gesendet"),
    ])
    const totalAnfragen = (einlGesamt ?? 0) + (stammGesamt ?? 0)
    const totalBeantwortet = (einlBeantwortet ?? 0) + (stammBeantwortet ?? 0)
    const antwortRate = totalAnfragen > 0 ? totalBeantwortet / totalAnfragen : 1.0
    const antwortPunkte = Math.round(antwortRate * 15)

    // Komponente 2: Bewertung (50 Punkte)
    const bewertungPunkte = hw.bewertung_avg
      ? Math.min(50, Math.round((hw.bewertung_avg / 5) * 50))
      : 30 // Neuling-Default (entspricht ~3.0 / 5)

    // Komponente 3: Direktvergabe-Aktivität letzte 30 Tage (20 Punkte)
    const [
      { count: einlAngenommen },
      { count: stammAngenommen },
    ] = await Promise.all([
      admin.from("einladungen").select("id", { count: "exact", head: true })
        .eq("handwerker_id", hw.id).eq("status", "angebot").gte("created_at", vor30Tagen),
      admin.from("stamm_anfragen").select("id", { count: "exact", head: true })
        .eq("handwerker_id", hw.id).eq("status", "angenommen").gte("created_at", vor30Tagen),
    ])
    const vergaben = (einlAngenommen ?? 0) + (stammAngenommen ?? 0)
    const aktivitaetPunkte = Math.min(20, Math.round((vergaben / ZIEL_VERGABEN_30D) * 20))

    const score = googleCalPunkte + antwortPunkte + bewertungPunkte + aktivitaetPunkte
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
    stufenWechsel: stufenWechsel.slice(0, 20),
  })
}
