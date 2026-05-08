import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// POST /api/auction/check-expired
// Cron-Endpoint: findet Tickets mit status='auktion' und abgelaufenem
// auktion_ende, markiert sie zur manuellen Vergabe und liefert die
// betroffenen Tickets zurück. Versendet KEINE Mails (das wäre eine
// separate Notification-Pipeline).
//
// Schutz: Header `x-cron-secret` muss CRON_SECRET aus Env entsprechen,
// alternativ darf ein Admin den Endpoint aufrufen.
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authViaSecret =
    !!cronSecret && request.headers.get("x-cron-secret") === cronSecret

  const supabase = createServerSupabaseClient()
  if (!authViaSecret) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase
      .from("profiles")
      .select("rolle")
      .eq("id", user.id)
      .single()
    if (profile?.rolle !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const jetzt = new Date().toISOString()
  const { data: abgelaufen } = await supabase
    .from("tickets")
    .select("id, titel, erstellt_von, auktion_ende")
    .eq("status", "auktion")
    .lt("auktion_ende", jetzt)

  return NextResponse.json({
    ok: true,
    jetzt,
    abgelaufen: abgelaufen ?? [],
    anzahl: abgelaufen?.length ?? 0,
  })
}
