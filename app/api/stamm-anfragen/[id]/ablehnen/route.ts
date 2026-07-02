import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { logTicketEvent } from "@/lib/audit/logTicketEvent"
import { sendEmailFireAndForget } from "@/lib/email/send"

// POST /api/stamm-anfragen/[id]/ablehnen
// Body: { grund?: string }
// Sprint V Phase 3 — Stamm-HW lehnt 1:1-Anfrage ab.
//
// Effekte:
//   - stamm_anfragen.status='abgelehnt', ablehn_grund, entschieden_at
//   - Ticket bleibt 'offen' (Verwalter entscheidet ob Marktplatz)
//   - Email an Verwalter best-effort
//   - Audit-Log 'status_change' mit Kontext

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { grund?: string }
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    body = {}
  }
  const grund = body.grund?.trim()?.slice(0, 500) || null

  const admin = createServiceRoleClient()

  const { data: anfrage } = await admin
    .from("stamm_anfragen")
    .select("id, ticket_id, handwerker_id, status")
    .eq("id", params.id)
    .maybeSingle<{
      id: string
      ticket_id: string
      handwerker_id: string
      status: string
    }>()

  if (!anfrage) return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 })
  if (anfrage.handwerker_id !== user.id) {
    return NextResponse.json({ error: "Nur der adressierte HW darf ablehnen" }, { status: 403 })
  }
  if (anfrage.status !== "gesendet") {
    return NextResponse.json({ error: `Anfrage bereits ${anfrage.status}` }, { status: 422 })
  }

  const { error: updateErr } = await admin
    .from("stamm_anfragen")
    .update({
      status: "abgelehnt",
      ablehn_grund: grund,
      entschieden_at: new Date().toISOString(),
    })
    .eq("id", anfrage.id)
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Verwalter benachrichtigen (best-effort)
  void (async () => {
    const { data: ticket } = await admin
      .from("tickets")
      .select("id, titel, verwalter_id")
      .eq("id", anfrage.ticket_id)
      .maybeSingle<{ id: string; titel: string; verwalter_id: string | null }>()
    if (!ticket?.verwalter_id) return
    const { data: verwalter } = await admin
      .from("profiles")
      .select("email, name")
      .eq("id", ticket.verwalter_id)
      .maybeSingle<{ email: string | null; name: string | null }>()
    if (!verwalter?.email) return
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo.app"
    sendEmailFireAndForget({
      to: verwalter.email,
      subject: `Stamm-HW hat abgelehnt: ${ticket.titel}`,
      html: `
        <p>Hallo ${verwalter.name || ""},</p>
        <p>Dein Stamm-Handwerker hat das Ticket <b>${ticket.titel}</b> abgelehnt.</p>
        ${grund ? `<p><b>Grund:</b> ${grund}</p>` : ""}
        <p>Du kannst jetzt den Marktplatz öffnen oder das Ticket erneut zuweisen:
        <a href="${baseUrl}/dashboard-verwalter/ticket/${ticket.id}">Ticket öffnen</a></p>
      `,
    })
  })().catch(err => console.warn("[stamm-anfragen/ablehnen] mail failed", err))

  void logTicketEvent({
    ticketId: anfrage.ticket_id,
    eventType: "status_change",
    actorUserId: user.id,
    actorRole: "handwerker",
    eventData: { via: "stamm_anfrage", stamm_anfrage_id: anfrage.id, von: "stamm", auf: "abgelehnt", grund },
    request,
  })

  return NextResponse.json({ ok: true, ticket_id: anfrage.ticket_id, status: "abgelehnt" })
}
