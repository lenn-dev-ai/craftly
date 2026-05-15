import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

// POST /api/cron/abwicklungsfrist
//
// KAL-4 Sprint 4: Tickets die seit 14 Tagen "in_bearbeitung" sind und
// vom HW nicht als erledigt markiert wurden, werden:
//   1. Status zurück auf 'auktion' (Verwalter sieht den Job wieder im Markt)
//   2. zugewiesener_hw → null (HW ist raus)
//   3. -10 auf profiles.angebotstreue des HW (Penalty, max 0)
//
// Auth: x-cron-secret oder Admin (gleiches Pattern wie sichtbarkeits-recompute).
//
// Default-Frist 14 Tage — als Konstante damit später konfigurierbar.

const FRIST_TAGE = 14
const PENALTY_PUNKTE = 10

interface UeberfaelligesTicket {
  id: string
  titel: string
  zugewiesener_hw: string | null
  verwalter_id: string | null
  erstellt_von: string
  created_at: string
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authViaSecret =
    !!cronSecret && request.headers.get("x-cron-secret") === cronSecret

  const supabase = createServerSupabaseClient()
  if (!authViaSecret) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("rolle").eq("id", user.id).single()
    if (profile?.rolle !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  const fristSchwelle = new Date(Date.now() - FRIST_TAGE * 86400_000).toISOString()

  // Tickets die in_bearbeitung sind und älter als die Frist.
  // Wir nehmen created_at als Approximation für "Auftragsbeginn" — sauberer
  // wäre eine eigene Spalte vergeben_am, aber dafür müsste close/route.ts
  // die mitschreiben. Ersatz: created_at + 14 Tage.
  const { data: ueberfaellig, error } = await admin
    .from("tickets")
    .select("id, titel, zugewiesener_hw, verwalter_id, erstellt_von, created_at")
    .eq("status", "in_bearbeitung")
    .not("zugewiesener_hw", "is", null)
    .lt("created_at", fristSchwelle)
    .returns<UeberfaelligesTicket[]>()

  if (error) {
    return NextResponse.json({ error: "Query: " + error.message }, { status: 500 })
  }

  const ergebnisse: Array<{
    ticketId: string
    titel: string
    handwerkerId: string | null
    aktion: "zurueck-zur-auktion" | "fehler"
    fehler?: string
  }> = []

  for (const t of ueberfaellig ?? []) {
    if (!t.zugewiesener_hw) continue

    // 1. Ticket zurück auf 'auktion', HW raus
    //    Auktion-Ende +24h damit Verwalter Zeit zum Reagieren hat
    const neuesEnde = new Date(Date.now() + 24 * 3600_000).toISOString()
    const { error: ticketErr } = await admin.from("tickets").update({
      status: "auktion",
      zugewiesener_hw: null,
      auktion_ende: neuesEnde,
    }).eq("id", t.id)
    if (ticketErr) {
      ergebnisse.push({ ticketId: t.id, titel: t.titel, handwerkerId: t.zugewiesener_hw, aktion: "fehler", fehler: ticketErr.message })
      continue
    }

    // 2. Penalty auf angebotstreue (-10, min 0)
    //    angebotstreue ist 0..100. Trigger pg_trigger_depth schützt sich
    //    selbst — direct UPDATE als service-role ist ohnehin allowed.
    const { data: hw } = await admin.from("profiles")
      .select("angebotstreue").eq("id", t.zugewiesener_hw).single<{ angebotstreue: number | null }>()
    const aktuellerScore = hw?.angebotstreue ?? 100
    const neuerScore = Math.max(0, aktuellerScore - PENALTY_PUNKTE)
    await admin.from("profiles").update({ angebotstreue: neuerScore }).eq("id", t.zugewiesener_hw)

    ergebnisse.push({
      ticketId: t.id,
      titel: t.titel,
      handwerkerId: t.zugewiesener_hw,
      aktion: "zurueck-zur-auktion",
    })
  }

  return NextResponse.json({
    ok: true,
    geprueft: ueberfaellig?.length ?? 0,
    bearbeitet: ergebnisse.length,
    fristTage: FRIST_TAGE,
    penaltyPunkte: PENALTY_PUNKTE,
    ergebnisse,
  })
}
