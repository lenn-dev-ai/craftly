import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { logTicketEvent } from "@/lib/audit/logTicketEvent"
import { effektiveProvisionsRate } from "@/lib/auction/auction-manager"
import { calculateCommission } from "@/lib/pricing/commission"

// POST /api/stamm-anfragen/[id]/annehmen
// Body: { preis: number, termin_datum?: string, termin_von?: string, termin_bis?: string, nachricht?: string }
// Sprint V Phase 3 — Stamm-HW akzeptiert 1:1-Anfrage.
//
// Effekte:
//   - stamm_anfragen.status='angenommen', entschieden_at=now
//   - Synthetisches Angebot (angenommen) zwischen HW und Ticket
//   - Ticket → 'in_bearbeitung', zugewiesener_hw, kosten_final
//   - Provision-Snapshot (ohne Surge — Stamm-Vergabe ist nicht eilig)
//   - Optional Termin anlegen wenn Datum mitgegeben
//   - Audit-Log 'vergeben'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: {
    preis?: number
    termin_datum?: string
    termin_von?: string
    termin_bis?: string
    nachricht?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const preis = Number(body.preis)
  if (!Number.isFinite(preis) || preis <= 0) {
    return NextResponse.json({ error: "preis (>0) erforderlich" }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  const { data: anfrage } = await admin
    .from("stamm_anfragen")
    .select("id, ticket_id, handwerker_id, status, frist_bis")
    .eq("id", params.id)
    .maybeSingle<{
      id: string
      ticket_id: string
      handwerker_id: string
      status: string
      frist_bis: string
    }>()

  if (!anfrage) return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 })
  if (anfrage.handwerker_id !== user.id) {
    return NextResponse.json({ error: "Nur der adressierte HW darf annehmen" }, { status: 403 })
  }
  if (anfrage.status !== "gesendet") {
    return NextResponse.json({ error: `Anfrage bereits ${anfrage.status}` }, { status: 422 })
  }
  if (new Date(anfrage.frist_bis).getTime() < Date.now()) {
    return NextResponse.json({ error: "Frist abgelaufen" }, { status: 422 })
  }

  const { data: ticket } = await admin
    .from("tickets")
    .select("id, titel, verwalter_id, einsatzort_adresse, einsatzort_lat, einsatzort_lng")
    .eq("id", anfrage.ticket_id)
    .maybeSingle<{
      id: string
      titel: string
      verwalter_id: string | null
      einsatzort_adresse: string | null
      einsatzort_lat: number | null
      einsatzort_lng: number | null
    }>()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })

  // 1. Anfrage als angenommen markieren
  const { error: anfrageErr } = await admin
    .from("stamm_anfragen")
    .update({
      status: "angenommen",
      preis_vorschlag_cents: Math.round(preis * 100),
      entschieden_at: new Date().toISOString(),
    })
    .eq("id", anfrage.id)
  if (anfrageErr) {
    return NextResponse.json({ error: anfrageErr.message }, { status: 500 })
  }

  // 2. Synthetisches Angebot (status=angenommen)
  await admin.from("angebote").upsert(
    {
      ticket_id: anfrage.ticket_id,
      handwerker_id: user.id,
      preis,
      nachricht: body.nachricht || "Stamm-HW-Direkt-Zusage",
      status: "angenommen",
    },
    { onConflict: "ticket_id,handwerker_id" },
  )

  // 3. Ticket vergeben
  await admin
    .from("tickets")
    .update({
      status: "in_bearbeitung",
      zugewiesener_hw: user.id,
      kosten_final: preis,
    })
    .eq("id", anfrage.ticket_id)

  // 4. Provision-Snapshot (kein Surge bei Stamm-Vergabe — 1.0)
  if (ticket.verwalter_id) {
    const { data: verwalter } = await admin
      .from("profiles")
      .select("early_adopter_bis")
      .eq("id", ticket.verwalter_id)
      .maybeSingle<{ early_adopter_bis: string | null }>()
    const isEarlyAdopter = !!verwalter?.early_adopter_bis &&
      new Date(verwalter.early_adopter_bis).getTime() > Date.now()
    const { finalRate } = effektiveProvisionsRate(0.05, 1.0, isEarlyAdopter)
    const calc = calculateCommission(preis, finalRate)
    await admin.from("provisionen").upsert(
      {
        ticket_id: anfrage.ticket_id,
        verwalter_id: ticket.verwalter_id,
        handwerker_id: user.id,
        auftragswert: preis,
        provision_rate: finalRate,
        provision_betrag: calc.provisionBetrag,
        gesamt: calc.gesamt,
        is_early_adopter: isEarlyAdopter,
      },
      { onConflict: "ticket_id" },
    )
  }

  // 5. Optional Termin anlegen
  if (body.termin_datum && body.termin_von && body.termin_bis) {
    await admin.from("termine").insert({
      handwerker_id: user.id,
      ticket_id: anfrage.ticket_id,
      titel: `Stamm: ${ticket.titel}`,
      datum: body.termin_datum,
      von: body.termin_von,
      bis: body.termin_bis,
      einsatzort_adresse: ticket.einsatzort_adresse,
      einsatzort_lat: ticket.einsatzort_lat,
      einsatzort_lng: ticket.einsatzort_lng,
    })
  }

  void logTicketEvent({
    ticketId: anfrage.ticket_id,
    eventType: "vergeben",
    actorUserId: user.id,
    actorRole: "handwerker",
    eventData: { via: "stamm_anfrage", stamm_anfrage_id: anfrage.id, preis },
    request,
  })

  return NextResponse.json({ ok: true, ticket_id: anfrage.ticket_id, preis })
}
