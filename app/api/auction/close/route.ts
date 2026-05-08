import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { reScoreTicket } from "@/lib/auction/scoring-pipeline"
import {
  effektiveProvisionsRate,
} from "@/lib/auction/auction-manager"
import { calculateCommission } from "@/lib/pricing/commission"

// POST /api/auction/close
// Body: { ticket_id, angebot_id? }
// - Wenn angebot_id gesetzt: Verwalter wählt manuell.
// - Sonst: Auto-Pick = Bid mit höchstem Smart-Score (Tie-Break Erfahrung).
// Auth: Verwalter (oder Admin), erstellt_von des Tickets.
export async function POST(request: NextRequest) {
  let body: { ticket_id?: string; angebot_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const ticketId = body.ticket_id
  if (!ticketId) {
    return NextResponse.json({ error: "ticket_id erforderlich" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle, early_adopter_bis")
    .eq("id", user.id)
    .single()
  if (!profile || (profile.rolle !== "verwalter" && profile.rolle !== "admin")) {
    return NextResponse.json({ error: "Nur Verwalter dürfen Auktionen schließen" }, { status: 403 })
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, erstellt_von, status, surge_faktor")
    .eq("id", ticketId)
    .single()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.erstellt_von !== user.id && profile.rolle !== "admin") {
    return NextResponse.json({ error: "Nicht dein Ticket" }, { status: 403 })
  }
  if (ticket.status !== "auktion") {
    return NextResponse.json({ error: "Auktion nicht aktiv" }, { status: 422 })
  }

  // Stelle sicher dass Smart-Scores aktuell sind
  await reScoreTicket(supabase, ticketId)

  let pickedAngebotId = body.angebot_id

  if (!pickedAngebotId) {
    // Auto-Pick: höchster Smart-Score, Tie-Break über profiles.auftraege_anzahl
    const { data: bids } = await supabase
      .from("angebote")
      .select("id, handwerker_id, preis, smart_score, handwerker:profiles(auftraege_anzahl)")
      .eq("ticket_id", ticketId)
      .eq("status", "eingereicht")
      .returns<Array<{
        id: string
        handwerker_id: string
        preis: number
        smart_score: number | null
        handwerker: { auftraege_anzahl: number | null } | null
      }>>()

    if (!bids || bids.length === 0) {
      return NextResponse.json(
        { error: "Keine Angebote vorhanden" },
        { status: 422 },
      )
    }

    const sortiert = [...bids].sort((a, b) => {
      const sa = a.smart_score ?? 0
      const sb = b.smart_score ?? 0
      if (sb !== sa) return sb - sa
      return (b.handwerker?.auftraege_anzahl ?? 0) - (a.handwerker?.auftraege_anzahl ?? 0)
    })
    pickedAngebotId = sortiert[0].id
  }

  const { data: angebot } = await supabase
    .from("angebote")
    .select("id, ticket_id, handwerker_id, preis")
    .eq("id", pickedAngebotId)
    .eq("ticket_id", ticketId)
    .single()
  if (!angebot) {
    return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 })
  }

  // Vergabe-Mutationen
  await supabase
    .from("tickets")
    .update({
      status: "in_bearbeitung",
      zugewiesener_hw: angebot.handwerker_id,
      kosten_final: angebot.preis,
    })
    .eq("id", ticketId)

  await supabase
    .from("angebote")
    .update({ status: "angenommen" })
    .eq("id", angebot.id)

  await supabase
    .from("angebote")
    .update({ status: "abgelehnt" })
    .eq("ticket_id", ticketId)
    .neq("id", angebot.id)

  // Provisions-Snapshot mit Surge
  const surge = ticket.surge_faktor ?? 1.0
  const isEarlyAdopter = !!profile.early_adopter_bis &&
    new Date(profile.early_adopter_bis).getTime() > Date.now()
  const { finalRate } = effektiveProvisionsRate(0.05, surge, isEarlyAdopter)
  const calc = calculateCommission(angebot.preis, finalRate)

  await supabase.from("provisionen").upsert(
    {
      ticket_id: ticketId,
      verwalter_id: user.id,
      handwerker_id: angebot.handwerker_id,
      auftragswert: angebot.preis,
      provision_rate: finalRate,
      provision_betrag: calc.provisionBetrag,
      gesamt: calc.gesamt,
      is_early_adopter: isEarlyAdopter,
    },
    { onConflict: "ticket_id" },
  )

  return NextResponse.json({
    ok: true,
    ticketId,
    angebotId: angebot.id,
    handwerkerId: angebot.handwerker_id,
    auftragswert: angebot.preis,
    provisionRate: finalRate,
    provisionBetrag: calc.provisionBetrag,
    gesamt: calc.gesamt,
    surgeFaktor: surge,
    isEarlyAdopter,
  })
}
