import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { nachtragEingereichtEmail } from "@/lib/email/templates"

// POST /api/nachtraege/einreichen
// Body: { ticket_id, nachtrag_betrag, begruendung, fotos?: string[] }
// Auth: Handwerker, muss zugewiesener_hw des Tickets sein, ticket muss
// in_bearbeitung oder erledigt sein.
//
// Stufen-Logik (Stufe wird via DB-GENERATED-Column aus aufpreis_prozent
// gesetzt):
//   ≤ 10 % → bagatell    → status='genehmigt' direkt → DB-Trigger
//                          aktualisiert kosten_final, provisionen und
//                          angebotstreue automatisch
//   ≤ 25 % → wesentlich  → status='offen', Verwalter-Mail
//   > 25 % → erheblich   → status='offen', Verwalter-Mail
export async function POST(request: NextRequest) {
  let body: {
    ticket_id?: string
    nachtrag_betrag?: number
    begruendung?: string
    fotos?: string[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { ticket_id: ticketId, nachtrag_betrag, begruendung, fotos } = body
  if (!ticketId || !begruendung?.trim()) {
    return NextResponse.json({ error: "ticket_id und begruendung erforderlich" }, { status: 400 })
  }
  if (!nachtrag_betrag || nachtrag_betrag <= 0) {
    return NextResponse.json({ error: "nachtrag_betrag muss > 0 sein" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, titel, status, zugewiesener_hw, erstellt_von, verwalter_id, kosten_final, projekt_angebot")
    .eq("id", ticketId)
    .single<{
      id: string
      titel: string
      status: string
      zugewiesener_hw: string | null
      erstellt_von: string
      verwalter_id: string | null
      kosten_final: number | null
      projekt_angebot: number | null
    }>()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.zugewiesener_hw !== user.id) {
    return NextResponse.json({ error: "Nicht dein Auftrag" }, { status: 403 })
  }
  if (ticket.status !== "in_bearbeitung" && ticket.status !== "erledigt") {
    return NextResponse.json({ error: "Nachträge nur bei laufenden/erledigten Aufträgen" }, { status: 422 })
  }

  // Ursprungspreis = projekt_angebot (volles Angebot) falls vorhanden,
  // sonst kosten_final. Bei Diagnose-Projekt ist kosten_final die
  // Restzahlung (nach Anrechnung) — das volle Angebot steht in
  // projekt_angebot. Aufpreis-Prozent rechnet auf den ursprünglichen Wert.
  const ursprungspreis = ticket.projekt_angebot && ticket.projekt_angebot > 0
    ? ticket.projekt_angebot
    : ticket.kosten_final
  if (!ursprungspreis || ursprungspreis <= 0) {
    return NextResponse.json({ error: "Kein Ursprungspreis vorhanden" }, { status: 422 })
  }

  // Insert mit status='offen' — stufe wird via DB-GENERATED gesetzt
  const { data: inserted, error: insErr } = await supabase
    .from("nachtraege")
    .insert({
      ticket_id: ticketId,
      handwerker_id: user.id,
      ursprungspreis,
      nachtrag_betrag,
      begruendung: begruendung.trim(),
      fotos: fotos ?? [],
      status: "offen",
    })
    .select("id, stufe, aufpreis_prozent")
    .single<{ id: string; stufe: "bagatell" | "wesentlich" | "erheblich"; aufpreis_prozent: number }>()
  if (insErr || !inserted) {
    return NextResponse.json({ error: "Nachtrag-Insert fehlgeschlagen: " + (insErr?.message ?? "unknown") }, { status: 500 })
  }

  // Bagatell → sofort genehmigen. DB-Trigger handle_nachtrag_genehmigt
  // synchronisiert tickets.kosten_final, provisionen-Snapshot und
  // profiles.angebotstreue automatisch.
  //
  // Status-Update muss als Service-Role laufen, weil die nachtraege_update-
  // Policy nur Verwalter (Ticket-Ersteller) oder Admin erlaubt — der
  // Handwerker selbst darf seinen Nachtrag nicht auf 'genehmigt' setzen.
  let autoGenehmigt = false
  if (inserted.stufe === "bagatell") {
    const admin = createServiceRoleClient()
    const { error: updErr } = await admin
      .from("nachtraege")
      .update({
        status: "genehmigt",
        genehmigt_von: user.id,
        genehmigt_am: new Date().toISOString(),
      })
      .eq("id", inserted.id)
    if (updErr) {
      return NextResponse.json(
        { error: "Bagatell-Auto-Genehmigung fehlgeschlagen: " + updErr.message },
        { status: 500 },
      )
    }
    autoGenehmigt = true
  }

  // Verwalter-Mail nur bei wesentlich/erheblich (Bagatell ist Routine)
  if (!autoGenehmigt) {
    void (async () => {
      const [{ data: verwalter }, { data: hw }] = await Promise.all([
        // FIX-6: Verwalter (verwalter_id) bekommt die Nachtrags-Mail,
        // nicht der Mieter (= erstellt_von bei Mieter-Tickets).
        supabase.from("profiles").select("email, name").eq("id", ticket.verwalter_id ?? ticket.erstellt_von).single<{ email: string | null; name: string | null }>(),
        supabase.from("profiles").select("name, firma").eq("id", user.id).single<{ name: string | null; firma: string | null }>(),
      ])
      if (!verwalter?.email) return
      const { subject, html } = nachtragEingereichtEmail({
        verwalterName: verwalter.name || "Verwalter",
        handwerkerName: hw?.name || "Handwerker",
        handwerkerFirma: hw?.firma || "",
        ticketTitel: ticket.titel,
        ursprungspreis,
        nachtragBetrag: nachtrag_betrag,
        aufpreisProzent: inserted.aufpreis_prozent,
        stufe: inserted.stufe,
        begruendung: begruendung.trim(),
        ticketId,
      })
      sendEmailFireAndForget({ to: verwalter.email, subject, html })
    })().catch(err => console.error("[Email] Nachtrag-Einreichen-Mail fehlgeschlagen:", err))
  }

  return NextResponse.json({
    ok: true,
    nachtragId: inserted.id,
    stufe: inserted.stufe,
    aufpreisProzent: inserted.aufpreis_prozent,
    autoGenehmigt,
  })
}
