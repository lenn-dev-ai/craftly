import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// POST /api/diagnose/termin-annehmen
// Body: { ticket_id: string }
// Auth: Handwerker
//
// Atomare Übernahme eines Diagnose-Termins. Vorher (Audit FIX-5) machte
// der UI-Button nur router.push() — kein API-Call, keine Race-Sicherung.
// Zwei HW könnten parallel klicken und beide am Befund-Formular landen,
// am Ende gewinnt wer zuletzt updated.
//
// Race-Sicherung: UPDATE ... WHERE zugewiesener_hw IS NULL über
// Service-Role (sonst greift mein protect_ticket_fields-Trigger).
// Postgres garantiert dass nur EIN UPDATE die Row trifft (Lock).
// Ergebnis-Count = 1 → wir haben gewonnen, sonst 409.
export async function POST(request: NextRequest) {
  let body: { ticket_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const ticketId = body.ticket_id
  if (!ticketId) {
    return NextResponse.json({ error: "ticket_id erforderlich" }, { status: 400 })
  }

  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // User muss Handwerker sein
  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single<{ rolle: string }>()
  if (profile?.rolle !== "handwerker") {
    return NextResponse.json({ error: "Nur Handwerker können Diagnosen übernehmen" }, { status: 403 })
  }

  // Vor-Check: Ticket existiert + ist Diagnose + Status auktion + noch frei
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, ticket_typ, status, zugewiesener_hw")
    .eq("id", ticketId)
    .single<{ id: string; ticket_typ: string | null; status: string; zugewiesener_hw: string | null }>()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.ticket_typ !== "diagnose") {
    return NextResponse.json({ error: "Nur Diagnose-Tickets" }, { status: 422 })
  }
  if (ticket.status !== "auktion") {
    return NextResponse.json({ error: "Diagnose-Termin nicht mehr verfügbar" }, { status: 422 })
  }
  if (ticket.zugewiesener_hw) {
    return NextResponse.json({ error: "Bereits vergeben" }, { status: 409 })
  }

  // Atomares Claim via Service-Role + WHERE-Constraint.
  // Gibt 0 Rows zurück wenn ein anderer HW im Race gewonnen hat.
  const admin = createServiceRoleClient()
  const { data: updated, error } = await admin
    .from("tickets")
    .update({
      zugewiesener_hw: user.id,
      status: "in_bearbeitung",
    })
    .eq("id", ticketId)
    .eq("ticket_typ", "diagnose")
    .eq("status", "auktion")
    .is("zugewiesener_hw", null)
    .select("id")

  if (error) {
    return NextResponse.json({ error: "Übernahme fehlgeschlagen: " + error.message }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "Bereits vergeben (Race)" }, { status: 409 })
  }

  return NextResponse.json({
    ok: true,
    ticketId: updated[0].id,
    handwerkerId: user.id,
  })
}
