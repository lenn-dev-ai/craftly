import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { effektiveProvisionsRate } from "@/lib/auction/auction-manager"
import { calculateCommission } from "@/lib/pricing/commission"
import { fuegeTicketZuTagesplan } from "@/lib/auction/routen-planung-sync"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { logTicketEvent } from "@/lib/audit/logTicketEvent"

// POST /api/einladungen/[id]/annehmen
// Body: { fruehester_termin?: string (YYYY-MM-DD), geschaetzte_dauer?: string, nachricht?: string }
// Sprint AM Phase 2 (AM-Phase2d) — Handwerker nimmt eine
// Direktvergabe-Anfrage zum vorgeschlagenen Preis (einladungen.empfohlener_preis)
// an. Anders als bei der Mass-Invite-Auktion ist das hier KEIN "Angebot
// abgeben" + späterer Verwalter-Zuschlag, sondern eine direkte 1:1-Vergabe
// in einem Schritt (analog /api/stamm-anfragen/[id]/annehmen).
//
// Effekte:
//   - einladungen.status='offen' -> 'angebot' (markiert als "umgesetzt")
//   - andere noch 'offen' einladungen desselben Tickets -> 'abgelehnt'
//     (Aufräumen, falls parallel ein Mass-Invite-Fallback lief)
//   - angebote-Zeile (status='angenommen') zum vorgeschlagenen Preis
//   - tickets.status -> 'in_bearbeitung', zugewiesener_hw, kosten_final
//   - Provision-Snapshot (surge_faktor des Tickets, Early-Adopter-Check)
//   - Optional Tagesplan-Eintrag + Auto-Termin wenn fruehester_termin gesetzt
//   - Audit-Log 'vergeben'
//   - Email an Verwalter (best-effort)
//
// Race-Conditions (Cron "direktvergabe-eskalation" kann parallel
// eskalieren): beide kritischen Updates (einladungen, tickets) laufen mit
// `.eq("status", "...")`-Bedingung + `.select()`, sodass ein "verlorenes
// Rennen" als leeres Ergebnis erkannt wird (-> 409). Zusätzlich wird
// geprüft, dass der anfragende HW noch tickets.direktvergabe_kandidaten[
// direktvergabe_index] entspricht.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { fruehester_termin?: string; geschaetzte_dauer?: string; nachricht?: string }
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    body = {}
  }

  const admin = createServiceRoleClient()

  const { data: einladung } = await admin
    .from("einladungen")
    .select("id, ticket_id, handwerker_id, status, empfohlener_preis")
    .eq("id", params.id)
    .maybeSingle<{
      id: string
      ticket_id: string
      handwerker_id: string
      status: string
      empfohlener_preis: number | null
    }>()

  if (!einladung) return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 })
  if (einladung.handwerker_id !== user.id) {
    return NextResponse.json({ error: "Nur der eingeladene Handwerker darf annehmen" }, { status: 403 })
  }
  if (einladung.status !== "offen") {
    return NextResponse.json({ error: `Einladung bereits ${einladung.status}` }, { status: 422 })
  }

  const preis = einladung.empfohlener_preis
  if (!preis || !Number.isFinite(preis) || preis <= 0) {
    return NextResponse.json({ error: "Einladung hat keinen gültigen Preis" }, { status: 422 })
  }

  const { data: ticket } = await admin
    .from("tickets")
    .select("id, titel, beschreibung, einsatzort_adresse, verwalter_id, erstellt_von, status, surge_faktor, direktvergabe_kandidaten, direktvergabe_index")
    .eq("id", einladung.ticket_id)
    .maybeSingle<{
      id: string
      titel: string
      beschreibung: string | null
      einsatzort_adresse: string | null
      verwalter_id: string | null
      erstellt_von: string
      status: string
      surge_faktor: number | null
      direktvergabe_kandidaten: Array<{ hw_id: string; score: number; preis: number }> | null
      direktvergabe_index: number
    }>()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.status !== "offen") {
    return NextResponse.json({ error: `Ticket bereits ${ticket.status} — Anfrage nicht mehr aktuell` }, { status: 422 })
  }

  // Defense-in-Depth gegen Race mit Cron "direktvergabe-eskalation": wenn
  // die Kette bereits weitergesprungen ist, ist diese Anfrage nicht mehr
  // der aktuelle Kandidat.
  if (ticket.direktvergabe_kandidaten) {
    const aktuellerKandidat = ticket.direktvergabe_kandidaten[ticket.direktvergabe_index]
    if (!aktuellerKandidat || aktuellerKandidat.hw_id !== user.id) {
      return NextResponse.json(
        { error: "Diese Anfrage ist nicht mehr aktuell (bereits eskaliert)" },
        { status: 409 },
      )
    }
  }

  // 1. Einladung "umsetzen" — conditional Update als Lock gegen Race.
  const { data: einlUpdated, error: einlErr } = await admin
    .from("einladungen")
    .update({ status: "angebot" })
    .eq("id", einladung.id)
    .eq("status", "offen")
    .select("id")
  if (einlErr) {
    return NextResponse.json({ error: einlErr.message }, { status: 500 })
  }
  if (!einlUpdated || einlUpdated.length === 0) {
    return NextResponse.json({ error: "Diese Einladung wurde bereits bearbeitet" }, { status: 409 })
  }

  // 2. Ticket vergeben — ebenfalls conditional als zweite Lock-Schicht.
  const { data: ticketUpdated, error: ticketErr } = await admin
    .from("tickets")
    .update({
      status: "in_bearbeitung",
      zugewiesener_hw: user.id,
      kosten_final: preis,
    })
    .eq("id", ticket.id)
    .eq("status", "offen")
    .select("id")
  if (ticketErr) {
    return NextResponse.json({ error: "Ticket-Vergabe fehlgeschlagen: " + ticketErr.message }, { status: 500 })
  }
  if (!ticketUpdated || ticketUpdated.length === 0) {
    // Race verloren — Einladungs-Update zurückrollen, damit das Ticket
    // konsistent bleibt (Cron hat in der Zwischenzeit vergeben/eskaliert).
    await admin.from("einladungen").update({ status: "offen" }).eq("id", einladung.id)
    return NextResponse.json({ error: "Ticket wurde bereits anderweitig vergeben" }, { status: 409 })
  }

  // 3. Synthetisches Angebot (status=angenommen)
  await admin.from("angebote").upsert(
    {
      ticket_id: ticket.id,
      handwerker_id: user.id,
      preis,
      fruehester_termin: body.fruehester_termin || null,
      geschaetzte_dauer: body.geschaetzte_dauer || null,
      nachricht: body.nachricht || "Direktvergabe-Annahme",
      status: "angenommen",
    },
    { onConflict: "ticket_id,handwerker_id" },
  )

  // 4. Andere noch offene Einladungen desselben Tickets aufräumen
  // (z.B. falls parallel ein Mass-Invite-Fallback lief).
  await admin
    .from("einladungen")
    .update({ status: "abgelehnt" })
    .eq("ticket_id", ticket.id)
    .eq("status", "offen")
    .neq("id", einladung.id)

  // 5. Provisions-Snapshot
  const surge = ticket.surge_faktor ?? 1.0
  let isEarlyAdopter = false
  if (ticket.verwalter_id) {
    const { data: verwalter } = await admin
      .from("profiles")
      .select("early_adopter_bis")
      .eq("id", ticket.verwalter_id)
      .maybeSingle<{ early_adopter_bis: string | null }>()
    isEarlyAdopter = !!verwalter?.early_adopter_bis &&
      new Date(verwalter.early_adopter_bis).getTime() > Date.now()
  }
  const { finalRate } = effektiveProvisionsRate(0.05, surge, isEarlyAdopter)
  const calc = calculateCommission(preis, finalRate)

  const provisionRow = {
    ticket_id: ticket.id,
    verwalter_id: ticket.verwalter_id ?? user.id,
    handwerker_id: user.id,
    auftragswert: preis,
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
    await admin.from("provisionen").delete().eq("ticket_id", ticket.id)
    const insertResult = await admin.from("provisionen").insert(provisionRow)
    provisionErr = insertResult.error
  }
  if (provisionErr) {
    console.error("[einladungen/annehmen] Provisions-Snapshot fehlgeschlagen:", provisionErr.message)
  }

  // 6. Optional Tagesplan + Auto-Termin
  let plannerStatus: string | undefined
  if (body.fruehester_termin) {
    const result = await fuegeTicketZuTagesplan(admin, user.id, ticket.id, body.fruehester_termin)
    if (!result.ok) plannerStatus = result.skipped

    void admin.from("termine").insert({
      handwerker_id: user.id,
      ticket_id: ticket.id,
      titel: `Auftrag: ${ticket.titel}`,
      datum: body.fruehester_termin,
      von: "09:00",
      bis: "13:00",
      einsatzort_adresse: ticket.einsatzort_adresse ?? null,
      notizen: "Auto-erstellt bei Direktvergabe-Annahme",
    }).then(({ error }) => {
      if (error) console.warn("[einladungen/annehmen] Auto-Termin fail:", error.message)
    })
  } else {
    plannerStatus = "kein-termin"
  }

  // 7. Fire-and-forget: Verwalter informieren
  void (async () => {
    if (!ticket.verwalter_id) return
    const [{ data: verwalter }, { data: hw }] = await Promise.all([
      admin.from("profiles").select("email, name").eq("id", ticket.verwalter_id)
        .maybeSingle<{ email: string | null; name: string | null }>(),
      admin.from("profiles").select("name, firma").eq("id", user.id)
        .maybeSingle<{ name: string | null; firma: string | null }>(),
    ])
    if (!verwalter?.email) return
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo.app"
    const preisFormatiert = preis.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    sendEmailFireAndForget({
      to: verwalter.email,
      subject: `Direktanfrage angenommen: ${ticket.titel}`,
      html: `
        <p>Hallo ${verwalter.name || ""},</p>
        <p><strong>${hw?.name || "Ein Handwerker"}</strong>${hw?.firma ? ` (${hw.firma})` : ""} hat deine Direktanfrage für
        <b>${ticket.titel}</b> zum Preis von <b>${preisFormatiert} €</b> angenommen.</p>
        <p>Der Auftrag ist damit vergeben und wechselt in den Status „In Bearbeitung“.</p>
        <p><a href="${baseUrl}/dashboard-verwalter/tickets/${ticket.id}">Ticket öffnen</a></p>
      `,
    })
  })().catch(err => console.error("[einladungen/annehmen] Mail fehlgeschlagen:", err))

  // 8. Audit-Log
  void logTicketEvent({
    ticketId: ticket.id,
    eventType: "vergeben",
    actorUserId: user.id,
    actorRole: "handwerker",
    eventData: { via: "direktvergabe", einladung_id: einladung.id, preis },
    request,
  })

  return NextResponse.json({
    ok: true,
    ticketId: ticket.id,
    handwerkerId: user.id,
    preis,
    provisionRate: finalRate,
    provisionBetrag: calc.provisionBetrag,
    gesamt: calc.gesamt,
    surgeFaktor: surge,
    isEarlyAdopter,
    plannerStatus,
  })
}
