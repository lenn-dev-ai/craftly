import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { sendEmailFireAndForget } from "@/lib/email/send"

// K1.3c: 24h-Reminder an Handwerker, wenn der Mieter auf vorgeschlagene
// Slots noch nicht reagiert hat.
//
// Idempotenz: stündlich laufen lassen — der Filter trifft jede Gruppe
// genau einmal (zwischen 24h und 25h alt, alle Slots noch 'vorgeschlagen').
// Wenn der Cron seltener läuft, gehen die Reminders verloren; läuft er
// häufiger, sendet er trotzdem nur 1× pro Gruppe.
//
// Auth: x-cron-secret-Header (CRON_SECRET env). Fallback: Admin-Auth.
//
// Netlify Scheduled Functions:
//   netlify.toml → [[functions."<name>".schedule]] cron = "0 * * * *"
//   Cron-Setup ist bewusst nicht hier — Lennart aktiviert das Job-Cycle
//   wenn die Beta tatsächlich Slots schreibt.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authViaSecret =
    !!cronSecret && request.headers.get("x-cron-secret") === cronSecret

  const supabase = createServerSupabaseClient()
  if (!authViaSecret) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("rolle").eq("id", user.id).single<{ rolle: string }>()
    if (profile?.rolle !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  const jetzt = Date.now()
  const fenster25h = new Date(jetzt - 25 * 3600_000).toISOString()
  const fenster24h = new Date(jetzt - 24 * 3600_000).toISOString()

  // Alle vorgeschlagenen Termine im 24-25h-Fenster — group by vorschlag_gruppe_id
  const { data: rows, error } = await admin
    .from("termine")
    .select("vorschlag_gruppe_id, ticket_id, handwerker_id, created_at, status")
    .eq("status", "vorgeschlagen")
    .gte("created_at", fenster25h)
    .lte("created_at", fenster24h)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = { vorschlag_gruppe_id: string | null; ticket_id: string | null; handwerker_id: string | null; created_at: string; status: string }
  const gruppen = new Map<string, Row>()
  for (const r of (rows ?? []) as Row[]) {
    if (!r.vorschlag_gruppe_id || !r.ticket_id || !r.handwerker_id) continue
    if (!gruppen.has(r.vorschlag_gruppe_id)) gruppen.set(r.vorschlag_gruppe_id, r)
  }

  let mailsGeschickt = 0
  for (const [gruppeId, r] of Array.from(gruppen.entries())) {
    // Sanity-Check: alle Slots der Gruppe noch 'vorgeschlagen'?
    const { data: gruppeSlots } = await admin
      .from("termine")
      .select("status")
      .eq("vorschlag_gruppe_id", gruppeId)
    if (!gruppeSlots || gruppeSlots.length === 0) continue
    if (!gruppeSlots.every(s => s.status === "vorgeschlagen")) continue

    const { data: hw } = await admin
      .from("profiles")
      .select("email, name")
      .eq("id", r.handwerker_id!)
      .maybeSingle<{ email: string | null; name: string | null }>()
    const { data: ticket } = await admin
      .from("tickets")
      .select("titel")
      .eq("id", r.ticket_id!)
      .maybeSingle<{ titel: string }>()
    if (!hw?.email) continue

    const ticketUrl = `${SITE_URL}/dashboard-handwerker/ticket/${r.ticket_id}`
    sendEmailFireAndForget({
      to: hw.email,
      subject: `Erinnerung: Mieter hat noch keinen Termin gewählt — ${ticket?.titel ?? "Auftrag"}`.slice(0, 200),
      html: `
        <p>Hallo${hw.name ? " " + escape(hw.name) : ""},</p>
        <p>
          Der Mieter hat deine Termin-Vorschläge für
          &bdquo;${escape(ticket?.titel ?? "")}&ldquo; seit 24 Stunden nicht beantwortet.
        </p>
        <p>
          Vielleicht meldet er sich noch, oder du schlägst neue Termine vor —
          beides ist OK.
        </p>
        <p><a href="${ticketUrl}" style="background:#3D8B7A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;">Auftrag öffnen</a></p>
      `,
    })
    mailsGeschickt++
  }

  return NextResponse.json({ ok: true, gruppen: gruppen.size, mails: mailsGeschickt })
}
