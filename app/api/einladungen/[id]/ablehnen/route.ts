import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { eskaliereDirektvergabe } from "@/lib/auction/direktvergabe"
import { logTicketEvent } from "@/lib/audit/logTicketEvent"

// POST /api/einladungen/[id]/ablehnen
// Body: { grund?: string } (optional, nicht persistiert, nur Audit-Log)
//
// Sprint AM Phase 2 (AM-Phase2d) — Handwerker lehnt eine
// Direktvergabe-Anfrage ab. Anders als bei der Mass-Invite-Auktion
// (wo "ablehnen" einfach bedeutet, kein Angebot abzugeben) markiert dies
// hier aktiv die einladungen-Zeile als 'abgelehnt' und triggert sofort
// die Eskalation zum nächsten Kandidaten (oder Mass-Invite-Fallback) über
// eskaliereDirektvergabe() aus lib/auction/direktvergabe.ts — dieselbe
// Funktion, die auch vom Timeout-Cron "direktvergabe-eskalation"
// (AM-Phase2e) verwendet wird.
//
// Race-Conditions: das conditional Update (.eq("status","offen")) dient
// als Lock — falls der Cron parallel bereits eskaliert hat (Timeout kurz
// vor der Ablehnung), ist die Zeile bereits 'abgelaufen' und dieser Call
// gibt 409 zurück, ohne ein zweites Mal zu eskalieren.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { grund?: string } = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    body = {}
  }

  const admin = createServiceRoleClient()

  const { data: einladung } = await admin
    .from("einladungen")
    .select("id, ticket_id, handwerker_id, status")
    .eq("id", params.id)
    .maybeSingle<{
      id: string
      ticket_id: string
      handwerker_id: string
      status: string
    }>()

  if (!einladung) return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 })
  if (einladung.handwerker_id !== user.id) {
    return NextResponse.json({ error: "Nur der eingeladene Handwerker darf ablehnen" }, { status: 403 })
  }
  if (einladung.status !== "offen") {
    return NextResponse.json({ error: `Einladung bereits ${einladung.status}` }, { status: 422 })
  }

  // Conditional Update als Lock gegen Race mit dem Timeout-Cron.
  const { data: updated, error: updateErr } = await admin
    .from("einladungen")
    .update({ status: "abgelehnt" })
    .eq("id", einladung.id)
    .eq("status", "offen")
    .select("id")
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "Diese Einladung wurde bereits bearbeitet (z.B. durch Timeout-Eskalation)" },
      { status: 409 },
    )
  }

  // Direkt eskalieren — nächster Kandidat oder Mass-Invite-Fallback.
  const eskalation = await eskaliereDirektvergabe(einladung.ticket_id)

  void logTicketEvent({
    ticketId: einladung.ticket_id,
    eventType: "status_change",
    actorUserId: user.id,
    actorRole: "handwerker",
    eventData: {
      via: "direktvergabe",
      einladung_id: einladung.id,
      von: "offen",
      auf: "abgelehnt",
      grund: body.grund || null,
      eskalation: eskalation.ergebnis,
    },
    request,
  })

  return NextResponse.json({
    ok: true,
    ticketId: einladung.ticket_id,
    status: "abgelehnt",
    eskalation: eskalation.ergebnis,
  })
}
