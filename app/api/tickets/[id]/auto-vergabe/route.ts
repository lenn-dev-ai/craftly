import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { vergebeTicketAutomatisch } from "@/lib/auction/auto-vergabe"

// POST /api/tickets/[id]/auto-vergabe (Sprint BD)
//
// Startet die automatische Vergabe für ein frisch gemeldetes Ticket.
// Gedacht für den Mieter-Melden-Flow: der Mieter legt das Ticket
// client-seitig an (RLS) und ruft danach diesen Endpoint, damit die
// KI-Vergabe anläuft — ohne dass ein Verwalter manuell eingreifen muss.
//
// Sicherheitsnetz: aus dem Mieter-Kontext startet nur ein NOTFALL sofort.
// Zeitnah/planbar bleiben 'offen' und warten auf die Verwalter-Freigabe
// (bzw. später Auto-Confirm über die Verwalter-Präferenzen).
//
// Auth: nur der Ersteller des Tickets (erstellt_von = user.id) darf den
// Auto-Start für sein eigenes Ticket auslösen.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: ticketId } = await params
  if (!ticketId) {
    return NextResponse.json({ error: "ticket_id fehlt" }, { status: 400 })
  }

  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, erstellt_von")
    .eq("id", ticketId)
    .single<{ id: string; erstellt_von: string | null }>()

  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.erstellt_von !== user.id) {
    return NextResponse.json({ error: "Nicht dein Ticket" }, { status: 403 })
  }

  const vergabe = await vergebeTicketAutomatisch(ticketId, { nurNotfallSofort: true })
  return NextResponse.json({ ok: true, vergabe })
}
