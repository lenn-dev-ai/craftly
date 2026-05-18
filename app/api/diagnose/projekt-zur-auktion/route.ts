import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { konfigFuer, berechneAuktionsEnde } from "@/lib/auction/auction-manager"
import type { Dringlichkeit } from "@/lib/auction/smart-score"
import { haversineKm } from "@/lib/distance"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { einladungEmail } from "@/lib/email/templates"

const VORKAUFSRECHT_STUNDEN = 24

// POST /api/diagnose/projekt-zur-auktion
// Body: { diagnose_ticket_id: string, dringlichkeit?: 'zeitnah'|'planbar' }
// Auth: Verwalter (erstellt_von) oder Admin.
//
// Aktionen:
//   1. Erzeugt Projekt-Ticket mit status='auktion'
//   2. vorkaufsrecht_bis = now + 24 h  (Diagnose-HW hat Vorrang)
//   3. Synthetisches Angebot vom Diagnose-HW (preis=projekt_angebot) wird
//      direkt eingebucht — er ist also schon "im Rennen".
//   4. Einladungs-Mails an passende HW im Radius (außer Diagnose-HW selbst).
//   5. Diagnose-Ticket → status='erledigt'.
//
// Vorkaufsrecht-Logik liegt im /api/auction/close-Endpoint:
// während vorkaufsrecht_bis aktiv → Diagnose-HW gewinnt unabhängig vom Score.
export async function POST(request: NextRequest) {
  let body: { diagnose_ticket_id?: string; dringlichkeit?: Dringlichkeit }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const diagnoseTicketId = body.diagnose_ticket_id
  const dringlichkeit: Dringlichkeit = body.dringlichkeit || "zeitnah"
  if (!diagnoseTicketId) {
    return NextResponse.json({ error: "diagnose_ticket_id erforderlich" }, { status: 400 })
  }
  if (!["zeitnah", "planbar"].includes(dringlichkeit)) {
    return NextResponse.json({ error: "Dringlichkeit muss zeitnah oder planbar sein" }, { status: 400 })
  }

  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single<{ rolle: string }>()
  if (!profile || (profile.rolle !== "verwalter" && profile.rolle !== "admin")) {
    return NextResponse.json({ error: "Nur Verwalter dürfen Auktionen starten" }, { status: 403 })
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, titel, beschreibung, gewerk, erstellt_von, verwalter_id, einsatzort_adresse, einsatzort_lat, einsatzort_lng, ticket_typ, status, zugewiesener_hw, befund_text, befund_fotos, befund_aufwand_stunden, projekt_angebot, leistungsumfang, preiskorridor_min, preiskorridor_max",
    )
    .eq("id", diagnoseTicketId)
    .single<{
      id: string
      titel: string
      beschreibung: string | null
      gewerk: string | null
      erstellt_von: string
      verwalter_id: string | null
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
  if (ticket.verwalter_id !== user.id && profile.rolle !== "admin") {
    return NextResponse.json({ error: "Nicht dein Ticket" }, { status: 403 })
  }
  if (ticket.ticket_typ !== "diagnose") {
    return NextResponse.json({ error: "Nur Diagnose-Tickets" }, { status: 422 })
  }
  if (!ticket.befund_text || !ticket.projekt_angebot || !ticket.zugewiesener_hw) {
    return NextResponse.json({ error: "Diagnose unvollständig" }, { status: 422 })
  }
  if (ticket.einsatzort_lat == null || ticket.einsatzort_lng == null) {
    return NextResponse.json({ error: "Einsatzort ohne Koordinaten" }, { status: 422 })
  }

  const config = konfigFuer(dringlichkeit)
  const start = new Date()
  const ende = berechneAuktionsEnde(start, config.auktionsDauerStunden)
  const vorkaufsrechtBis = new Date(start.getTime() + VORKAUFSRECHT_STUNDEN * 3600 * 1000)
  const admin = createServiceRoleClient()

  // Projekt-Ticket anlegen (status=auktion). Die Route ist absichtlich
  // idempotent, damit Wiederholungen im Live-Test oder nach einem Abbruch
  // nicht an einem bereits angelegten Projekt-Ticket scheitern.
  const projektTitel = ticket.titel.startsWith("Projekt: ") ? ticket.titel : `Projekt: ${ticket.titel}`
  const projektBeschr = ticket.befund_text
  const { data: existingProjekte } = await admin
    .from("tickets")
    .select("id")
    .eq("diagnose_ticket_id", ticket.id)
    .limit(1)
    .returns<Array<{ id: string }>>()

  let projektTicket = existingProjekte?.[0] ?? null
  if (!projektTicket) {
    const { data: insTicket, error: insErr } = await admin
      .from("tickets")
      .insert({
        titel: projektTitel,
        beschreibung: projektBeschr,
        gewerk: ticket.gewerk,
        erstellt_von: ticket.erstellt_von,
        verwalter_id: ticket.verwalter_id ?? user.id,
        einsatzort_adresse: ticket.einsatzort_adresse,
        einsatzort_lat: ticket.einsatzort_lat,
        einsatzort_lng: ticket.einsatzort_lng,
        ticket_typ: "projekt",
        diagnose_ticket_id: ticket.id,
        status: "auktion",
        dringlichkeit,
        surge_faktor: config.surgeFaktor,
        auktion_start: start.toISOString(),
        auktion_ende: ende?.toISOString() ?? null,
        vorkaufsrecht_bis: vorkaufsrechtBis.toISOString(),
        preiskorridor_min: ticket.preiskorridor_min,
        preiskorridor_max: ticket.preiskorridor_max,
        befund_text: ticket.befund_text,
        befund_fotos: ticket.befund_fotos ?? [],
        befund_aufwand_stunden: ticket.befund_aufwand_stunden,
        projekt_angebot: ticket.projekt_angebot,
        leistungsumfang: ticket.leistungsumfang ?? [],
      })
      .select("id")
      .single<{ id: string }>()
    if (insErr || !insTicket) {
      return NextResponse.json(
        { error: "Projekt-Ticket anlegen fehlgeschlagen: " + (insErr?.message ?? "unknown") },
        { status: 500 },
      )
    }
    projektTicket = insTicket
  }

  // Synthetisches Angebot vom Diagnose-HW (preis = projekt_angebot).
  // Muss als Service-Role laufen, weil die angebote_insert-RLS-Policy
  // auth.uid() = handwerker_id verlangt — wir laufen aber als Verwalter
  // und legen das Angebot im Namen des Diagnose-HW an.
  const { error: angebotErr } = await admin.from("angebote").upsert(
    {
      ticket_id: projektTicket.id,
      handwerker_id: ticket.zugewiesener_hw,
      preis: ticket.projekt_angebot,
      nachricht: "Aus Diagnose übernommen (Vorkaufsrecht aktiv)",
      status: "eingereicht",
      smart_score: null,
    },
    { onConflict: "ticket_id,handwerker_id" },
  )
  if (angebotErr) {
    console.error("[Diagnose] Synthetisches Angebot konnte nicht angelegt werden:", angebotErr)
  }

  // Diagnose-Ticket schließen
  await admin
    .from("tickets")
    .update({ status: "erledigt" })
    .eq("id", ticket.id)

  // Einladungs-Mails an andere passende HW (außer Diagnose-HW)
  void (async () => {
    let query = supabase
      .from("profiles")
      .select("id, email, name, gewerk, startort_lat, startort_lng, lat, lng, radius_km")
      .eq("rolle", "handwerker")
      .neq("id", ticket.zugewiesener_hw)
    if (ticket.gewerk && ticket.gewerk !== "allgemein") {
      query = query.ilike("gewerk", `%${ticket.gewerk}%`)
    }
    const { data: handwerker } = await query.returns<Array<{
      id: string
      email: string | null
      name: string | null
      gewerk: string | null
      startort_lat: number | null
      startort_lng: number | null
      lat: number | null
      lng: number | null
      radius_km: number | null
    }>>()

    const auktionEndeFormatiert = ende
      ? ende.toLocaleString("de-DE", {
          day: "2-digit", month: "long", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : "—"

    for (const hw of handwerker ?? []) {
      if (!hw.email) continue
      const hwLat = hw.startort_lat ?? hw.lat
      const hwLng = hw.startort_lng ?? hw.lng
      if (hwLat == null || hwLng == null) continue
      const distanz = haversineKm(
        hwLat, hwLng,
        ticket.einsatzort_lat as number, ticket.einsatzort_lng as number,
      )
      const radius = hw.radius_km ?? config.radiusKm
      if (distanz > radius) continue

      const { subject, html } = einladungEmail({
        handwerkerName: hw.name || "Handwerker",
        ticketTitel: projektTitel,
        ticketBeschreibung: projektBeschr || "",
        gewerk: ticket.gewerk || "allgemein",
        dringlichkeit,
        einsatzort: ticket.einsatzort_adresse || "",
        distanzKm: distanz,
        auktionEnde: auktionEndeFormatiert,
      ticketId: projektTicket.id,
      })
      sendEmailFireAndForget({ to: hw.email, subject, html })
    }
  })().catch(err => console.error("[Email] Auktion-Einladungen fehlgeschlagen:", err))

  return NextResponse.json({
    ok: true,
    diagnoseTicketId: ticket.id,
    projektTicketId: projektTicket.id,
    dringlichkeit,
    surgeFaktor: config.surgeFaktor,
    auktionEnde: ende?.toISOString() ?? null,
    vorkaufsrechtBis: vorkaufsrechtBis.toISOString(),
    radiusKm: config.radiusKm,
    syntheticOfferCreated: !angebotErr,
  })
}
