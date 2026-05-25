import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { reScoreTicket } from "@/lib/auction/scoring-pipeline"
import {
  effektiveProvisionsRate,
} from "@/lib/auction/auction-manager"
import { calculateCommission } from "@/lib/pricing/commission"
import { fuegeTicketZuTagesplan } from "@/lib/auction/routen-planung-sync"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { zuschlagEmail, absageEmail } from "@/lib/email/templates"
import { getDiagnosePreis } from "@/lib/diagnose/preise"
import { logTicketEvent } from "@/lib/audit/logTicketEvent"

// POST /api/auction/close
// Body: { ticket_id, angebot_id? }
// - Wenn angebot_id gesetzt: Verwalter wählt manuell.
// - Sonst: Auto-Pick = Bid mit höchstem Smart-Score (Tie-Break Erfahrung).
//   Sonderfall: Wenn vorkaufsrecht_bis aktiv und Diagnose-HW dabei →
//   der gewinnt unabhängig vom Score.
// - Wenn Projekt-Ticket aus Diagnose und Diagnose-HW gewinnt:
//   Diagnosegebühr wird vom Auftragswert abgezogen
//   (kosten_final = preis − diagnose_preis), diagnosegebuehr_angerechnet=true.
// Auth: Verwalter (oder Admin), erstellt_von des Tickets.
export async function POST(request: NextRequest) {
  let body: { ticket_id?: string; angebot_id?: string }
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle, early_adopter_bis")
    .eq("id", user.id)
    .single()
  if (!profile || (profile.rolle !== "verwalter" && profile.rolle !== "admin")) {
    return NextResponse.json({ error: "Nur Verwalter dürfen Auktionen schließen" }, { status: 403 })
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, titel, beschreibung, einsatzort_adresse, erstellt_von, verwalter_id, status, surge_faktor, gewerk, ticket_typ, diagnose_ticket_id, vorkaufsrecht_bis")
    .eq("id", ticketId)
    .single<{
      id: string
      titel: string
      beschreibung: string | null
      einsatzort_adresse: string | null
      erstellt_von: string
      verwalter_id: string | null
      status: string
      surge_faktor: number | null
      gewerk: string | null
      ticket_typ: string | null
      diagnose_ticket_id: string | null
      vorkaufsrecht_bis: string | null
    }>()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.verwalter_id !== user.id && profile.rolle !== "admin") {
    return NextResponse.json({ error: "Nicht dein Ticket" }, { status: 403 })
  }
  if (ticket.status !== "auktion") {
    return NextResponse.json({ error: "Auktion nicht aktiv" }, { status: 422 })
  }

  const admin = createServiceRoleClient()

  // Stelle sicher dass Smart-Scores aktuell sind
  await reScoreTicket(admin, ticketId)

  // Diagnose-HW herausfinden (für Vorkaufsrecht + Anrechnung)
  let diagnoseHwId: string | null = null
  if (ticket.diagnose_ticket_id) {
    const { data: diag } = await supabase
      .from("tickets")
      .select("zugewiesener_hw")
      .eq("id", ticket.diagnose_ticket_id)
      .single<{ zugewiesener_hw: string | null }>()
    diagnoseHwId = diag?.zugewiesener_hw ?? null
  }

  const vorkaufsrechtAktiv = !!ticket.vorkaufsrecht_bis &&
    new Date(ticket.vorkaufsrecht_bis).getTime() > Date.now()

  let pickedAngebotId = body.angebot_id

  if (!pickedAngebotId) {
    // Auto-Pick
    const { data: bids } = await supabase
      .from("angebote")
      .select("id, handwerker_id, preis, smart_score, handwerker:profiles(auftraege_anzahl)")
      .eq("ticket_id", ticketId)
      .eq("status", "eingereicht")
      .returns<Array<{
        id: string
        handwerker_id: string
        preis: number
        smart_score: number | null
        handwerker: { auftraege_anzahl: number | null } | null
      }>>()

    if (!bids || bids.length === 0) {
      return NextResponse.json(
        { error: "Keine Angebote vorhanden" },
        { status: 422 },
      )
    }

    // Vorkaufsrecht: Wenn aktiv und Diagnose-HW dabei → er gewinnt
    let vorkaufsrechtTriggered = false
    if (vorkaufsrechtAktiv && diagnoseHwId) {
      const diagBid = bids.find(b => b.handwerker_id === diagnoseHwId)
      if (diagBid) {
        pickedAngebotId = diagBid.id
        vorkaufsrechtTriggered = true
      }
    }

    if (!vorkaufsrechtTriggered) {
      const sortiert = [...bids].sort((a, b) => {
        const sa = a.smart_score ?? 0
        const sb = b.smart_score ?? 0
        if (sb !== sa) return sb - sa
        return (b.handwerker?.auftraege_anzahl ?? 0) - (a.handwerker?.auftraege_anzahl ?? 0)
      })
      pickedAngebotId = sortiert[0].id
    }
  }

  const { data: angebot } = await supabase
    .from("angebote")
    .select("id, ticket_id, handwerker_id, preis, fruehester_termin")
    .eq("id", pickedAngebotId)
    .eq("ticket_id", ticketId)
    .single<{
      id: string
      ticket_id: string
      handwerker_id: string
      preis: number
      fruehester_termin: string | null
    }>()
  if (!angebot) {
    return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 })
  }

  // Diagnosegebühr-Anrechnung wenn Projekt-Ticket aus Diagnose UND
  // der Gewinner === Diagnose-HW.
  let kostenFinal = angebot.preis
  let diagnoseGebuehrAngerechnet = false
  let diagnosePreis = 0
  if (
    ticket.ticket_typ === "projekt" &&
    ticket.diagnose_ticket_id &&
    diagnoseHwId &&
    angebot.handwerker_id === diagnoseHwId
  ) {
    diagnosePreis = await getDiagnosePreis(supabase, ticket.gewerk)
    kostenFinal = Math.max(0, Math.round((angebot.preis - diagnosePreis) * 100) / 100)
    diagnoseGebuehrAngerechnet = true
  }

  // Vergabe-Mutationen
  const { error: ticketUpdateErr } = await admin
    .from("tickets")
    .update({
      status: "in_bearbeitung",
      zugewiesener_hw: angebot.handwerker_id,
      kosten_final: kostenFinal,
      diagnosegebuehr_angerechnet: diagnoseGebuehrAngerechnet || undefined,
    })
    .eq("id", ticketId)
  if (ticketUpdateErr) {
    return NextResponse.json({ error: "Ticket-Vergabe fehlgeschlagen: " + ticketUpdateErr.message }, { status: 500 })
  }

  const { error: angebotAnnehmenErr } = await admin
    .from("angebote")
    .update({ status: "angenommen" })
    .eq("id", angebot.id)
  if (angebotAnnehmenErr) {
    return NextResponse.json({ error: "Angebot-Annahme fehlgeschlagen: " + angebotAnnehmenErr.message }, { status: 500 })
  }

  const { error: angeboteAblehnenErr } = await admin
    .from("angebote")
    .update({ status: "abgelehnt" })
    .eq("ticket_id", ticketId)
    .neq("id", angebot.id)
  if (angeboteAblehnenErr) {
    return NextResponse.json({ error: "Andere Angebote konnten nicht abgelehnt werden: " + angeboteAblehnenErr.message }, { status: 500 })
  }

  // Provisions-Snapshot — auf kostenFinal (= Restzahlung wenn Diagnose-Anrechnung)
  const surge = ticket.surge_faktor ?? 1.0
  const isEarlyAdopter = !!profile.early_adopter_bis &&
    new Date(profile.early_adopter_bis).getTime() > Date.now()
  const { finalRate } = effektiveProvisionsRate(0.05, surge, isEarlyAdopter)
  const calc = calculateCommission(kostenFinal, finalRate)

  // Sprint AA Hotfix — Vergabe-Regression (25.05.2026):
  // public.provisionen hat (noch) keinen UNIQUE-Constraint auf ticket_id,
  // also kann onConflict-Upsert mit 42P10 failen ("ON CONFLICT
  // specification doesn't match any constraint"). Migration
  // 20260605000090 ergänzt den Constraint — solange die nicht
  // angewandt ist, machen wir manuell delete-then-insert.
  const provisionRow = {
    ticket_id: ticketId,
    verwalter_id: ticket.verwalter_id ?? user.id,
    handwerker_id: angebot.handwerker_id,
    auftragswert: kostenFinal,
    provision_rate: finalRate,
    provision_betrag: calc.provisionBetrag,
    gesamt: calc.gesamt,
    is_early_adopter: isEarlyAdopter,
  }
  let { error: provisionErr } = await admin.from("provisionen").upsert(
    provisionRow,
    { onConflict: "ticket_id" },
  )
  if (provisionErr && /ON CONFLICT|no.*unique|42P10/i.test(provisionErr.message)) {
    // Migration 20260605000090 noch nicht angewandt — Fallback:
    // existierende Row löschen, dann neue inserten. ticket_id ist FK
    // mit ON DELETE CASCADE in der Gegenrichtung; manuelles delete
    // hier ist sicher (kein Cascade von provisionen aus).
    await admin.from("provisionen").delete().eq("ticket_id", ticketId)
    const insertResult = await admin.from("provisionen").insert(provisionRow)
    provisionErr = insertResult.error
  }
  if (provisionErr) {
    return NextResponse.json({ error: "Provisions-Snapshot fehlgeschlagen: " + provisionErr.message }, { status: 500 })
  }

  // Tagesplan aktualisieren — best-effort, blockiert die Vergabe nicht
  let plannerStatus: string | undefined
  if (angebot.fruehester_termin) {
    const result = await fuegeTicketZuTagesplan(
      admin,
      angebot.handwerker_id,
      ticketId,
      angebot.fruehester_termin,
    )
    if (!result.ok) plannerStatus = result.skipped

    // KAL-2: Automatischer Termin im HW-Kalender. Default-Block 4h ab 09:00.
    // Service-Role weil das im Namen des HW geschieht.
    void admin.from("termine").insert({
      handwerker_id: angebot.handwerker_id,
      ticket_id: ticketId,
      titel: `Auftrag: ${ticket.titel}`,
      datum: angebot.fruehester_termin,
      von: "09:00",
      bis: "13:00",
      einsatzort_adresse: ticket.einsatzort_adresse ?? null,
      notizen: "Auto-erstellt bei Auftragsvergabe",
    }).then(({ error }) => {
      if (error) console.warn("[close] Auto-Termin fail:", error.message)
    })
  } else {
    plannerStatus = "kein-termin"
  }

  // Fire-and-forget: Zuschlag-Mail an Gewinner + Absage-Mails an andere
  void (async () => {
    const { data: gewinnerProfil } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("id", angebot.handwerker_id)
      .single<{ email: string | null; name: string | null }>()
    if (gewinnerProfil?.email) {
      const { subject, html } = zuschlagEmail({
        handwerkerName: gewinnerProfil.name || "Handwerker",
        ticketTitel: ticket.titel,
        ticketBeschreibung: ticket.beschreibung || "",
        einsatzort: ticket.einsatzort_adresse || "",
        angebotPreis: angebot.preis,
        ticketId: ticket.id,
      })
      sendEmailFireAndForget({ to: gewinnerProfil.email, subject, html })
    }

    const { data: andere } = await supabase
      .from("angebote")
      .select("handwerker_id, handwerker:profiles(email, name)")
      .eq("ticket_id", ticket.id)
      .neq("id", angebot.id)
      .returns<Array<{
        handwerker_id: string
        handwerker: { email: string | null; name: string | null } | null
      }>>()
    for (const a of andere ?? []) {
      const email = a.handwerker?.email
      if (!email) continue
      const { subject, html } = absageEmail({
        handwerkerName: a.handwerker?.name || "Handwerker",
        ticketTitel: ticket.titel,
      })
      sendEmailFireAndForget({ to: email, subject, html })
    }
  })().catch(err => console.error("[Email] close-Mails fehlgeschlagen:", err))

  // Sprint T MVP — Audit-Trail
  void logTicketEvent({
    ticketId,
    eventType: "auktion_geschlossen",
    actorUserId: user.id,
    actorRole: profile.rolle,
    eventData: {
      angebot_id: angebot.id,
      handwerker_id: angebot.handwerker_id,
      preis_brutto: angebot.preis,
      kosten_final: kostenFinal,
      provision_rate: finalRate,
      vorkaufsrecht_aktiv: vorkaufsrechtAktiv,
    },
    request,
  })

  return NextResponse.json({
    ok: true,
    ticketId,
    angebotId: angebot.id,
    handwerkerId: angebot.handwerker_id,
    auftragswert: angebot.preis,
    kostenFinal,
    diagnoseGebuehrAngerechnet,
    diagnosePreisAngerechnet: diagnoseGebuehrAngerechnet ? diagnosePreis : 0,
    provisionRate: finalRate,
    provisionBetrag: calc.provisionBetrag,
    gesamt: calc.gesamt,
    surgeFaktor: surge,
    isEarlyAdopter,
    plannerStatus,
    vorkaufsrechtAktiv,
  })
}
