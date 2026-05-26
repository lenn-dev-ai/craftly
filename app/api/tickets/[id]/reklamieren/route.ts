import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { logTicketEvent } from "@/lib/audit/logTicketEvent"

// POST /api/tickets/[id]/reklamieren
// Body: { grund: string, details?: string, fotos?: string[] }
// Sprint U Phase 2 — Mieter beschwert sich nach Abnahme.
//
// Effekte:
//   - INSERT ticket_reklamationen (Mieter-RLS lässt eigene Inserts zu)
//   - Ticket-Status → 'reklamiert' (additiver Wert aus Sprint U Migration)
//   - Audit-Log-Eintrag (Sprint T)

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { grund?: string; details?: string; fotos?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const grund = body.grund?.trim()
  if (!grund || grund.length < 5) {
    return NextResponse.json({ error: "Grund (mind. 5 Zeichen) erforderlich" }, { status: 400 })
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, erstellt_von, status")
    .eq("id", params.id)
    .maybeSingle<{ id: string; erstellt_von: string; status: string }>()

  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.erstellt_von !== user.id) {
    return NextResponse.json({ error: "Nur Ticket-Ersteller darf reklamieren" }, { status: 403 })
  }
  if (ticket.status !== "erledigt" && ticket.status !== "abgenommen") {
    return NextResponse.json({ error: `Reklamation nur nach Abnahme möglich (aktueller Status: ${ticket.status})` }, { status: 422 })
  }

  const admin = createServiceRoleClient()
  const { data: reklamation, error: insertErr } = await admin
    .from("ticket_reklamationen")
    .insert({
      ticket_id: params.id,
      mieter_id: user.id,
      grund,
      details: body.details?.trim() || null,
      fotos: Array.isArray(body.fotos) ? body.fotos : null,
    })
    .select("id, created_at")
    .single()

  if (insertErr || !reklamation) {
    return NextResponse.json({ error: insertErr?.message || "Reklamation konnte nicht angelegt werden" }, { status: 500 })
  }

  await admin.from("tickets").update({ status: "reklamiert" }).eq("id", params.id)

  void logTicketEvent({
    ticketId: params.id,
    eventType: "reklamiert",
    actorUserId: user.id,
    actorRole: "mieter",
    eventData: { grund, reklamation_id: reklamation.id },
    request,
  })

  return NextResponse.json({ ok: true, reklamation_id: reklamation.id })
}
