import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { reScoreTicket } from "@/lib/auction/scoring-pipeline"
import { erteileZuschlag } from "@/lib/auction/zuschlag"

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

  // Gemeinsame Zuschlag-Pipeline (lib/auction/zuschlag.ts) — identischer
  // Ablauf wie beim Sofort-Zuschlag in /api/auftraege/annehmen.
  const ergebnis = await erteileZuschlag(admin, {
    ticket,
    angebotId: pickedAngebotId!,
    actor: { userId: user.id, rolle: profile.rolle },
    request,
  })
  if (!ergebnis.ok) {
    return NextResponse.json({ error: ergebnis.error }, { status: ergebnis.status ?? 500 })
  }

  return NextResponse.json({
    ok: true,
    ticketId,
    angebotId: pickedAngebotId,
    handwerkerId: ergebnis.handwerkerId,
    auftragswert: ergebnis.kostenFinal,
    kostenFinal: ergebnis.kostenFinal,
    diagnoseGebuehrAngerechnet: ergebnis.diagnoseGebuehrAngerechnet,
    diagnosePreisAngerechnet: ergebnis.diagnosePreisAngerechnet,
    provisionRate: ergebnis.provisionRate,
    provisionBetrag: ergebnis.provisionBetrag,
    gesamt: ergebnis.gesamt,
    surgeFaktor: ergebnis.surgeFaktor,
    isEarlyAdopter: ergebnis.isEarlyAdopter,
    plannerStatus: ergebnis.plannerStatus,
    vorkaufsrechtAktiv,
  })
}
