import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { reScoreTicket } from "@/lib/auction/scoring-pipeline"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { neuesAngebotEmail, autoVergebenEmail } from "@/lib/email/templates"
import { ladeVerwalterPraeferenzen } from "@/lib/auction/auto-vergabe"
import { erteileZuschlag } from "@/lib/auction/zuschlag"
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
    // Beta-Feedback: "Ungültige Eingabe" allein ist für den Nutzer kryptisch —
    // die UI zeigt nur error, nicht details. Feldfehler in die Message packen,
    // damit klar ist WAS ungültig ist (z.B. "preis: preis muss > 0 sein").
    const fieldErrors = parsed.error.flatten().fieldErrors
    const detail = Object.entries(fieldErrors)
      .map(([feld, msgs]) => `${feld}: ${msgs?.[0] ?? "ungültig"}`)
      .join("; ")
    return NextResponse.json(
      { error: detail ? `Ungültige Eingabe — ${detail}` : "Ungültige Eingabe", details: fieldErrors },
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
  // Admin darf mit-bieten: der Admin-Sichtwechsel ("Sicht wechseln") zeigt
  // die komplette Handwerker-UI — Mieter-Melden und Verwalter-Vergabe
  // funktionieren mit dem Admin-Account bereits, nur Bieten war gesperrt.
  // Ohne diese Ausnahme ist der Rollen-Loop für Admins nicht testbar.
  if (!profile || (profile.rolle !== "handwerker" && profile.rolle !== "admin")) {
    return NextResponse.json({ error: "Nur Handwerker dürfen bieten" }, { status: 403 })
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, titel, beschreibung, einsatzort_adresse, status, auktion_ende, erstellt_von, verwalter_id, gewerk, surge_faktor, ticket_typ, diagnose_ticket_id")
    .eq("id", ticketId)
    .single<{
      id: string
      titel: string
      beschreibung: string | null
      einsatzort_adresse: string | null
      status: string
      auktion_ende: string | null
      erstellt_von: string
      verwalter_id: string | null
      gewerk: string | null
      surge_faktor: number | null
      ticket_typ: string | null
      diagnose_ticket_id: string | null
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

  // Sofort-Zuschlag (05.07.): Im Vollkalkulations-Modell ist der Preis vom
  // System bestimmt — die Annahme IST der Deal ("wer zuerst kommt, bekommt
  // den Auftrag", so verspricht es auch das HW-Dashboard). Die Auktion
  // danach offenzulassen war ein Rest des alten Bieter-Systems.
  // Leitplanken bleiben: Master-Schalter + Budget-Gate des Verwalters —
  // außerhalb davon entscheidet weiterhin der Mensch (manueller Close
  // bzw. Auktionsende-Cron).
  const admin = createServiceRoleClient()
  const verwalterId = ticket.verwalter_id ?? ticket.erstellt_von
  const prefs = await ladeVerwalterPraeferenzen(admin, verwalterId)
  const autoZuschlagErlaubt =
    prefs.autoVergabeAktiv && (prefs.budgetEur == null || preis <= prefs.budgetEur)

  let vergeben = false
  if (autoZuschlagErlaubt) {
    const { data: eigenesAngebot } = await admin
      .from("angebote")
      .select("id")
      .eq("ticket_id", ticketId)
      .eq("handwerker_id", user.id)
      .single<{ id: string }>()
    if (eigenesAngebot) {
      const zuschlag = await erteileZuschlag(admin, {
        ticket,
        angebotId: eigenesAngebot.id,
        actor: { userId: user.id, rolle: "system" },
        request,
      })
      vergeben = zuschlag.ok
      // Bei Fehlschlag (z.B. Race: anderer HW war schneller) bleibt das
      // Angebot als normales Bid liegen — kein Abbruch der Annahme.
      if (!zuschlag.ok) {
        console.warn("[annehmen] Sofort-Zuschlag nicht erteilt:", zuschlag.error)
      }
    }
  }

  // Fire-and-forget: Verwalter-Mail. Bei Sofort-Zuschlag eine
  // "vergeben, nichts zu tun"-Info statt der Bitte, Angebote zu vergleichen.
  const istVergeben = vergeben
  void (async () => {
    const [{ data: verwalter }, { data: handwerker }, { count }] = await Promise.all([
      supabase
        .from("profiles")
        .select("email, name")
        // FIX-3: Bei Mieter-Tickets ist erstellt_von der Mieter — der
        // muss aber nicht die Bid-Mail bekommen. Der zuständige Verwalter
        // entscheidet, also verwalter_id bevorzugen.
        .eq("id", verwalterId)
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
    const { subject, html } = istVergeben
      ? autoVergebenEmail({
          verwalterName: verwalter.name || "Verwalter",
          handwerkerName: handwerker?.name || "Handwerker",
          handwerkerFirma: handwerker?.firma || "",
          ticketTitel: ticket.titel,
          preis,
          ticketId: ticket.id,
        })
      : neuesAngebotEmail({
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
    vergeben,
    rescored: result.updated,
    rescoreSkipped: result.skipped || undefined,
  })
}
