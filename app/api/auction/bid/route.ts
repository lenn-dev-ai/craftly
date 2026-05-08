import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { reScoreTicket } from "@/lib/auction/scoring-pipeline"

// POST /api/auction/bid
// Body: { ticket_id, preis, fruehester_termin?, geschaetzte_dauer?, nachricht? }
// Auth: Handwerker. Schreibt Angebot, triggert Smart-Score-Recompute für
//       alle Bids des Tickets.
export async function POST(request: NextRequest) {
  let body: {
    ticket_id?: string
    preis?: number
    fruehester_termin?: string
    geschaetzte_dauer?: string
    nachricht?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const ticketId = body.ticket_id
  const preis = Number(body.preis)
  if (!ticketId) {
    return NextResponse.json({ error: "ticket_id erforderlich" }, { status: 400 })
  }
  if (!isFinite(preis) || preis <= 0) {
    return NextResponse.json({ error: "preis muss > 0 sein" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single()
  if (!profile || profile.rolle !== "handwerker") {
    return NextResponse.json({ error: "Nur Handwerker dürfen bieten" }, { status: 403 })
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, status, auktion_ende")
    .eq("id", ticketId)
    .single()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.status !== "auktion") {
    return NextResponse.json({ error: "Auktion nicht aktiv" }, { status: 422 })
  }
  if (ticket.auktion_ende && new Date(ticket.auktion_ende).getTime() < Date.now()) {
    return NextResponse.json({ error: "Auktion bereits abgelaufen" }, { status: 422 })
  }

  const { error: insertErr } = await supabase.from("angebote").upsert(
    {
      ticket_id: ticketId,
      handwerker_id: user.id,
      preis,
      fruehester_termin: body.fruehester_termin || null,
      geschaetzte_dauer: body.geschaetzte_dauer || null,
      nachricht: body.nachricht || null,
      status: "eingereicht",
    },
    { onConflict: "ticket_id,handwerker_id" },
  )
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Einladung markieren falls vorhanden
  await supabase
    .from("einladungen")
    .update({ status: "angebot" })
    .eq("ticket_id", ticketId)
    .eq("handwerker_id", user.id)

  // Re-Score aller Bids dieses Tickets
  const result = await reScoreTicket(supabase, ticketId)

  return NextResponse.json({
    ok: true,
    ticketId,
    rescored: result.updated,
    rescoreSkipped: result.skipped || undefined,
  })
}
