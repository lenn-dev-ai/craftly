import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { getDiagnosePreis } from "@/lib/diagnose/preise"
import { calculateCommission } from "@/lib/pricing/commission"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { zuschlagEmail } from "@/lib/email/templates"

// POST /api/diagnose/projekt-annehmen
// Body: { diagnose_ticket_id: string }
// Auth: Verwalter (erstellt_von) oder Admin.
//
// Aktionen:
//   1. Erzeugt neues Projekt-Ticket (ticket_typ='projekt', diagnose_ticket_id=X,
//      status='in_bearbeitung', zugewiesener_hw=Diagnose-HW)
//   2. kosten_final = projekt_angebot − diagnose_preis (Restzahlung)
//      diagnosegebuehr_angerechnet = true
//   3. Provisions-Snapshot auf Restzahlung
//   4. Diagnose-Ticket → status='erledigt'
//   5. Zuschlag-Mail an HW (fire-and-forget)
export async function POST(request: NextRequest) {
  let body: { diagnose_ticket_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const diagnoseTicketId = body.diagnose_ticket_id
  if (!diagnoseTicketId) {
    return NextResponse.json({ error: "diagnose_ticket_id erforderlich" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle, early_adopter_bis")
    .eq("id", user.id)
    .single<{ rolle: string; early_adopter_bis: string | null }>()
  if (!profile || (profile.rolle !== "verwalter" && profile.rolle !== "admin")) {
    return NextResponse.json({ error: "Nur Verwalter dürfen Angebote annehmen" }, { status: 403 })
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, titel, beschreibung, gewerk, erstellt_von, einsatzort_adresse, einsatzort_lat, einsatzort_lng, ticket_typ, status, zugewiesener_hw, befund_text, befund_fotos, befund_aufwand_stunden, projekt_angebot, leistungsumfang, preiskorridor_min, preiskorridor_max",
    )
    .eq("id", diagnoseTicketId)
    .single<{
      id: string
      titel: string
      beschreibung: string | null
      gewerk: string | null
      erstellt_von: string
      einsatzort_adresse: string | null
      einsatzort_lat: number | null
      einsatzort_lng: number | null
      ticket_typ: string | null
      status: string
      zugewiesener_hw: string | null
      befund_text: string | null
      befund_fotos: string[] | null
      befund_aufwand_stunden: number | null
      projekt_angebot: number | null
      leistungsumfang: string[] | null
      preiskorridor_min: number | null
      preiskorridor_max: number | null
    }>()
  if (!ticket) return NextResponse.json({ error: "Diagnose-Ticket nicht gefunden" }, { status: 404 })
  if (ticket.erstellt_von !== user.id && profile.rolle !== "admin") {
    return NextResponse.json({ error: "Nicht dein Ticket" }, { status: 403 })
  }
  if (ticket.ticket_typ !== "diagnose") {
    return NextResponse.json({ error: "Nur Diagnose-Tickets können angenommen werden" }, { status: 422 })
  }
  if (!ticket.befund_text || !ticket.projekt_angebot || !ticket.zugewiesener_hw) {
    return NextResponse.json({ error: "Diagnose unvollständig (Befund/Angebot/HW fehlt)" }, { status: 422 })
  }
  if (ticket.status === "erledigt") {
    return NextResponse.json({ error: "Diagnose bereits abgeschlossen" }, { status: 422 })
  }

  // Diagnose-Festpreis pro Gewerk → wird vom projekt_angebot abgezogen
  const diagnosePreis = await getDiagnosePreis(supabase, ticket.gewerk)
  const restzahlung = Math.max(0, Math.round((ticket.projekt_angebot - diagnosePreis) * 100) / 100)

  // Projekt-Ticket anlegen
  const projektTitel = ticket.titel.startsWith("Projekt: ") ? ticket.titel : `Projekt: ${ticket.titel}`
  const projektBeschr = ticket.befund_text
  const { data: projektTicket, error: insErr } = await supabase
    .from("tickets")
    .insert({
      titel: projektTitel,
      beschreibung: projektBeschr,
      gewerk: ticket.gewerk,
      erstellt_von: ticket.erstellt_von,
      einsatzort_adresse: ticket.einsatzort_adresse,
      einsatzort_lat: ticket.einsatzort_lat,
      einsatzort_lng: ticket.einsatzort_lng,
      ticket_typ: "projekt",
      diagnose_ticket_id: ticket.id,
      status: "in_bearbeitung",
      zugewiesener_hw: ticket.zugewiesener_hw,
      kosten_final: restzahlung,
      diagnosegebuehr_angerechnet: true,
      befund_text: ticket.befund_text,
      befund_fotos: ticket.befund_fotos ?? [],
      befund_aufwand_stunden: ticket.befund_aufwand_stunden,
      projekt_angebot: ticket.projekt_angebot,
      leistungsumfang: ticket.leistungsumfang ?? [],
      preiskorridor_min: ticket.preiskorridor_min,
      preiskorridor_max: ticket.preiskorridor_max,
    })
    .select("id")
    .single<{ id: string }>()
  if (insErr || !projektTicket) {
    return NextResponse.json(
      { error: "Projekt-Ticket anlegen fehlgeschlagen: " + (insErr?.message ?? "unknown") },
      { status: 500 },
    )
  }

  // Synthetisches Angebot anlegen (status=angenommen) — für Reporting/Historie
  await supabase.from("angebote").upsert(
    {
      ticket_id: projektTicket.id,
      handwerker_id: ticket.zugewiesener_hw,
      preis: ticket.projekt_angebot,
      nachricht: "Auto-Vergabe nach Diagnose (Festpreis-Angebot angenommen)",
      status: "angenommen",
      smart_score: 100,
    },
    { onConflict: "ticket_id,handwerker_id" },
  )

  // Provisions-Snapshot — auf Restzahlung (Diagnose-Anteil schon abgerechnet)
  const isEarlyAdopter = !!profile.early_adopter_bis &&
    new Date(profile.early_adopter_bis).getTime() > Date.now()
  const finalRate = isEarlyAdopter ? 0 : 0.05
  const calc = calculateCommission(restzahlung, finalRate)
  await supabase.from("provisionen").upsert(
    {
      ticket_id: projektTicket.id,
      verwalter_id: user.id,
      handwerker_id: ticket.zugewiesener_hw,
      auftragswert: restzahlung,
      provision_rate: finalRate,
      provision_betrag: calc.provisionBetrag,
      gesamt: calc.gesamt,
      is_early_adopter: isEarlyAdopter,
    },
    { onConflict: "ticket_id" },
  )

  // Diagnose-Ticket schließen
  await supabase
    .from("tickets")
    .update({ status: "erledigt" })
    .eq("id", ticket.id)

  // Zuschlag-Mail an Diagnose-HW
  void (async () => {
    const { data: hw } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("id", ticket.zugewiesener_hw)
      .single<{ email: string | null; name: string | null }>()
    if (!hw?.email) return
    const { subject, html } = zuschlagEmail({
      handwerkerName: hw.name || "Handwerker",
      ticketTitel: projektTitel,
      ticketBeschreibung: projektBeschr || "",
      einsatzort: ticket.einsatzort_adresse || "",
      angebotPreis: ticket.projekt_angebot!,
      ticketId: projektTicket.id,
    })
    sendEmailFireAndForget({ to: hw.email, subject, html })
  })().catch(err => console.error("[Email] Annahme-Mail fehlgeschlagen:", err))

  return NextResponse.json({
    ok: true,
    diagnoseTicketId: ticket.id,
    projektTicketId: projektTicket.id,
    handwerkerId: ticket.zugewiesener_hw,
    projektAngebot: ticket.projekt_angebot,
    diagnosePreisAngerechnet: diagnosePreis,
    restzahlung,
    provisionRate: finalRate,
    provisionBetrag: calc.provisionBetrag,
    gesamt: calc.gesamt,
    isEarlyAdopter,
  })
}
