import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { ticketCreateByVerwalterSchema } from "@/lib/schemas"
import { vergebeTicketAutomatisch } from "@/lib/auction/auto-vergabe"
import { erkenneVerwaltungsanliegen } from "@/lib/ki/verwaltungsanliegen"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { emitEreignis } from "@/lib/cortex/ereignis"

// POST /api/tickets/create-by-verwalter (Sprint G)
// Verwalter erstellt Ticket telefonisch via Wizard. Body enthält Anrufer-
// Daten zusätzlich zu den normalen Ticket-Feldern; der Anrufer ist
// (noch) kein Mieter-Account, wir packen Name + Telefon als Kontext in
// die Beschreibung.
//
// Auth: nur Verwalter (rolle = 'verwalter'). Setzt
// eingetragen_von_verwalter = true für das Badge in der Ticket-Liste.

export async function POST(request: NextRequest) {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = ticketCreateByVerwalterSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const body = parsed.data

  const mieterName = body.mieter_name
  const titel = body.titel
  const beschreibung = body.beschreibung
  const adresse = body.einsatzort_adresse
  const prioritaet = body.prioritaet
  const gewerk = body.gewerk?.trim() || "allgemein"

  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single<{ rolle: string }>()
  if (!profile || profile.rolle !== "verwalter") {
    return NextResponse.json({ error: "Nur Verwalter dürfen Tickets telefonisch erfassen" }, { status: 403 })
  }

  // Anrufer-Daten als strukturierte Notiz oben in die Beschreibung packen.
  // So sieht der bearbeitende HW im Ticket sofort, wen er anrufen muss.
  const anruferZeile = body.mieter_telefon
    ? `📞 Anrufer: ${mieterName} · ${body.mieter_telefon}`
    : `📞 Anrufer: ${mieterName}`
  const volleBeschreibung = `${anruferZeile}\n\n${beschreibung}`

  const insertPayload: Record<string, unknown> = {
    titel,
    beschreibung: volleBeschreibung,
    gewerk,
    prioritaet,
    status: "offen",
    vergabemodus: "direkt",
    erstellt_von: user.id,
    verwalter_id: user.id,
    einsatzort_adresse: adresse,
    einsatzort_lat: body.einsatzort_lat ?? null,
    einsatzort_lng: body.einsatzort_lng ?? null,
    wohnung: body.wohnung?.trim() || null,
    eingetragen_von_verwalter: true,
  }

  // Sprint BG: Verwaltungsanliegen markieren — keine HW-Vergabe.
  if (erkenneVerwaltungsanliegen(beschreibung)) {
    insertPayload.kein_schaden = true
  }

  let { data: ticket, error: insertErr } = await supabase
    .from("tickets")
    .insert(insertPayload)
    .select("id")
    .single<{ id: string }>()

  // Defensiv: Spalte existiert erst nach Migration 20260705000020.
  if (insertErr && insertPayload.kein_schaden && /kein_schaden/.test(insertErr.message)) {
    delete insertPayload.kein_schaden
    const retry = await supabase
      .from("tickets")
      .insert(insertPayload)
      .select("id")
      .single<{ id: string }>()
    ticket = retry.data
    insertErr = retry.error
  }

  if (insertErr || !ticket) {
    return NextResponse.json({ error: insertErr?.message ?? "Insert fehlgeschlagen" }, { status: 500 })
  }

  emitEreignis(createServiceRoleClient(), {
    typ: "ticket_neu",
    entitaet: "tickets",
    entitaetId: ticket.id,
    payload: { titel, via: "verwalter-wizard", kein_schaden: insertPayload.kein_schaden === true },
  })

  // Sprint BD — Auto-Vergabe: die KI startet die Vergabe-Engine sofort,
  // ohne dass der Verwalter im Marktplatz manuell "Auction" klicken muss.
  // Best-effort (wirft nie) — schlägt sie fehl, bleibt das Ticket offen
  // und der Verwalter kann manuell eingreifen.
  const vergabe = await vergebeTicketAutomatisch(ticket.id)

  return NextResponse.json(
    { ok: true, ticket_id: ticket.id, vergabe },
    { status: 201 },
  )
}
