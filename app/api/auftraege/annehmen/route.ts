import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { reScoreTicket } from "@/lib/auction/scoring-pipeline"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { neuesAngebotEmail } from "@/lib/email/templates"
import { angebotAnnehmenSchema } from "@/lib/schemas"

// POST /api/auftraege/annehmen (H2: vorher /api/auction/bid)
// Body: { ticket_id, preis, fruehester_termin?, geschaetzte_dauer?, nachricht? }
// Auth: Handwerker. Im Vollkalkulations-Modell (Phase-0 #11) ist der "Bid"
//       eigentlich eine Annahme zum System-Preis — Route entsprechend benannt.
//       Schreibt Angebot, triggert Smart-Score-Recompute für alle Bids des
//       Tickets.
export async function POST(request: NextRequest) {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = angebotAnnehmenSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Eingabe", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const { ticket_id: ticketId, preis, fruehester_termin, geschaetzte_dauer, nachricht } = parsed.data

  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Sprint L: handwerker_gewerke[] mit-laden für Gewerk-Validation
  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle, gewerk, handwerker_gewerke")
    .eq("id", user.id)
    .single<{ rolle: string; gewerk: string | null; handwerker_gewerke: string[] | null }>()
  if (!profile || profile.rolle !== "handwerker") {
    return NextResponse.json({ error: "Nur Handwerker dürfen bieten" }, { status: 403 })
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, titel, status, auktion_ende, erstellt_von, verwalter_id, gewerk")
    .eq("id", ticketId)
    .single<{
      id: string
      titel: string
      status: string
      auktion_ende: string | null
      erstellt_von: string
      verwalter_id: string | null
      gewerk: string | null
    }>()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.status !== "auktion") {
    return NextResponse.json({ error: "Auktion nicht aktiv" }, { status: 422 })
  }
  if (ticket.auktion_ende && new Date(ticket.auktion_ende).getTime() < Date.now()) {
    return NextResponse.json({ error: "Auktion bereits abgelaufen" }, { status: 422 })
  }

  // Sprint L: Stamm-Gewerke-Validation. Fallback auf altes single-Gewerk
  // solange noch nicht alle HW migriert haben. 'allgemein' bleibt offen
  // für alle. Wenn HW gar kein Gewerk hat: durchlassen (kein Lock-Out).
  const stammGewerke: string[] = Array.isArray(profile.handwerker_gewerke) && profile.handwerker_gewerke.length > 0
    ? profile.handwerker_gewerke
    : (profile.gewerk ? [profile.gewerk] : [])
  const ticketGewerk = ticket.gewerk?.toLowerCase()
  if (
    stammGewerke.length > 0
    && ticketGewerk
    && ticketGewerk !== "allgemein"
    && !stammGewerke.includes(ticketGewerk)
  ) {
    return NextResponse.json(
      {
        error: `Dieses Ticket ist Gewerk "${ticketGewerk}". Du bietest nur ${stammGewerke.join(", ")} an.`,
      },
      { status: 403 },
    )
  }

  const { error: insertErr } = await supabase.from("angebote").upsert(
    {
      ticket_id: ticketId,
      handwerker_id: user.id,
      preis,
      fruehester_termin: fruehester_termin || null,
      geschaetzte_dauer: geschaetzte_dauer || null,
      nachricht: nachricht || null,
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
