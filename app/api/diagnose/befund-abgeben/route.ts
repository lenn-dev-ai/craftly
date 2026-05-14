import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { berechnePreisKorridor } from "@/lib/diagnose/preiskorridor"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { befundFertigEmail } from "@/lib/email/templates"

// POST /api/diagnose/befund-abgeben
// Body: {
//   ticket_id: string,
//   befund_text: string,
//   befund_fotos: string[],
//   befund_aufwand_stunden: number,
//   projekt_angebot: number,
//   leistungsumfang: string[]
// }
// Auth: Handwerker, muss zugewiesener_hw des Diagnose-Tickets sein.
//
// Server berechnet Preiskorridor (historisch ±15 % oder Fallback um
// Angebot) und sendet Verwalter-Mail mit "Click-to-Approve"-CTA.
export async function POST(request: NextRequest) {
  let body: {
    ticket_id?: string
    befund_text?: string
    befund_fotos?: string[]
    befund_aufwand_stunden?: number
    projekt_angebot?: number
    leistungsumfang?: string[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const {
    ticket_id: ticketId,
    befund_text,
    befund_fotos,
    befund_aufwand_stunden,
    projekt_angebot,
    leistungsumfang,
  } = body

  if (!ticketId || !befund_text?.trim()) {
    return NextResponse.json({ error: "ticket_id und befund_text erforderlich" }, { status: 400 })
  }
  if (!befund_aufwand_stunden || befund_aufwand_stunden <= 0) {
    return NextResponse.json({ error: "befund_aufwand_stunden muss > 0 sein" }, { status: 400 })
  }
  if (!projekt_angebot || projekt_angebot <= 0) {
    return NextResponse.json({ error: "projekt_angebot muss > 0 sein" }, { status: 400 })
  }
  if (!Array.isArray(leistungsumfang) || leistungsumfang.length === 0) {
    return NextResponse.json({ error: "leistungsumfang darf nicht leer sein" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, titel, ticket_typ, status, gewerk, zugewiesener_hw, erstellt_von")
    .eq("id", ticketId)
    .single<{
      id: string
      titel: string
      ticket_typ: string | null
      status: string
      gewerk: string | null
      zugewiesener_hw: string | null
      erstellt_von: string
    }>()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.zugewiesener_hw !== user.id) {
    return NextResponse.json({ error: "Nicht dein Ticket" }, { status: 403 })
  }
  if (ticket.ticket_typ !== "diagnose") {
    return NextResponse.json({ error: "Nur für Diagnose-Tickets" }, { status: 422 })
  }

  // Preiskorridor — historische Vergleichspreise oder Fallback ±15 %
  const korridor = await berechnePreisKorridor(supabase, {
    gewerk: ticket.gewerk,
    aufwandStunden: befund_aufwand_stunden,
    angebotDiagnoseHw: projekt_angebot,
  })

  const { error: updErr } = await supabase
    .from("tickets")
    .update({
      befund_text: befund_text.trim(),
      befund_fotos: befund_fotos ?? [],
      befund_aufwand_stunden,
      projekt_angebot,
      leistungsumfang,
      preiskorridor_min: korridor.min,
      preiskorridor_max: korridor.max,
    })
    .eq("id", ticketId)
  if (updErr) {
    return NextResponse.json({ error: "Speichern fehlgeschlagen: " + updErr.message }, { status: 500 })
  }

  // Verwalter benachrichtigen — fire-and-forget
  void (async () => {
    const [{ data: verwalter }, { data: hwProfil }] = await Promise.all([
      supabase
        .from("profiles")
        .select("email, name")
        .eq("id", ticket.erstellt_von)
        .single<{ email: string | null; name: string | null }>(),
      supabase
        .from("profiles")
        .select("name, firma")
        .eq("id", user.id)
        .single<{ name: string | null; firma: string | null }>(),
    ])
    if (!verwalter?.email) return
    const { subject, html } = befundFertigEmail({
      verwalterName: verwalter.name || "Verwalter",
      handwerkerName: hwProfil?.name || "Handwerker",
      handwerkerFirma: hwProfil?.firma || "",
      ticketTitel: ticket.titel,
      projektAngebot: projekt_angebot,
      korridorMin: korridor.min,
      korridorMax: korridor.max,
      korridorBasis: korridor.basis,
      vergleichsanzahl: korridor.vergleichsanzahl,
      ticketId,
    })
    sendEmailFireAndForget({ to: verwalter.email, subject, html })
  })().catch(err => console.error("[Email] Befund-Fertig-Mail fehlgeschlagen:", err))

  return NextResponse.json({
    ok: true,
    ticketId,
    korridor,
    imKorridor: projekt_angebot >= korridor.min && projekt_angebot <= korridor.max,
  })
}
