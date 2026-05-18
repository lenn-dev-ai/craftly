import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { haversineKm } from "@/lib/distance"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { stilleHwReaktivierungEmail } from "@/lib/email/templates"

// POST /api/cron/stille-hw-reaktivierung
//
// Findet Handwerker die in 14+ Tagen kein Angebot abgegeben haben und
// schickt ihnen eine Top-3-Liste passender offener Aufträge (gleiches
// Gewerk, im Radius). Re-Send-Schutz via profiles.letzte_reaktivierung_mail.
//
// Hintergrund: SIMULATION-REPORT M-W4. ~17 % der HW sind im Seed
// stillschweigend inaktiv. Reaktivierungs-Mail bringt typischerweise
// 10-20 % davon zurück (Vergleichsdaten von Marketplaces wie MyHammer).

const STILLE_TAGE = 14
const REMINDER_INTERVALL_TAGE = 14
const MAX_AUFTRAEGE_PRO_MAIL = 3

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
  const stilleSchwelle = new Date(Date.now() - STILLE_TAGE * 86400_000).toISOString()
  const intervallSchwelle = new Date(Date.now() - REMINDER_INTERVALL_TAGE * 86400_000).toISOString()

  // Alle Handwerker — wir filtern in JS (NOT EXISTS mit PostgREST sperrig)
  const { data: hws, error } = await admin
    .from("profiles")
    .select("id, email, name, firma, gewerk, startort_lat, startort_lng, radius_km, letzte_reaktivierung_mail")
    .eq("rolle", "handwerker")
    .not("email", "is", null)
    .returns<Array<{
      id: string
      email: string
      name: string | null
      firma: string | null
      gewerk: string | null
      startort_lat: number | null
      startort_lng: number | null
      radius_km: number | null
      letzte_reaktivierung_mail: string | null
    }>>()
  if (error) return NextResponse.json({ error: "Query: " + error.message }, { status: 500 })

  // Offene Auktions-Tickets — einmal laden, dann pro HW filtern
  const { data: auftraege } = await admin
    .from("tickets")
    .select("id, titel, gewerk, einsatzort_adresse, einsatzort_lat, einsatzort_lng")
    .eq("status", "auktion")
    .eq("ticket_typ", "standard")
    .not("einsatzort_lat", "is", null)
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<Array<{
      id: string
      titel: string
      gewerk: string | null
      einsatzort_adresse: string | null
      einsatzort_lat: number
      einsatzort_lng: number
    }>>()

  let geprueft = 0
  let versendet = 0
  let keinPassenderAuftrag = 0
  let zuKuerzlichVersendet = 0
  let nichtStill = 0

  for (const hw of hws ?? []) {
    geprueft++

    // Re-Send-Schutz: letzte Mail noch nicht alt genug
    if (hw.letzte_reaktivierung_mail && hw.letzte_reaktivierung_mail > intervallSchwelle) {
      zuKuerzlichVersendet++
      continue
    }

    // Hat HW in letzten 14 Tagen ein Angebot abgegeben?
    const { count: recentBids } = await admin
      .from("angebote")
      .select("id", { count: "exact", head: true })
      .eq("handwerker_id", hw.id)
      .gte("created_at", stilleSchwelle)
    if ((recentBids ?? 0) > 0) {
      nichtStill++
      continue
    }

    // Passende Top-3-Aufträge filtern: Gewerk + Radius
    if (hw.startort_lat == null || hw.startort_lng == null) {
      keinPassenderAuftrag++
      continue
    }
    const radius = hw.radius_km ?? 25
    const passend = (auftraege ?? [])
      .filter(a => !hw.gewerk || a.gewerk === hw.gewerk || hw.gewerk === "allgemein")
      .map(a => ({
        ...a,
        entfernungKm: haversineKm(hw.startort_lat!, hw.startort_lng!, a.einsatzort_lat, a.einsatzort_lng),
      }))
      .filter(a => a.entfernungKm <= radius)
      .sort((a, b) => a.entfernungKm - b.entfernungKm)
      .slice(0, MAX_AUFTRAEGE_PRO_MAIL)

    if (passend.length === 0) {
      keinPassenderAuftrag++
      continue
    }

    const { subject, html } = stilleHwReaktivierungEmail({
      handwerkerName: hw.firma || hw.name || "Handwerker",
      auftraege: passend.map(p => ({
        id: p.id,
        titel: p.titel,
        gewerk: p.gewerk || "allgemein",
        einsatzort: p.einsatzort_adresse || "",
        entfernungKm: p.entfernungKm,
      })),
    })
    sendEmailFireAndForget({ to: hw.email, subject, html })

    await admin
      .from("profiles")
      .update({ letzte_reaktivierung_mail: new Date().toISOString() })
      .eq("id", hw.id)
    versendet++
  }

  return NextResponse.json({
    ok: true,
    geprueft,
    versendet,
    keinPassenderAuftrag,
    zuKuerzlichVersendet,
    nichtStill,
  })
}
