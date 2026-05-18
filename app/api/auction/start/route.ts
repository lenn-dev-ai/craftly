import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import {
  konfigFuer,
  berechneAuktionsEnde,
  effektiveProvisionsRate,
} from "@/lib/auction/auction-manager"
import type { Dringlichkeit } from "@/lib/auction/smart-score"
import { berechneSmartScore } from "@/lib/auction/smart-score"
import { haversineKm, schaetzeFahrzeitMin } from "@/lib/distance"
import { calculateCommission } from "@/lib/pricing/commission"
import { fuegeTicketZuTagesplan } from "@/lib/auction/routen-planung-sync"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { einladungEmail, zuschlagEmail } from "@/lib/email/templates"

const DEFAULT_NOTFALL_STUNDEN = 2
const DEFAULT_STUNDENSATZ = 50

// POST /api/auction/start
// Body: { ticket_id: string, dringlichkeit: 'notfall'|'zeitnah'|'planbar' }
// Auth: Verwalter (oder Admin), muss erstellt_von des Tickets sein.
//
// Notfall: kein Auktions-Fenster, sondern sofortiger Top-1-Match aus
// dem 10 km-Radius. Synthetisches Angebot wird angelegt; Auftragswert =
// basis_stundensatz × 2 h Default. Verwalter kann kosten_final später
// anpassen. Provision wird mit Surge 1.20 berechnet.
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

  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle, early_adopter_bis")
    .eq("id", user.id)
    .single<{ rolle: string; early_adopter_bis: string | null }>()
  if (!profile || (profile.rolle !== "verwalter" && profile.rolle !== "admin")) {
    return NextResponse.json({ error: "Nur Verwalter dürfen Auktionen starten" }, { status: 403 })
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, titel, beschreibung, erstellt_von, verwalter_id, status, einsatzort_lat, einsatzort_lng, einsatzort_adresse, gewerk")
    .eq("id", ticketId)
    .single<{
      id: string
      titel: string
      beschreibung: string | null
      erstellt_von: string
      verwalter_id: string | null
      status: string
      einsatzort_lat: number | null
      einsatzort_lng: number | null
      einsatzort_adresse: string | null
      gewerk: string | null
    }>()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  // Auth via verwalter_id (M-K3): bei Mieter-erstellten Tickets entscheidet
  // der zuständige Verwalter aus objekt.verwalter_id, nicht der Ersteller.
  if (ticket.verwalter_id !== user.id && profile.rolle !== "admin") {
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

  // === NOTFALL: Direkt-Match ===
  if (dringlichkeit === "notfall") {
    let query = supabase
      .from("profiles")
      .select("id, name, firma, gewerk, bewertung_avg, basis_stundensatz, basis_preis, startort_lat, startort_lng, lat, lng, radius_km")
      .eq("rolle", "handwerker")
    if (ticket.gewerk && ticket.gewerk !== "allgemein") {
      query = query.ilike("gewerk", `%${ticket.gewerk}%`)
    }
    const { data: kandidaten } = await query.returns<Array<{
      id: string
      name: string | null
      firma: string | null
      gewerk: string | null
      bewertung_avg: number | null
      basis_stundensatz: number | null
      basis_preis: number | null
      startort_lat: number | null
      startort_lng: number | null
      lat: number | null
      lng: number | null
      radius_km: number | null
    }>>()

    type Bewertet = {
      id: string
      score: number
      entfernungKm: number
      fahrzeitMin: number
      stundensatz: number
      auftraegeAnzahl?: number
    }
    const imRadius: Bewertet[] = []
    for (const hw of kandidaten ?? []) {
      const hwLat = hw.startort_lat ?? hw.lat
      const hwLng = hw.startort_lng ?? hw.lng
      if (hwLat == null || hwLng == null) continue
      const entfernung = haversineKm(
        hwLat, hwLng,
        ticket.einsatzort_lat, ticket.einsatzort_lng,
      )
      if (entfernung > config.radiusKm) continue
      const score = berechneSmartScore({
        angebotPreis: 0,
        durchschnittPreis: 0, // bei Notfall irrelevant (Preis-Gewicht 0)
        entfernungKm: entfernung,
        maxRadius: config.radiusKm,
        bewertung: hw.bewertung_avg ?? 3.0,
        istRoutenBonus: false,
        dringlichkeit: "notfall",
      })
      imRadius.push({
        id: hw.id,
        score,
        entfernungKm: Math.round(entfernung * 100) / 100,
        fahrzeitMin: schaetzeFahrzeitMin(entfernung),
        stundensatz: hw.basis_stundensatz ?? hw.basis_preis ?? DEFAULT_STUNDENSATZ,
      })
    }

    if (imRadius.length === 0) {
      return NextResponse.json(
        {
          error: `Kein Handwerker im ${config.radiusKm} km-Radius verfügbar`,
          empfehlung: "Radius erweitern oder Dringlichkeit auf 'zeitnah' setzen",
        },
        { status: 422 },
      )
    }

    // Tie-Break über Erfahrung (auftraege_anzahl) für Top-Score-Gleichstand
    const { data: erfahrungen } = await supabase
      .from("profiles")
      .select("id, auftraege_anzahl")
      .in("id", imRadius.map(h => h.id))
      .returns<Array<{ id: string; auftraege_anzahl: number | null }>>()
    const erfahrungById = new Map((erfahrungen ?? []).map(e => [e.id, e.auftraege_anzahl ?? 0]))

    imRadius.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (erfahrungById.get(b.id) ?? 0) - (erfahrungById.get(a.id) ?? 0)
    })
    const top = imRadius[0]
    const auftragswert = Math.round(top.stundensatz * DEFAULT_NOTFALL_STUNDEN * 100) / 100

    // Synthetisches Angebot anlegen (status=angenommen)
    await supabase.from("angebote").upsert(
      {
        ticket_id: ticketId,
        handwerker_id: top.id,
        preis: auftragswert,
        nachricht: "Auto-Match (Notfall)",
        status: "angenommen",
        smart_score: top.score,
        entfernung_km: top.entfernungKm,
        fahrzeit_min: top.fahrzeitMin,
        ist_routen_bonus: false,
      },
      { onConflict: "ticket_id,handwerker_id" },
    )

    // Ticket vergeben
    await supabase
      .from("tickets")
      .update({
        dringlichkeit,
        surge_faktor: config.surgeFaktor,
        auktion_start: start.toISOString(),
        auktion_ende: null,
        status: "in_bearbeitung",
        zugewiesener_hw: top.id,
        kosten_final: auftragswert,
      })
      .eq("id", ticketId)

    // Provisions-Snapshot mit Notfall-Surge
    const isEarlyAdopter = !!profile.early_adopter_bis &&
      new Date(profile.early_adopter_bis).getTime() > Date.now()
    const { finalRate } = effektiveProvisionsRate(0.05, config.surgeFaktor, isEarlyAdopter)
    const calc = calculateCommission(auftragswert, finalRate)
    await supabase.from("provisionen").upsert(
      {
        ticket_id: ticketId,
        verwalter_id: user.id,
        handwerker_id: top.id,
        auftragswert,
        provision_rate: finalRate,
        provision_betrag: calc.provisionBetrag,
        gesamt: calc.gesamt,
        is_early_adopter: isEarlyAdopter,
      },
      { onConflict: "ticket_id" },
    )

    // Termin am heutigen Tag, 1h-Fenster ab jetzt
    const heute = start.toISOString().slice(0, 10)
    const startMin = start.getHours() * 60 + start.getMinutes()
    const von = `${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`
    const endMin = Math.min(startMin + 60, 23 * 60 + 59)
    const bis = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`
    await supabase.from("termine").insert({
      handwerker_id: top.id,
      ticket_id: ticketId,
      titel: `Notfall: ${ticket.titel}`,
      datum: heute,
      von,
      bis,
      einsatzort_adresse: ticket.einsatzort_adresse,
      einsatzort_lat: ticket.einsatzort_lat,
      einsatzort_lng: ticket.einsatzort_lng,
    })

    // Tagesplan-Sync (best-effort)
    await fuegeTicketZuTagesplan(supabase, top.id, ticketId, heute)

    // Fire-and-forget: Zuschlag-Mail an den auto-zugewiesenen Handwerker
    void (async () => {
      const { data: hw } = await supabase
        .from("profiles")
        .select("email, name")
        .eq("id", top.id)
        .single<{ email: string | null; name: string | null }>()
      if (!hw?.email) return
      const { subject, html } = zuschlagEmail({
        handwerkerName: hw.name || "Handwerker",
        ticketTitel: `🔴 Notfall: ${ticket.titel}`,
        ticketBeschreibung: "Direktauftrag (Notfall-Match) — bitte umgehend kontaktieren.",
        einsatzort: ticket.einsatzort_adresse || "",
        angebotPreis: auftragswert,
        ticketId: ticket.id,
      })
      sendEmailFireAndForget({ to: hw.email, subject, html })
    })().catch(err => console.error("[Email] Notfall-Zuschlag-Mail fehlgeschlagen:", err))

    return NextResponse.json({
      ok: true,
      ticketId,
      dringlichkeit,
      modus: "notfall-direkt",
      handwerkerId: top.id,
      smartScore: top.score,
      entfernungKm: top.entfernungKm,
      fahrzeitMin: top.fahrzeitMin,
      auftragswert,
      surgeFaktor: config.surgeFaktor,
      provisionRate: finalRate,
      provisionBetrag: calc.provisionBetrag,
      gesamt: calc.gesamt,
      isEarlyAdopter,
      hinweis: `Auftragswert basiert auf ${top.stundensatz}€/h × ${DEFAULT_NOTFALL_STUNDEN}h. kosten_final kann angepasst werden.`,
    })
  }

  // === Zeitnah / Planbar: normale Auktion ===
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

  // Fire-and-forget: Einladungs-Mails an passende Handwerker im Radius
  void (async () => {
    let query = supabase
      .from("profiles")
      .select("id, email, name, gewerk, startort_lat, startort_lng, lat, lng, radius_km")
      .eq("rolle", "handwerker")
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
        ticketTitel: ticket.titel,
        ticketBeschreibung: ticket.beschreibung || "",
        gewerk: ticket.gewerk || "allgemein",
        dringlichkeit,
        einsatzort: ticket.einsatzort_adresse || "",
        distanzKm: distanz,
        auktionEnde: auktionEndeFormatiert,
        ticketId: ticket.id,
      })
      sendEmailFireAndForget({ to: hw.email, subject, html })
    }
  })().catch(err => console.error("[Email] Einladungs-Mails fehlgeschlagen:", err))

  return NextResponse.json({
    ok: true,
    ticketId,
    dringlichkeit,
    modus: "auktion",
    radiusKm: config.radiusKm,
    surgeFaktor: config.surgeFaktor,
    auktionsDauerStunden: config.auktionsDauerStunden,
    auktionsEnde: ende?.toISOString() ?? null,
    antwortzielText: config.antwortzielText,
  })
}
