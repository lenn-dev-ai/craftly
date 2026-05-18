import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { reScoreTicket } from "@/lib/auction/scoring-pipeline"
import { effektiveProvisionsRate } from "@/lib/auction/auction-manager"
import { calculateCommission } from "@/lib/pricing/commission"
import { fuegeTicketZuTagesplan } from "@/lib/auction/routen-planung-sync"
import { sendEmailFireAndForget } from "@/lib/email/send"
import {
  auktionAbgelaufenEmail,
  zuschlagEmail,
  absageEmail,
} from "@/lib/email/templates"

// POST /api/auction/check-expired
// Cron-Endpoint. Geht über alle Tickets mit status='auktion' und
// abgelaufenem auktion_ende und macht zwei Dinge:
//   1) wenn Bids vorliegen → re-scoring + Auto-Vergabe an Top-Smart-Score
//      (Provision-Snapshot, Termin, routen_planung-Sync)
//   2) ohne Bids → Status zurück auf 'offen', Verwalter muss manuell handeln
//
// Schutz: x-cron-secret oder Admin-Auth.

interface AbgelaufenesTicket {
  id: string
  titel: string
  erstellt_von: string
  verwalter_id: string | null
  surge_faktor: number | null
  auktion_ende: string | null
}

interface BidZeile {
  id: string
  handwerker_id: string
  preis: number
  smart_score: number | null
  fruehester_termin: string | null
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authViaSecret =
    !!cronSecret && request.headers.get("x-cron-secret") === cronSecret

  // FIX-1: Im Cron-Pfad (Secret-Auth) Service-Role nutzen — sonst greift
  // RLS und die tickets-Query unten findet 0 Rows (kein User-Kontext) →
  // Auktionen werden nie automatisch geschlossen.
  // Im Admin-Pfad bleibt der User-Client (RLS+Admin-Policy fängt das auf).
  // H1: Admin-Pfad nutzt den getUserFromRequest-Helper (Bearer-Token).
  let supabase
  if (authViaSecret) {
    supabase = createServiceRoleClient()
  } else {
    const r = await getUserFromRequest(request)
    supabase = r.supabase
    if (!r.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase
      .from("profiles")
      .select("rolle")
      .eq("id", r.user.id)
      .single()
    if (profile?.rolle !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const jetzt = new Date().toISOString()
  const { data: abgelaufen } = await supabase
    .from("tickets")
    .select("id, titel, beschreibung, einsatzort_adresse, erstellt_von, verwalter_id, surge_faktor, auktion_ende")
    .eq("status", "auktion")
    .lt("auktion_ende", jetzt)
    .returns<Array<AbgelaufenesTicket & {
      beschreibung: string | null
      einsatzort_adresse: string | null
    }>>()

  const ergebnisse: Array<{
    ticketId: string
    titel: string
    aktion: "vergeben" | "zurueck-auf-offen" | "fehler"
    handwerkerId?: string
    auftragswert?: number
    provisionBetrag?: number
    fehler?: string
  }> = []

  for (const ticket of abgelaufen ?? []) {
    // Re-Scoring vor Vergabe (Sicherheit)
    await reScoreTicket(supabase, ticket.id)

    const { data: bids } = await supabase
      .from("angebote")
      .select("id, handwerker_id, preis, smart_score, fruehester_termin")
      .eq("ticket_id", ticket.id)
      .eq("status", "eingereicht")
      .returns<BidZeile[]>()

    if (!bids || bids.length === 0) {
      // Keine Angebote → Status zurück auf 'offen', Verwalter benachrichtigen
      await supabase
        .from("tickets")
        .update({ status: "offen", auktion_ende: null })
        .eq("id", ticket.id)
      ergebnisse.push({
        ticketId: ticket.id,
        titel: ticket.titel,
        aktion: "zurueck-auf-offen",
      })
      // Fire-and-forget: Verwalter informieren
      // (verwalter_id = zuständiger Auftraggeber, M-K3; Fallback erstellt_von)
      void (async () => {
        const { data: verwalter } = await supabase
          .from("profiles")
          .select("email, name")
          .eq("id", ticket.verwalter_id ?? ticket.erstellt_von)
          .single<{ email: string | null; name: string | null }>()
        if (!verwalter?.email) return
        const { subject, html } = auktionAbgelaufenEmail({
          verwalterName: verwalter.name || "Verwalter",
          ticketTitel: ticket.titel,
          angebotAnzahl: 0,
          ticketId: ticket.id,
        })
        sendEmailFireAndForget({ to: verwalter.email, subject, html })
      })().catch(err => console.error("[Email] Auktion-leer-Mail fehlgeschlagen:", err))
      continue
    }

    // Tie-Break über Erfahrung
    const { data: erfahrungen } = await supabase
      .from("profiles")
      .select("id, auftraege_anzahl")
      .in("id", bids.map(b => b.handwerker_id))
      .returns<Array<{ id: string; auftraege_anzahl: number | null }>>()
    const erfahrungById = new Map(
      (erfahrungen ?? []).map(e => [e.id, e.auftraege_anzahl ?? 0]),
    )

    const sortiert = [...bids].sort((a, b) => {
      const sa = a.smart_score ?? 0
      const sb = b.smart_score ?? 0
      if (sb !== sa) return sb - sa
      return (erfahrungById.get(b.handwerker_id) ?? 0) -
             (erfahrungById.get(a.handwerker_id) ?? 0)
    })
    const winner = sortiert[0]

    // Vergabe-Mutationen
    await supabase
      .from("tickets")
      .update({
        status: "in_bearbeitung",
        zugewiesener_hw: winner.handwerker_id,
        kosten_final: winner.preis,
      })
      .eq("id", ticket.id)

    await supabase
      .from("angebote")
      .update({ status: "angenommen" })
      .eq("id", winner.id)

    await supabase
      .from("angebote")
      .update({ status: "abgelehnt" })
      .eq("ticket_id", ticket.id)
      .neq("id", winner.id)

    // Provisions-Snapshot mit Surge.
    // Verwalter-Kontext (early_adopter_bis) aus profiles.
    const { data: verwalter } = await supabase
      .from("profiles")
      .select("early_adopter_bis")
      .eq("id", ticket.verwalter_id ?? ticket.erstellt_von)
      .single<{ early_adopter_bis: string | null }>()
    const isEarlyAdopter = !!verwalter?.early_adopter_bis &&
      new Date(verwalter.early_adopter_bis).getTime() > Date.now()
    const surge = ticket.surge_faktor ?? 1.0
    const { finalRate } = effektiveProvisionsRate(0.05, surge, isEarlyAdopter)
    const calc = calculateCommission(winner.preis, finalRate)

    await supabase.from("provisionen").upsert(
      {
        ticket_id: ticket.id,
        verwalter_id: ticket.verwalter_id ?? ticket.erstellt_von,
        handwerker_id: winner.handwerker_id,
        auftragswert: winner.preis,
        provision_rate: finalRate,
        provision_betrag: calc.provisionBetrag,
        gesamt: calc.gesamt,
        is_early_adopter: isEarlyAdopter,
      },
      { onConflict: "ticket_id" },
    )

    // Termin und Routen-Sync (best-effort)
    if (winner.fruehester_termin) {
      await supabase.from("termine").insert({
        handwerker_id: winner.handwerker_id,
        ticket_id: ticket.id,
        titel: ticket.titel,
        datum: winner.fruehester_termin,
        von: "09:00",
        bis: "12:00",
      })
      await fuegeTicketZuTagesplan(
        supabase,
        winner.handwerker_id,
        ticket.id,
        winner.fruehester_termin,
      )
    }

    ergebnisse.push({
      ticketId: ticket.id,
      titel: ticket.titel,
      aktion: "vergeben",
      handwerkerId: winner.handwerker_id,
      auftragswert: winner.preis,
      provisionBetrag: calc.provisionBetrag,
    })

    // Fire-and-forget: Zuschlag an Gewinner + Absagen an andere
    void (async () => {
      const { data: gewinnerProfil } = await supabase
        .from("profiles")
        .select("email, name")
        .eq("id", winner.handwerker_id)
        .single<{ email: string | null; name: string | null }>()
      if (gewinnerProfil?.email) {
        const { subject, html } = zuschlagEmail({
          handwerkerName: gewinnerProfil.name || "Handwerker",
          ticketTitel: ticket.titel,
          ticketBeschreibung: ticket.beschreibung || "",
          einsatzort: ticket.einsatzort_adresse || "",
          angebotPreis: winner.preis,
          ticketId: ticket.id,
        })
        sendEmailFireAndForget({ to: gewinnerProfil.email, subject, html })
      }

      const { data: andere } = await supabase
        .from("angebote")
        .select("handwerker_id, handwerker:profiles(email, name)")
        .eq("ticket_id", ticket.id)
        .neq("id", winner.id)
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
    })().catch(err => console.error("[Email] check-expired-Vergabe-Mails fehlgeschlagen:", err))
  }

  // ============================================================
  // Diagnose-Tickets ohne HW-Übernahme nach 14 Tagen → zurück auf 'offen'
  // ============================================================
  // Sub-Block für M-K2: Diagnose-Tickets nutzen kein auktion_ende, sondern
  // diagnose_ablauf. Wenn die Frist erreicht ist und noch niemand
  // übernommen hat, fällt das Ticket in den 'offen'-Status zurück und der
  // Verwalter entscheidet manuell (z. B. neue Frist setzen oder
  // Standard-Auktion starten).
  const admin = createServiceRoleClient()
  const { data: abgelaufeneDiagnosen } = await admin
    .from("tickets")
    .select("id, titel, erstellt_von, verwalter_id")
    .eq("ticket_typ", "diagnose")
    .eq("status", "auktion")
    .is("zugewiesener_hw", null)
    .lt("diagnose_ablauf", jetzt)
    .returns<Array<{ id: string; titel: string; erstellt_von: string; verwalter_id: string | null }>>()

  const diagnoseErgebnisse: Array<{ ticketId: string; titel: string }> = []
  for (const t of abgelaufeneDiagnosen ?? []) {
    await admin
      .from("tickets")
      .update({
        status: "offen",
        ticket_typ: "standard", // Mieter kann später neu wählen
        diagnose_ablauf: null,
      })
      .eq("id", t.id)
    diagnoseErgebnisse.push({ ticketId: t.id, titel: t.titel })

    void (async () => {
      const { data: erst } = await admin
        .from("profiles")
        .select("email, name")
        .eq("id", t.verwalter_id ?? t.erstellt_von)
        .single<{ email: string | null; name: string | null }>()
      if (!erst?.email) return
      const { subject, html } = auktionAbgelaufenEmail({
        verwalterName: erst.name || "Verwalter",
        ticketTitel: `Diagnose-Termin verfallen: ${t.titel}`,
        angebotAnzahl: 0,
        ticketId: t.id,
      })
      sendEmailFireAndForget({ to: erst.email, subject, html })
    })().catch(err => console.error("[Email] Diagnose-Ablauf-Mail fehlgeschlagen:", err))
  }

  return NextResponse.json({
    ok: true,
    jetzt,
    anzahl: abgelaufen?.length ?? 0,
    vergeben: ergebnisse.filter(r => r.aktion === "vergeben").length,
    zurueck: ergebnisse.filter(r => r.aktion === "zurueck-auf-offen").length,
    diagnosenAbgelaufen: diagnoseErgebnisse.length,
    ergebnisse,
    diagnoseErgebnisse,
  })
}
