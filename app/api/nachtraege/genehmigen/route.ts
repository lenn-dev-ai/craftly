import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { calculateCommission } from "@/lib/pricing/commission"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { nachtragGenehmigtEmail, nachtragAbgelehntEmail } from "@/lib/email/templates"
import { aktualisiereAngebotstreue } from "@/lib/diagnose/angebotstreue"

// POST /api/nachtraege/genehmigen
// Body: { nachtrag_id, entscheidung: 'genehmigt' | 'abgelehnt' }
// Auth: Verwalter (Ticket-Ersteller) oder Admin.
//
// Bei genehmigt:
//   - kosten_final += nachtrag_betrag
//   - Provisions-Snapshot neu berechnen
//   - Angebotstreue-Score aktualisieren
//   - Handwerker-Mail
// Bei abgelehnt:
//   - Status setzen, Handwerker-Mail
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
    .select("id, titel, erstellt_von, kosten_final, surge_faktor")
    .eq("id", nachtrag.ticket_id)
    .single<{
      id: string
      titel: string
      erstellt_von: string
      kosten_final: number | null
      surge_faktor: number | null
    }>()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.erstellt_von !== user.id && profile.rolle !== "admin") {
    return NextResponse.json({ error: "Nicht dein Ticket" }, { status: 403 })
  }

  // Status updaten
  await supabase
    .from("nachtraege")
    .update({
      status: entscheidung,
      genehmigt_von: user.id,
      genehmigt_am: new Date().toISOString(),
    })
    .eq("id", nachtragId)

  let neuKostenFinal: number | null = null
  if (entscheidung === "genehmigt") {
    neuKostenFinal = Math.round(((ticket.kosten_final ?? 0) + nachtrag.nachtrag_betrag) * 100) / 100
    await supabase
      .from("tickets")
      .update({ kosten_final: neuKostenFinal })
      .eq("id", ticket.id)

    // Provisions-Snapshot neu
    const { data: verwalterProfil } = await supabase
      .from("profiles")
      .select("early_adopter_bis")
      .eq("id", ticket.erstellt_von)
      .single<{ early_adopter_bis: string | null }>()
    const isEarlyAdopter = !!verwalterProfil?.early_adopter_bis &&
      new Date(verwalterProfil.early_adopter_bis).getTime() > Date.now()
    const surge = ticket.surge_faktor ?? 1.0
    const finalRate = isEarlyAdopter ? 0 : Math.round(0.05 * surge * 10000) / 10000
    const calc = calculateCommission(neuKostenFinal, finalRate)
    await supabase.from("provisionen").upsert(
      {
        ticket_id: ticket.id,
        verwalter_id: ticket.erstellt_von,
        handwerker_id: nachtrag.handwerker_id,
        auftragswert: neuKostenFinal,
        provision_rate: finalRate,
        provision_betrag: calc.provisionBetrag,
        gesamt: calc.gesamt,
        is_early_adopter: isEarlyAdopter,
      },
      { onConflict: "ticket_id" },
    )

    // Angebotstreue aktualisieren (nur genehmigte zählen ab Wesentlich)
    await aktualisiereAngebotstreue(supabase, nachtrag.handwerker_id)
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
        neuerAuftragswert: neuKostenFinal ?? 0,
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
    neuerAuftragswert: neuKostenFinal,
  })
}
