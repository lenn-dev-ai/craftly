import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { nachtragGenehmigtEmail, nachtragAbgelehntEmail } from "@/lib/email/templates"

// POST /api/nachtraege/genehmigen
// Body: { nachtrag_id, entscheidung: 'genehmigt' | 'abgelehnt' }
// Auth: Verwalter (Ticket-Ersteller) oder Admin.
//
// Bei 'genehmigt' synchronisiert der DB-Trigger handle_nachtrag_genehmigt
// automatisch: tickets.kosten_final, provisionen-Snapshot,
// profiles.angebotstreue. Die API-Route setzt nur den Status und schickt
// die Handwerker-Mail.
export async function POST(request: NextRequest) {
  let body: { nachtrag_id?: string; entscheidung?: "genehmigt" | "abgelehnt" }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { nachtrag_id: nachtragId, entscheidung } = body
  if (!nachtragId) {
    return NextResponse.json({ error: "nachtrag_id erforderlich" }, { status: 400 })
  }
  if (entscheidung !== "genehmigt" && entscheidung !== "abgelehnt") {
    return NextResponse.json({ error: "entscheidung muss 'genehmigt' oder 'abgelehnt' sein" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single<{ rolle: string }>()
  if (!profile || (profile.rolle !== "verwalter" && profile.rolle !== "admin")) {
    return NextResponse.json({ error: "Nur Verwalter dürfen entscheiden" }, { status: 403 })
  }

  const { data: nachtrag } = await supabase
    .from("nachtraege")
    .select("id, ticket_id, handwerker_id, nachtrag_betrag, stufe, status, begruendung")
    .eq("id", nachtragId)
    .single<{
      id: string
      ticket_id: string
      handwerker_id: string
      nachtrag_betrag: number
      stufe: "bagatell" | "wesentlich" | "erheblich"
      status: string
      begruendung: string
    }>()
  if (!nachtrag) return NextResponse.json({ error: "Nachtrag nicht gefunden" }, { status: 404 })
  if (nachtrag.status !== "offen") {
    return NextResponse.json({ error: "Nachtrag bereits entschieden" }, { status: 422 })
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, titel, erstellt_von")
    .eq("id", nachtrag.ticket_id)
    .single<{ id: string; titel: string; erstellt_von: string }>()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.erstellt_von !== user.id && profile.rolle !== "admin") {
    return NextResponse.json({ error: "Nicht dein Ticket" }, { status: 403 })
  }

  // Status-Update → bei 'genehmigt' feuert der DB-Trigger
  await supabase
    .from("nachtraege")
    .update({
      status: entscheidung,
      genehmigt_von: user.id,
      genehmigt_am: new Date().toISOString(),
    })
    .eq("id", nachtragId)

  // Neuen Auftragswert für die Mail nachladen (Trigger hat geschrieben)
  let neuerAuftragswert: number | null = null
  if (entscheidung === "genehmigt") {
    const { data: t } = await supabase
      .from("tickets")
      .select("kosten_final")
      .eq("id", ticket.id)
      .single<{ kosten_final: number | null }>()
    neuerAuftragswert = t?.kosten_final ?? null
  }

  // Handwerker-Mail (fire-and-forget)
  void (async () => {
    const { data: hw } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("id", nachtrag.handwerker_id)
      .single<{ email: string | null; name: string | null }>()
    if (!hw?.email) return
    if (entscheidung === "genehmigt") {
      const { subject, html } = nachtragGenehmigtEmail({
        handwerkerName: hw.name || "Handwerker",
        ticketTitel: ticket.titel,
        nachtragBetrag: nachtrag.nachtrag_betrag,
        stufe: nachtrag.stufe,
        neuerAuftragswert: neuerAuftragswert ?? 0,
        ticketId: ticket.id,
      })
      sendEmailFireAndForget({ to: hw.email, subject, html })
    } else {
      const { subject, html } = nachtragAbgelehntEmail({
        handwerkerName: hw.name || "Handwerker",
        ticketTitel: ticket.titel,
        nachtragBetrag: nachtrag.nachtrag_betrag,
        stufe: nachtrag.stufe,
        begruendung: nachtrag.begruendung,
        ticketId: ticket.id,
      })
      sendEmailFireAndForget({ to: hw.email, subject, html })
    }
  })().catch(err => console.error("[Email] Nachtrag-Entscheidung-Mail fehlgeschlagen:", err))

  return NextResponse.json({
    ok: true,
    nachtragId,
    entscheidung,
    neuerAuftragswert,
  })
}
