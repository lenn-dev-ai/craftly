import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { konfigFuer, berechneAuktionsEnde } from "@/lib/auction/auction-manager"
import type { Dringlichkeit } from "@/lib/auction/smart-score"

// POST /api/auction/start
// Body: { ticket_id: string, dringlichkeit: 'notfall'|'zeitnah'|'planbar' }
// Auth: Verwalter (oder Admin), muss erstellt_von des Tickets sein.
export async function POST(request: NextRequest) {
  let body: { ticket_id?: string; dringlichkeit?: Dringlichkeit }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const ticketId = body.ticket_id
  const dringlichkeit = body.dringlichkeit
  if (!ticketId || !dringlichkeit) {
    return NextResponse.json(
      { error: "ticket_id und dringlichkeit erforderlich" },
      { status: 400 },
    )
  }
  if (!["notfall", "zeitnah", "planbar"].includes(dringlichkeit)) {
    return NextResponse.json({ error: "Ungültige Dringlichkeit" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single()
  if (!profile || (profile.rolle !== "verwalter" && profile.rolle !== "admin")) {
    return NextResponse.json({ error: "Nur Verwalter dürfen Auktionen starten" }, { status: 403 })
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, erstellt_von, status, einsatzort_lat, einsatzort_lng")
    .eq("id", ticketId)
    .single()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.erstellt_von !== user.id && profile.rolle !== "admin") {
    return NextResponse.json({ error: "Nicht dein Ticket" }, { status: 403 })
  }
  if (ticket.einsatzort_lat == null || ticket.einsatzort_lng == null) {
    return NextResponse.json(
      { error: "Ticket hat keinen Einsatzort — Adresse setzen und geocodieren" },
      { status: 422 },
    )
  }
  if (ticket.status !== "offen" && ticket.status !== "auktion") {
    return NextResponse.json(
      { error: `Auktion kann im Status '${ticket.status}' nicht gestartet werden` },
      { status: 422 },
    )
  }

  const config = konfigFuer(dringlichkeit)
  const start = new Date()
  const ende = berechneAuktionsEnde(start, config.auktionsDauerStunden)

  const { error: updateErr } = await supabase
    .from("tickets")
    .update({
      dringlichkeit,
      surge_faktor: config.surgeFaktor,
      auktion_start: start.toISOString(),
      auktion_ende: ende?.toISOString() ?? null,
      status: "auktion",
    })
    .eq("id", ticketId)
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    ticketId,
    dringlichkeit,
    radiusKm: config.radiusKm,
    surgeFaktor: config.surgeFaktor,
    auktionsDauerStunden: config.auktionsDauerStunden,
    auktionsEnde: ende?.toISOString() ?? null,
    autoMatch: config.auktionsDauerStunden === 0,
    antwortzielText: config.antwortzielText,
  })
}
