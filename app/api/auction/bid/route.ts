import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { reScoreTicket } from "@/lib/auction/scoring-pipeline"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { neuesAngebotEmail } from "@/lib/email/templates"

// POST /api/auction/bid
// Body: { ticket_id, preis, fruehester_termin?, geschaetzte_dauer?, nachricht? }
// Auth: Handwerker. Schreibt Angebot, triggert Smart-Score-Recompute für
//       alle Bids des Tickets.
export async function POST(request: NextRequest) {
  let body: {
    ticket_id?: string
    preis?: number
    fruehester_termin?: string
    geschaetzte_dauer?: string
    nachricht?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const ticketId = body.ticket_id
  const preis = Number(body.preis)
  if (!ticketId) {
    return NextResponse.json({ error: "ticket_id erforderlich" }, { status: 400 })
  }
  if (!isFinite(preis) || preis <= 0) {
    return NextResponse.json({ error: "preis muss > 0 sein" }, { status: 400 })
  }

  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single()
  if (!profile || profile.rolle !== "handwerker") {
    return NextResponse.json({ error: "Nur Handwerker dürfen bieten" }, { status: 403 })
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, titel, status, auktion_ende, erstellt_von, verwalter_id")
    .eq("id", ticketId)
    .single<{
      id: string
      titel: string
      status: string
      auktion_ende: string | null
      erstellt_von: string
      verwalter_id: string | null
    }>()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.status !== "auktion") {
    return NextResponse.json({ error: "Auktion nicht aktiv" }, { status: 422 })
  }
  if (ticket.auktion_ende && new Date(ticket.auktion_ende).getTime() < Date.now()) {
    return NextResponse.json({ error: "Auktion bereits abgelaufen" }, { status: 422 })
  }

  const { error: insertErr } = await supabase.from("angebote").upsert(
    {
      ticket_id: ticketId,
      handwerker_id: user.id,
      preis,
      fruehester_termin: body.fruehester_termin || null,
      geschaetzte_dauer: body.geschaetzte_dauer || null,
      nachricht: body.nachricht || null,
      status: "eingereicht",
    },
    { onConflict: "ticket_id,handwerker_id" },
  )
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Einladung markieren falls vorhanden
  await supabase
    .from("einladungen")
    .update({ status: "angebot" })
    .eq("ticket_id", ticketId)
    .eq("handwerker_id", user.id)

  // Re-Score aller Bids dieses Tickets
  const result = await reScoreTicket(supabase, ticketId)

  // Fire-and-forget: Mail an den Verwalter mit Live-Bid-Counter
  void (async () => {
    const [{ data: verwalter }, { data: handwerker }, { count }] = await Promise.all([
      supabase
        .from("profiles")
        .select("email, name")
        // FIX-3: Bei Mieter-Tickets ist erstellt_von der Mieter — der
        // muss aber nicht die Bid-Mail bekommen. Der zuständige Verwalter
        // entscheidet, also verwalter_id bevorzugen.
        .eq("id", ticket.verwalter_id ?? ticket.erstellt_von)
        .single<{ email: string | null; name: string | null }>(),
      supabase
        .from("profiles")
        .select("name, firma")
        .eq("id", user.id)
        .single<{ name: string | null; firma: string | null }>(),
      supabase
        .from("angebote")
        .select("id", { count: "exact", head: true })
        .eq("ticket_id", ticketId),
    ])
    if (!verwalter?.email) return
    const { subject, html } = neuesAngebotEmail({
      verwalterName: verwalter.name || "Verwalter",
      handwerkerName: handwerker?.name || "Handwerker",
      handwerkerFirma: handwerker?.firma || "",
      ticketTitel: ticket.titel,
      angebotPreis: preis,
      angebotAnzahl: count ?? 1,
      ticketId: ticket.id,
    })
    sendEmailFireAndForget({ to: verwalter.email, subject, html })
  })().catch(err => console.error("[Email] bid-mail Vorbereitung fehlgeschlagen:", err))

  return NextResponse.json({
    ok: true,
    ticketId,
    rescored: result.updated,
    rescoreSkipped: result.skipped || undefined,
  })
}
