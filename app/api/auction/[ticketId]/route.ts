import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// GET /api/auction/[ticketId]
// Liefert Auktions-Status + Angebote (RLS gefiltert).
export async function GET(
  request: NextRequest,
  { params }: { params: { ticketId: string } },
) {
  const ticketId = params.ticketId
  if (!ticketId) {
    return NextResponse.json({ error: "ticketId erforderlich" }, { status: 400 })
  }

  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select(
      "id, titel, status, dringlichkeit, surge_faktor, auktion_start, auktion_ende, einsatzort_adresse",
    )
    .eq("id", ticketId)
    .single()
  if (error || !ticket) {
    return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  }

  const { data: angebote } = await supabase
    .from("angebote")
    .select(
      "id, handwerker_id, preis, smart_score, entfernung_km, fahrzeit_min, ist_routen_bonus, status, fruehester_termin, handwerker:profiles(name, firma, gewerk, bewertung_avg)",
    )
    .eq("ticket_id", ticketId)
    .order("smart_score", { ascending: false, nullsFirst: false })

  const jetzt = Date.now()
  const verbleibendSec = ticket.auktion_ende
    ? Math.max(0, Math.floor((new Date(ticket.auktion_ende).getTime() - jetzt) / 1000))
    : null

  return NextResponse.json({
    ticket,
    angebote: angebote ?? [],
    verbleibendSec,
    abgelaufen: verbleibendSec !== null && verbleibendSec === 0,
  })
}
