import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { sendEmail } from "@/lib/email/send"
import { auftragErledigtEmail } from "@/lib/email/templates"
import { statusUrl } from "@/lib/status-token"

// POST /api/tickets/[id]/erledigt-mail
//
// Audit H5: Beim Abschluss (Verwalter setzt Status 'erledigt') bekam der
// Mieter keine Benachrichtigung — der emotionale Abschluss des Produkt-
// versprechens fehlte. Diese Route sendet dem Mieter eine Erledigt-Mail
// mit Zero-Login-Statuslink + Bewertungsbitte.
//
// Auth: eingeloggter Verwalter/Admin des Tickets. Fire-and-forget vom
// Client aufgerufen (blockiert den Abschluss nicht).

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user, supabase } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createServiceRoleClient()
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, titel, status, verwalter_id, erstellt_von")
    .eq("id", params.id)
    .maybeSingle<{ id: string; titel: string; status: string; verwalter_id: string | null; erstellt_von: string }>()

  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })

  // Nur Verwalter des Tickets oder Admin dürfen die Mail auslösen.
  const { data: profile } = await supabase
    .from("profiles").select("rolle").eq("id", user.id).maybeSingle<{ rolle: string }>()
  const darf = ticket.verwalter_id === user.id || profile?.rolle === "admin"
  if (!darf) return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 })

  // Empfänger = Ersteller (Mieter). Bei Verwalter-erfassten Tickets kann
  // erstellt_von der Verwalter selbst sein → dann keine Mieter-Mail.
  const { data: mieter } = await admin
    .from("profiles").select("name, email, rolle").eq("id", ticket.erstellt_von)
    .maybeSingle<{ name: string | null; email: string | null; rolle: string | null }>()
  if (!mieter?.email || mieter.rolle !== "mieter") {
    return NextResponse.json({ ok: true, skipped: "kein Mieter-Empfänger" })
  }

  const tpl = auftragErledigtEmail({
    name: mieter.name ?? mieter.email.split("@")[0],
    ticketTitel: ticket.titel,
    statusLink: statusUrl(ticket.id),
    bewertungsLink: `${SITE_URL}/dashboard-mieter/ticket/${ticket.id}`,
  })
  const result = await sendEmail({ to: mieter.email, subject: tpl.subject, html: tpl.html })
  return NextResponse.json({ ok: true, sent: result.success, skipped: result.skipped ?? null })
}
