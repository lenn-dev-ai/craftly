import type { NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { effektiveProvisionsRate } from "@/lib/auction/auction-manager"
import { calculateCommission } from "@/lib/pricing/commission"
import { fuegeTicketZuTagesplan } from "@/lib/auction/routen-planung-sync"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { logTicketEvent } from "@/lib/audit/logTicketEvent"
import { eskaliereDirektvergabe } from "@/lib/auction/direktvergabe"

// Geteilte Direktvergabe-Aktionen (Annehmen/Ablehnen einer Einladung).
//
// Hintergrund: Die Logik lag bisher inline in den Routen
// app/api/einladungen/[id]/annehmen + /ablehnen und war an die User-Session
// gebunden. Sie ist hier service-role-basiert und per hwId parametrisiert
// extrahiert, damit sie sowohl von den Routen (Web-UI) als auch vom
// Voice-Assistenten (app/api/vapi/hw-assistant) identisch genutzt werden
// kann — Single Source of Truth, kein Logik-Duplikat.

export interface AktionErgebnis {
  ok: boolean
  status: number
  error?: string
  data?: Record<string, unknown>
}

export interface AnnehmenOpts {
  hwId: string
  einladungId: string
  fruehesterTermin?: string | null
  geschaetzteDauer?: string | null
  nachricht?: string | null
  kanal?: string // z.B. "voice" — landet im Audit-Log
  request?: NextRequest
}

/** Nimmt eine Direktvergabe-Einladung an (1:1-Vergabe zum empfohlenen Preis). */
export async function annehmenEinladung(opts: AnnehmenOpts): Promise<AktionErgebnis> {
  const { hwId, einladungId, request } = opts
  const admin = createServiceRoleClient()

  const { data: einladung } = await admin
    .from("einladungen")
    .select("id, ticket_id, handwerker_id, status, empfohlener_preis")
    .eq("id", einladungId)
    .maybeSingle<{
      id: string; ticket_id: string; handwerker_id: string
      status: string; empfohlener_preis: number | null
    }>()

  if (!einladung) return { ok: false, status: 404, error: "Einladung nicht gefunden" }
  if (einladung.handwerker_id !== hwId) {
    return { ok: false, status: 403, error: "Nur der eingeladene Handwerker darf annehmen" }
  }
  if (einladung.status !== "offen") {
    return { ok: false, status: 422, error: `Einladung bereits ${einladung.status}` }
  }

  const preis = einladung.empfohlener_preis
  if (!preis || !Number.isFinite(preis) || preis <= 0) {
    return { ok: false, status: 422, error: "Einladung hat keinen gültigen Preis" }
  }

  const { data: ticket } = await admin
    .from("tickets")
    .select("id, titel, beschreibung, einsatzort_adresse, verwalter_id, erstellt_von, status, surge_faktor, direktvergabe_kandidaten, direktvergabe_index")
    .eq("id", einladung.ticket_id)
    .maybeSingle<{
      id: string; titel: string; beschreibung: string | null; einsatzort_adresse: string | null
      verwalter_id: string | null; erstellt_von: string; status: string; surge_faktor: number | null
      direktvergabe_kandidaten: Array<{ hw_id: string; score: number; preis: number }> | null
      direktvergabe_index: number
    }>()
  if (!ticket) return { ok: false, status: 404, error: "Ticket nicht gefunden" }
  if (ticket.status !== "offen") {
    return { ok: false, status: 422, error: `Ticket bereits ${ticket.status} — Anfrage nicht mehr aktuell` }
  }

  // Defense-in-Depth gegen Race mit Cron "direktvergabe-eskalation".
  if (ticket.direktvergabe_kandidaten) {
    const aktuellerKandidat = ticket.direktvergabe_kandidaten[ticket.direktvergabe_index]
    if (!aktuellerKandidat || aktuellerKandidat.hw_id !== hwId) {
      return { ok: false, status: 409, error: "Diese Anfrage ist nicht mehr aktuell (bereits eskaliert)" }
    }
  }

  // 1. Einladung "umsetzen" — conditional Update als Lock gegen Race.
  const { data: einlUpdated, error: einlErr } = await admin
    .from("einladungen")
    .update({ status: "angebot" })
    .eq("id", einladung.id)
    .eq("status", "offen")
    .select("id")
  if (einlErr) return { ok: false, status: 500, error: einlErr.message }
  if (!einlUpdated || einlUpdated.length === 0) {
    return { ok: false, status: 409, error: "Diese Einladung wurde bereits bearbeitet" }
  }

  // 2. Ticket vergeben — ebenfalls conditional als zweite Lock-Schicht.
  const { data: ticketUpdated, error: ticketErr } = await admin
    .from("tickets")
    .update({ status: "in_bearbeitung", zugewiesener_hw: hwId, kosten_final: preis })
    .eq("id", ticket.id)
    .eq("status", "offen")
    .select("id")
  if (ticketErr) {
    return { ok: false, status: 500, error: "Ticket-Vergabe fehlgeschlagen: " + ticketErr.message }
  }
  if (!ticketUpdated || ticketUpdated.length === 0) {
    // Race verloren — Einladungs-Update zurückrollen.
    await admin.from("einladungen").update({ status: "offen" }).eq("id", einladung.id)
    return { ok: false, status: 409, error: "Ticket wurde bereits anderweitig vergeben" }
  }

  // 3. Synthetisches Angebot (status=angenommen)
  await admin.from("angebote").upsert(
    {
      ticket_id: ticket.id,
      handwerker_id: hwId,
      preis,
      fruehester_termin: opts.fruehesterTermin || null,
      geschaetzte_dauer: opts.geschaetzteDauer || null,
      nachricht: opts.nachricht || "Direktvergabe-Annahme",
      status: "angenommen",
    },
    { onConflict: "ticket_id,handwerker_id" },
  )

  // 4. Andere noch offene Einladungen desselben Tickets aufräumen.
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
    verwalter_id: ticket.verwalter_id ?? hwId,
    handwerker_id: hwId,
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
    console.error("[einladung-aktionen/annehmen] Provisions-Snapshot fehlgeschlagen:", provisionErr.message)
  }

  // 6. Optional Tagesplan + Auto-Termin
  let plannerStatus: string | undefined
  if (opts.fruehesterTermin) {
    const result = await fuegeTicketZuTagesplan(admin, hwId, ticket.id, opts.fruehesterTermin)
    if (!result.ok) plannerStatus = result.skipped

    void admin.from("termine").insert({
      handwerker_id: hwId,
      ticket_id: ticket.id,
      titel: `Auftrag: ${ticket.titel}`,
      datum: opts.fruehesterTermin,
      von: "09:00",
      bis: "13:00",
      einsatzort_adresse: ticket.einsatzort_adresse ?? null,
      notizen: "Auto-erstellt bei Direktvergabe-Annahme",
    }).then(({ error }) => {
      if (error) console.warn("[einladung-aktionen/annehmen] Auto-Termin fail:", error.message)
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
      admin.from("profiles").select("name, firma").eq("id", hwId)
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
        <p><a href="${baseUrl}/dashboard-verwalter/ticket/${ticket.id}">Ticket öffnen</a></p>
      `,
    })
  })().catch(err => console.error("[einladung-aktionen/annehmen] Mail fehlgeschlagen:", err))

  // 8. Audit-Log
  void logTicketEvent({
    ticketId: ticket.id,
    eventType: "vergeben",
    actorUserId: hwId,
    actorRole: "handwerker",
    eventData: { via: "direktvergabe", kanal: opts.kanal ?? "web", einladung_id: einladung.id, preis },
    request,
  })

  return {
    ok: true,
    status: 200,
    data: {
      ticketId: ticket.id,
      handwerkerId: hwId,
      titel: ticket.titel,
      preis,
      provisionRate: finalRate,
      provisionBetrag: calc.provisionBetrag,
      gesamt: calc.gesamt,
      surgeFaktor: surge,
      isEarlyAdopter,
      plannerStatus,
    },
  }
}

export interface AblehnenOpts {
  hwId: string
  einladungId: string
  grund?: string | null
  kanal?: string
  request?: NextRequest
}

/** Lehnt eine Direktvergabe-Einladung ab und eskaliert sofort weiter. */
export async function ablehnenEinladung(opts: AblehnenOpts): Promise<AktionErgebnis> {
  const { hwId, einladungId, request } = opts
  const admin = createServiceRoleClient()

  const { data: einladung } = await admin
    .from("einladungen")
    .select("id, ticket_id, handwerker_id, status")
    .eq("id", einladungId)
    .maybeSingle<{ id: string; ticket_id: string; handwerker_id: string; status: string }>()

  if (!einladung) return { ok: false, status: 404, error: "Einladung nicht gefunden" }
  if (einladung.handwerker_id !== hwId) {
    return { ok: false, status: 403, error: "Nur der eingeladene Handwerker darf ablehnen" }
  }
  if (einladung.status !== "offen") {
    return { ok: false, status: 422, error: `Einladung bereits ${einladung.status}` }
  }

  const { data: updated, error: updateErr } = await admin
    .from("einladungen")
    .update({ status: "abgelehnt" })
    .eq("id", einladung.id)
    .eq("status", "offen")
    .select("id")
  if (updateErr) return { ok: false, status: 500, error: updateErr.message }
  if (!updated || updated.length === 0) {
    return { ok: false, status: 409, error: "Diese Einladung wurde bereits bearbeitet (z.B. durch Timeout-Eskalation)" }
  }

  const eskalation = await eskaliereDirektvergabe(einladung.ticket_id)

  void logTicketEvent({
    ticketId: einladung.ticket_id,
    eventType: "status_change",
    actorUserId: hwId,
    actorRole: "handwerker",
    eventData: {
      via: "direktvergabe",
      kanal: opts.kanal ?? "web",
      einladung_id: einladung.id,
      von: "offen",
      auf: "abgelehnt",
      grund: opts.grund || null,
      eskalation: eskalation.ergebnis,
    },
    request,
  })

  return {
    ok: true,
    status: 200,
    data: { ticketId: einladung.ticket_id, status: "abgelehnt", eskalation: eskalation.ergebnis },
  }
}
