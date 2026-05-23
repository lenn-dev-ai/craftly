import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// POST /api/tickets/create-by-verwalter (Sprint G)
// Verwalter erstellt Ticket telefonisch via Wizard. Body enthält Anrufer-
// Daten zusätzlich zu den normalen Ticket-Feldern; der Anrufer ist
// (noch) kein Mieter-Account, wir packen Name + Telefon als Kontext in
// die Beschreibung.
//
// Auth: nur Verwalter (rolle = 'verwalter'). Setzt
// eingetragen_von_verwalter = true für das Badge in der Ticket-Liste.

type Body = {
  mieter_name?: string
  mieter_telefon?: string | null
  titel?: string
  beschreibung?: string
  gewerk?: string
  einsatzort_adresse?: string
  einsatzort_lat?: number | null
  einsatzort_lng?: number | null
  wohnung?: string | null
  prioritaet?: string
}

const ERLAUBTE_PRIO = new Set(["planbar", "zeitnah", "notfall"])

export async function POST(request: NextRequest) {
  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const mieterName = body.mieter_name?.trim()
  const titel = body.titel?.trim()
  const beschreibung = body.beschreibung?.trim()
  const adresse = body.einsatzort_adresse?.trim()
  const prioritaet = body.prioritaet ?? "planbar"
  const gewerk = body.gewerk?.trim() || "allgemein"

  if (!mieterName) return NextResponse.json({ error: "mieter_name erforderlich" }, { status: 400 })
  if (!titel) return NextResponse.json({ error: "titel erforderlich" }, { status: 400 })
  if (!beschreibung) return NextResponse.json({ error: "beschreibung erforderlich" }, { status: 400 })
  if (!adresse) return NextResponse.json({ error: "einsatzort_adresse erforderlich" }, { status: 400 })
  if (!ERLAUBTE_PRIO.has(prioritaet)) {
    return NextResponse.json({ error: "prioritaet muss planbar|zeitnah|notfall sein" }, { status: 400 })
  }

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

  const { data: ticket, error: insertErr } = await supabase
    .from("tickets")
    .insert(insertPayload)
    .select("id")
    .single<{ id: string }>()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ticket_id: ticket.id }, { status: 201 })
}
