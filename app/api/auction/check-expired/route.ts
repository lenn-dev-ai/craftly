import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { reScoreTicket } from "@/lib/auction/scoring-pipeline"
import { effektiveProvisionsRate } from "@/lib/auction/auction-manager"
import { calculateCommission } from "@/lib/pricing/commission"
import { fuegeTicketZuTagesplan } from "@/lib/auction/routen-planung-sync"

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

  const supabase = createServerSupabaseClient()
  if (!authViaSecret) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase
      .from("profiles")
      .select("rolle")
      .eq("id", user.id)
      .single()
    if (profile?.rolle !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const jetzt = new Date().toISOString()
  const { data: abgelaufen } = await supabase
    .from("tickets")
    .select("id, titel, erstellt_von, surge_faktor, auktion_ende")
    .eq("status", "auktion")
    .lt("auktion_ende", jetzt)
    .returns<AbgelaufenesTicket[]>()

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
      // Keine Angebote → Status zurück auf 'offen', Verwalter informieren
      // (E-Mail-Notification ist separate Pipeline — nicht in diesem Endpoint)
      await supabase
        .from("tickets")
        .update({ status: "offen", auktion_ende: null })
        .eq("id", ticket.id)
      ergebnisse.push({
        ticketId: ticket.id,
        titel: ticket.titel,
        aktion: "zurueck-auf-offen",
      })
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
      .eq("id", ticket.erstellt_von)
      .single<{ early_adopter_bis: string | null }>()
    const isEarlyAdopter = !!verwalter?.early_adopter_bis &&
      new Date(verwalter.early_adopter_bis).getTime() > Date.now()
    const surge = ticket.surge_faktor ?? 1.0
    const { finalRate } = effektiveProvisionsRate(0.05, surge, isEarlyAdopter)
    const calc = calculateCommission(winner.preis, finalRate)

    await supabase.from("provisionen").upsert(
      {
        ticket_id: ticket.id,
        verwalter_id: ticket.erstellt_von,
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
  }

  return NextResponse.json({
    ok: true,
    jetzt,
    anzahl: abgelaufen?.length ?? 0,
    vergeben: ergebnisse.filter(r => r.aktion === "vergeben").length,
    zurueck: ergebnisse.filter(r => r.aktion === "zurueck-auf-offen").length,
    ergebnisse,
  })
}
