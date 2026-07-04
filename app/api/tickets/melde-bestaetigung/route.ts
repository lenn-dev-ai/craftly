import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { sendEmail } from "@/lib/email/send"
import { meldungEingegangenEmail } from "@/lib/email/templates"
import { statusUrl } from "@/lib/status-token"

// POST /api/tickets/melde-bestaetigung — Body: { ticket_id }
//
// Produkt-Review 2026-07-03: Bestätigungs-Mail an den Mieter nach der
// Schadensmeldung, inkl. Zero-Login-Statuslink (/status/[id]?t=HMAC).
// Wird vom Melden-Flow fire-and-forget aufgerufen (wie welcome-mail).
//
// Auth: eingeloggter User; Mail geht nur raus, wenn er der Ersteller des
// Tickets ist (kein Mail-Versand an fremde Tickets möglich).

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { ticket_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.ticket_id) {
    return NextResponse.json({ error: "ticket_id erforderlich" }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, titel, erstellt_von")
    .eq("id", body.ticket_id)
    .maybeSingle<{ id: string; titel: string; erstellt_von: string }>()

  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.erstellt_von !== user.id) {
    return NextResponse.json({ error: "Nur der Ersteller erhält die Bestätigung" }, { status: 403 })
  }

  const { data: profil } = await admin
    .from("profiles")
    .select("name, email")
    .eq("id", user.id)
    .maybeSingle<{ name: string | null; email: string | null }>()

  const to = profil?.email || user.email
  if (!to) return NextResponse.json({ error: "Keine E-Mail-Adresse hinterlegt" }, { status: 400 })

  const tpl = meldungEingegangenEmail({
    name: profil?.name ?? to.split("@")[0],
    ticketTitel: ticket.titel,
    statusLink: statusUrl(ticket.id),
  })
  const result = await sendEmail({ to, subject: tpl.subject, html: tpl.html })

  return NextResponse.json({ ok: true, sent: result.success, skipped: result.skipped ?? null })
}
