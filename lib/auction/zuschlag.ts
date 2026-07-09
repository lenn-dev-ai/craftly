import type { SupabaseClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"
import { effektiveProvisionsRate } from "@/lib/auction/auction-manager"
import { calculateCommission } from "@/lib/pricing/commission"
import { fuegeTicketZuTagesplan } from "@/lib/auction/routen-planung-sync"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { zuschlagEmail, absageEmail } from "@/lib/email/templates"
import { getDiagnosePreis } from "@/lib/diagnose/preise"
import { logTicketEvent } from "@/lib/audit/logTicketEvent"
import { emitEreignis } from "@/lib/cortex/ereignis"

// Zentraler Zuschlag: ein Angebot gewinnt, das Ticket wird vergeben.
// Extrahiert aus /api/auction/close (05.07.), damit derselbe Ablauf an
// allen Vergabe-Stellen läuft — manueller Verwalter-Close UND
// Sofort-Zuschlag bei HW-Annahme (Vollkalkulation: Annahme = Deal).
// Macht: Ticket-Update, Angebots-Status, Provisions-Snapshot,
// Tagesplan + Auto-Termin, Zuschlag-/Absage-Mails, Audit-Event.

export interface ZuschlagErgebnis {
  ok: boolean
  error?: string
  status?: number
  handwerkerId?: string
  kostenFinal?: number
  provisionRate?: number
  provisionBetrag?: number
  gesamt?: number
  diagnoseGebuehrAngerechnet?: boolean
  diagnosePreisAngerechnet?: number
  surgeFaktor?: number
  isEarlyAdopter?: boolean
  plannerStatus?: string
}

interface ZuschlagTicket {
  id: string
  titel: string
  beschreibung: string | null
  einsatzort_adresse: string | null
  erstellt_von: string
  verwalter_id: string | null
  surge_faktor: number | null
  gewerk: string | null
  ticket_typ: string | null
  diagnose_ticket_id: string | null
}

export async function erteileZuschlag(
  admin: SupabaseClient,
  opts: {
    ticket: ZuschlagTicket
    angebotId: string
    // Für den Audit-Trail: wer hat den Zuschlag ausgelöst?
    actor: { userId: string; rolle: string }
    request?: NextRequest
  },
): Promise<ZuschlagErgebnis> {
  const { ticket, angebotId, actor } = opts
  const ticketId = ticket.id

  const { data: angebot } = await admin
    .from("angebote")
    .select("id, ticket_id, handwerker_id, preis, fruehester_termin")
    .eq("id", angebotId)
    .eq("ticket_id", ticketId)
    .single<{
      id: string
      ticket_id: string
      handwerker_id: string
      preis: number
      fruehester_termin: string | null
    }>()
  if (!angebot) {
    return { ok: false, error: "Angebot nicht gefunden", status: 404 }
  }

  // Diagnosegebühr-Anrechnung wenn Projekt-Ticket aus Diagnose UND
  // der Gewinner === Diagnose-HW.
  let diagnoseHwId: string | null = null
  if (ticket.diagnose_ticket_id) {
    const { data: diag } = await admin
      .from("tickets")
      .select("zugewiesener_hw")
      .eq("id", ticket.diagnose_ticket_id)
      .single<{ zugewiesener_hw: string | null }>()
    diagnoseHwId = diag?.zugewiesener_hw ?? null
  }

  let kostenFinal = angebot.preis
  let diagnoseGebuehrAngerechnet = false
  let diagnosePreis = 0
  if (
    ticket.ticket_typ === "projekt" &&
    ticket.diagnose_ticket_id &&
    diagnoseHwId &&
    angebot.handwerker_id === diagnoseHwId
  ) {
    diagnosePreis = await getDiagnosePreis(admin, ticket.gewerk)
    kostenFinal = Math.max(0, Math.round((angebot.preis - diagnosePreis) * 100) / 100)
    diagnoseGebuehrAngerechnet = true
  }

  // Vergabe-Mutationen. Das status-Guard macht den Zuschlag atomar:
  // beim Race (zwei Annahmen fast gleichzeitig) matcht das zweite Update
  // 0 Zeilen und der Zuschlag wird sauber verweigert.
  const { data: updated, error: ticketUpdateErr } = await admin
    .from("tickets")
    .update({
      status: "in_bearbeitung",
      zugewiesener_hw: angebot.handwerker_id,
      kosten_final: kostenFinal,
      diagnosegebuehr_angerechnet: diagnoseGebuehrAngerechnet || undefined,
    })
    .eq("id", ticketId)
    .eq("status", "auktion")
    .select("id")
  if (ticketUpdateErr) {
    return { ok: false, error: "Ticket-Vergabe fehlgeschlagen: " + ticketUpdateErr.message, status: 500 }
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Ticket ist nicht (mehr) in der Vergabe", status: 422 }
  }

  const { error: angebotAnnehmenErr } = await admin
    .from("angebote")
    .update({ status: "angenommen" })
    .eq("id", angebot.id)
  if (angebotAnnehmenErr) {
    return { ok: false, error: "Angebot-Annahme fehlgeschlagen: " + angebotAnnehmenErr.message, status: 500 }
  }

  const { error: angeboteAblehnenErr } = await admin
    .from("angebote")
    .update({ status: "abgelehnt" })
    .eq("ticket_id", ticketId)
    .neq("id", angebot.id)
  if (angeboteAblehnenErr) {
    return { ok: false, error: "Andere Angebote konnten nicht abgelehnt werden: " + angeboteAblehnenErr.message, status: 500 }
  }

  // Provisions-Snapshot — auf kostenFinal (= Restzahlung bei Diagnose-
  // Anrechnung). Early-Adopter-Kontext kommt vom zuständigen Verwalter.
  const verwalterId = ticket.verwalter_id ?? ticket.erstellt_von
  const { data: verwalterProfil } = await admin
    .from("profiles")
    .select("early_adopter_bis")
    .eq("id", verwalterId)
    .single<{ early_adopter_bis: string | null }>()
  const isEarlyAdopter = !!verwalterProfil?.early_adopter_bis &&
    new Date(verwalterProfil.early_adopter_bis).getTime() > Date.now()
  const surge = ticket.surge_faktor ?? 1.0
  const { finalRate } = effektiveProvisionsRate(0.05, surge, isEarlyAdopter)
  const calc = calculateCommission(kostenFinal, finalRate)

  // Sprint AA Hotfix — solange der UNIQUE-Constraint auf ticket_id
  // (Migration 20260605000090) nicht überall angewandt ist, Fallback
  // auf delete-then-insert bei 42P10.
  const provisionRow = {
    ticket_id: ticketId,
    verwalter_id: verwalterId,
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
    await admin.from("provisionen").delete().eq("ticket_id", ticketId)
    const insertResult = await admin.from("provisionen").insert(provisionRow)
    provisionErr = insertResult.error
  }
  if (provisionErr) {
    return { ok: false, error: "Provisions-Snapshot fehlgeschlagen: " + provisionErr.message, status: 500 }
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
      if (error) console.warn("[zuschlag] Auto-Termin fail:", error.message)
    })
  } else {
    plannerStatus = "kein-termin"
  }

  // Fire-and-forget: Zuschlag-Mail an Gewinner + Absage-Mails an andere
  void (async () => {
    const { data: gewinnerProfil } = await admin
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

    const { data: andere } = await admin
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
  })().catch(err => console.error("[Email] zuschlag-Mails fehlgeschlagen:", err))

  // Cortex-Ereignisstrom (best-effort)
  emitEreignis(admin, {
    typ: "zuschlag_erteilt",
    entitaet: "tickets",
    entitaetId: ticketId,
    payload: {
      titel: ticket.titel,
      handwerker_id: angebot.handwerker_id,
      kosten_final: kostenFinal,
      ausgeloest_von: actor.rolle,
    },
  })

  // Sprint T MVP — Audit-Trail
  void logTicketEvent({
    ticketId,
    eventType: "auktion_geschlossen",
    actorUserId: actor.userId,
    actorRole: actor.rolle,
    eventData: {
      angebot_id: angebot.id,
      handwerker_id: angebot.handwerker_id,
      preis_brutto: angebot.preis,
      kosten_final: kostenFinal,
      provision_rate: finalRate,
    },
    request: opts.request,
  })

  return {
    ok: true,
    handwerkerId: angebot.handwerker_id,
    kostenFinal,
    provisionRate: finalRate,
    provisionBetrag: calc.provisionBetrag,
    gesamt: calc.gesamt,
    diagnoseGebuehrAngerechnet,
    diagnosePreisAngerechnet: diagnoseGebuehrAngerechnet ? diagnosePreis : 0,
    surgeFaktor: surge,
    isEarlyAdopter,
    plannerStatus,
  }
}
