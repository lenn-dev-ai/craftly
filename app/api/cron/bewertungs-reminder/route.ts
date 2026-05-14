import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { bewertungReminderEmail } from "@/lib/email/templates"

// POST /api/cron/bewertungs-reminder
//
// Sendet Bewertungs-Erinnerungen an Mieter für Tickets die ≥ 3 Tage
// erledigt sind und noch keine Bewertung haben. Pro Ticket nur EINMAL
// (Tracking via tickets.bewertung_reminder_gesendet).
//
// Auth: x-cron-secret oder Admin-Session. Idempotent — kann täglich
// laufen. Tickets ohne Mail-Empfänger werden trotzdem markiert (sonst
// ewiger Re-Scan).
//
// Hintergrund: SIMULATION-REPORT M-W2. Bewertungs-Quote im Mock 85 %,
// real eher 30-60 %. Reminder bringt erwartungsgemäß +20-30 Prozentpunkte.

const TAGE_BIS_REMINDER = 3

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authViaSecret =
    !!cronSecret && request.headers.get("x-cron-secret") === cronSecret

  const supabase = createServerSupabaseClient()
  if (!authViaSecret) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("rolle").eq("id", user.id).single()
    if (profile?.rolle !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  const schwelle = new Date(Date.now() - TAGE_BIS_REMINDER * 86400_000).toISOString()

  // Erledigte Tickets ohne gesendeten Reminder, älter als Schwelle.
  // Wir filtern erst nachträglich auf "keine Bewertung vorhanden" weil
  // ein NOT-EXISTS-Sub-Query mit PostgREST sperrig wäre.
  const { data: kandidaten, error } = await admin
    .from("tickets")
    .select("id, titel, erstellt_von, zugewiesener_hw, created_at")
    .eq("status", "erledigt")
    .is("bewertung_reminder_gesendet", null)
    .not("zugewiesener_hw", "is", null)
    .lt("created_at", schwelle)
    .limit(200)
    .returns<Array<{
      id: string
      titel: string
      erstellt_von: string
      zugewiesener_hw: string
      created_at: string
    }>>()

  if (error) {
    return NextResponse.json({ error: "Query fehlgeschlagen: " + error.message }, { status: 500 })
  }

  let versendet = 0
  let bereitsBewertet = 0
  let ohneEmail = 0

  for (const t of kandidaten ?? []) {
    // Existiert schon eine Bewertung vom Mieter? Dann nur markieren.
    const { count: bewertet } = await admin
      .from("bewertungen")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", t.id)
      .eq("bewerter_id", t.erstellt_von)
    if ((bewertet ?? 0) > 0) {
      await admin
        .from("tickets")
        .update({ bewertung_reminder_gesendet: new Date().toISOString() })
        .eq("id", t.id)
      bereitsBewertet++
      continue
    }

    // Mieter- + HW-Profile holen für die Mail
    const [{ data: mieter }, { data: hw }] = await Promise.all([
      admin.from("profiles").select("email, name").eq("id", t.erstellt_von)
        .single<{ email: string | null; name: string | null }>(),
      admin.from("profiles").select("name, firma").eq("id", t.zugewiesener_hw)
        .single<{ name: string | null; firma: string | null }>(),
    ])

    if (!mieter?.email) {
      // Trotzdem markieren — sonst Daueranflug
      await admin.from("tickets").update({ bewertung_reminder_gesendet: new Date().toISOString() }).eq("id", t.id)
      ohneEmail++
      continue
    }

    const { subject, html } = bewertungReminderEmail({
      mieterName: mieter.name || "Mieter",
      handwerkerName: hw?.firma || hw?.name || "Handwerker",
      ticketTitel: t.titel,
      ticketId: t.id,
    })
    sendEmailFireAndForget({ to: mieter.email, subject, html })

    await admin
      .from("tickets")
      .update({ bewertung_reminder_gesendet: new Date().toISOString() })
      .eq("id", t.id)
    versendet++
  }

  return NextResponse.json({
    ok: true,
    geprueft: kandidaten?.length ?? 0,
    versendet,
    bereitsBewertet,
    ohneEmail,
  })
}
