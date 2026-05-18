import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

// K1.2: Mieter wählt einen vorgeschlagenen Termin-Slot (oder lehnt alle ab).
//
// Eingang:
//   { gruppe_id: uuid, action: "select", termin_id: uuid }   ← Slot wählen
//   { gruppe_id: uuid, action: "reject" }                    ← alle ablehnen
//
// Auth: Bearer-Token (B1.1-Pattern) oder Cookie. User muss Ticket-Ersteller
// sein (`tickets.erstellt_von`). Service-Role-Client bypasst RLS, weil
// `termine_update` nur dem handwerker_id Updates erlaubt — der Mieter
// hätte sonst keine Möglichkeit, seinen Slot zu bestätigen.
//
// Effekte:
//   action=select  → gewählter Termin status='bestaetigt', restliche der
//                    Gruppe status='abgelaufen'
//   action=reject  → alle der Gruppe status='abgelehnt'
// Beide Pfade sind idempotent gegen Doppelklicks: nur wenn alle Termine
// der Gruppe noch 'vorgeschlagen' sind, wird gemacht.

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const authHeader = request.headers.get("authorization") || ""
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "")
  const { data: { user } } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { gruppe_id?: unknown; action?: unknown; termin_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const gruppeId = typeof body.gruppe_id === "string" ? body.gruppe_id : ""
  const action = body.action === "select" || body.action === "reject" ? body.action : null
  const terminId = typeof body.termin_id === "string" ? body.termin_id : null
  if (!gruppeId || !action) {
    return NextResponse.json({ error: "gruppe_id und action erforderlich" }, { status: 400 })
  }
  if (action === "select" && !terminId) {
    return NextResponse.json({ error: "termin_id erforderlich für action=select" }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  const { data: gruppe, error: gErr } = await admin
    .from("termine")
    .select("id, ticket_id, status, vorschlag_gruppe_id")
    .eq("vorschlag_gruppe_id", gruppeId)
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!gruppe || gruppe.length === 0) {
    return NextResponse.json({ error: "Vorschlagsgruppe nicht gefunden" }, { status: 404 })
  }

  const ticketId = gruppe[0].ticket_id as string | null
  if (!ticketId) {
    return NextResponse.json({ error: "Termine ohne Ticket-Zuordnung" }, { status: 400 })
  }

  const { data: ticket, error: tErr } = await admin
    .from("tickets")
    .select("erstellt_von")
    .eq("id", ticketId)
    .single<{ erstellt_von: string }>()
  if (tErr || !ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.erstellt_von !== user.id) {
    return NextResponse.json({ error: "Nur der Mieter darf den Termin wählen." }, { status: 403 })
  }

  if (!gruppe.every(t => t.status === "vorgeschlagen")) {
    return NextResponse.json(
      { error: "Diese Vorschläge wurden bereits bearbeitet." },
      { status: 409 },
    )
  }

  if (action === "select") {
    const treffer = gruppe.find(t => t.id === terminId)
    if (!treffer) {
      return NextResponse.json({ error: "Gewählter Termin gehört nicht zur Gruppe" }, { status: 400 })
    }
    const { error: e1 } = await admin
      .from("termine")
      .update({ status: "bestaetigt" })
      .eq("id", terminId!)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    const { error: e2 } = await admin
      .from("termine")
      .update({ status: "abgelaufen" })
      .eq("vorschlag_gruppe_id", gruppeId)
      .neq("id", terminId!)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: "bestaetigt" })
  } else {
    // reject — alle der Gruppe auf 'abgelehnt'. Der HW kriegt im
    // Folgeschritt (K1.3 Notification) Bescheid und kann neue Slots
    // vorschlagen.
    const { error } = await admin
      .from("termine")
      .update({ status: "abgelehnt" })
      .eq("vorschlag_gruppe_id", gruppeId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: "abgelehnt" })
  }
}
