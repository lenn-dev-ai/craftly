import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { calculateCommission } from "@/lib/pricing/commission"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { nachtragEingereichtEmail } from "@/lib/email/templates"
import { aktualisiereAngebotstreue } from "@/lib/diagnose/angebotstreue"

// POST /api/nachtraege/einreichen
// Body: { ticket_id, nachtrag_betrag, begruendung, fotos?: string[] }
// Auth: Handwerker, muss zugewiesener_hw des Tickets sein, ticket muss
// in_bearbeitung oder erledigt sein.
//
// Stufen-Logik (Stufe via DB-GENERATED-Column aus aufpreis_prozent):
//   ≤ 10 % → bagatell    → auto-genehmigt, kosten_final/provisionen direkt
//   ≤ 25 % → wesentlich  → status=offen, Verwalter-Approval nötig
//   > 25 % → erheblich   → status=offen, Verwalter-Approval nötig
//
// Bei wesentlich/erheblich erhält der Verwalter sofort eine E-Mail.
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
    .select("id, titel, status, zugewiesener_hw, erstellt_von, kosten_final, projekt_angebot, surge_faktor, ticket_typ, diagnosegebuehr_angerechnet, gewerk")
    .eq("id", ticketId)
    .single<{
      id: string
      titel: string
      status: string
      zugewiesener_hw: string | null
      erstellt_von: string
      kosten_final: number | null
      projekt_angebot: number | null
      surge_faktor: number | null
      ticket_typ: string | null
      diagnosegebuehr_angerechnet: boolean | null
      gewerk: string | null
    }>()
  if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.zugewiesener_hw !== user.id) {
    return NextResponse.json({ error: "Nicht dein Auftrag" }, { status: 403 })
  }
  if (ticket.status !== "in_bearbeitung" && ticket.status !== "erledigt") {
    return NextResponse.json({ error: "Nachträge nur bei laufenden/erledigten Aufträgen" }, { status: 422 })
  }

  // Ursprungspreis = projekt_angebot (volles Angebot) falls vorhanden,
  // sonst kosten_final. Wichtig: Bei Projekt aus Diagnose ist kosten_final
  // = Restzahlung (nach Anrechnung), das volle Angebot steht in
  // projekt_angebot. Wir nehmen den höheren Wert als Bezug.
  const ursprungspreis = ticket.projekt_angebot && ticket.projekt_angebot > 0
    ? ticket.projekt_angebot
    : ticket.kosten_final
  if (!ursprungspreis || ursprungspreis <= 0) {
    return NextResponse.json({ error: "Kein Ursprungspreis vorhanden" }, { status: 422 })
  }

  // Insert — Stufe wird automatisch via DB-GENERATED gesetzt
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

  // Bagatell → automatisch genehmigen
  let autoGenehmigt = false
  if (inserted.stufe === "bagatell") {
    await supabase
      .from("nachtraege")
      .update({
        status: "genehmigt",
        genehmigt_von: user.id,
        genehmigt_am: new Date().toISOString(),
      })
      .eq("id", inserted.id)

    // kosten_final hochsetzen (Restzahlung wenn Diagnose-Anrechnung,
    // sonst volle Summe) — Nachtrag wird voll zusätzlich verrechnet
    const neuKostenFinal = Math.round(((ticket.kosten_final ?? 0) + nachtrag_betrag) * 100) / 100
    await supabase.from("tickets").update({ kosten_final: neuKostenFinal }).eq("id", ticketId)

    // Provisions-Snapshot aktualisieren
    await aktualisiereProvision(supabase, {
      ticketId,
      verwalterId: ticket.erstellt_von,
      handwerkerId: user.id,
      auftragswert: neuKostenFinal,
      surge: ticket.surge_faktor ?? 1.0,
    })

    autoGenehmigt = true
  }

  // Score aktualisieren (Bagatell zählt nicht ab, aber re-eval ist harmlos)
  await aktualisiereAngebotstreue(supabase, user.id)

  // Verwalter-Mail bei wesentlich/erheblich
  if (!autoGenehmigt) {
    void (async () => {
      const [{ data: verwalter }, { data: hw }] = await Promise.all([
        supabase.from("profiles").select("email, name").eq("id", ticket.erstellt_von).single<{ email: string | null; name: string | null }>(),
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

// Provisions-Snapshot neu berechnen (Helfer — gemeinsam mit /genehmigen)
async function aktualisiereProvision(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  params: {
    ticketId: string
    verwalterId: string
    handwerkerId: string
    auftragswert: number
    surge: number
  },
): Promise<void> {
  const { data: verwalterProfil } = await supabase
    .from("profiles")
    .select("early_adopter_bis")
    .eq("id", params.verwalterId)
    .single<{ early_adopter_bis: string | null }>()
  const isEarlyAdopter = !!verwalterProfil?.early_adopter_bis &&
    new Date(verwalterProfil.early_adopter_bis).getTime() > Date.now()
  const basisRate = 0.05
  const finalRate = isEarlyAdopter ? 0 : Math.round(basisRate * params.surge * 10000) / 10000
  const calc = calculateCommission(params.auftragswert, finalRate)
  await supabase.from("provisionen").upsert(
    {
      ticket_id: params.ticketId,
      verwalter_id: params.verwalterId,
      handwerker_id: params.handwerkerId,
      auftragswert: params.auftragswert,
      provision_rate: finalRate,
      provision_betrag: calc.provisionBetrag,
      gesamt: calc.gesamt,
      is_early_adopter: isEarlyAdopter,
    },
    { onConflict: "ticket_id" },
  )
}
