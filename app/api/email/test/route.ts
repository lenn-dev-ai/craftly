import { NextResponse, type NextRequest } from "next/server"
import { sendEmail } from "@/lib/email/send"
import {
  einladungEmail,
  neuesAngebotEmail,
  auktionAbgelaufenEmail,
  zuschlagEmail,
  absageEmail,
} from "@/lib/email/templates"

// POST /api/email/test
// Body: { template: 'einladung'|'neues_angebot'|'abgelaufen'|'zuschlag'|'absage', to: 'mail@example.com' }
// Nur in Development zugänglich. In Production: 403.
//
// Senden ohne RESEND_API_KEY ist No-Op (siehe lib/email/send.ts).

const FIXTURES: Record<string, () => { subject: string; html: string }> = {
  einladung: () => einladungEmail({
    handwerkerName: "Max Mustermann",
    ticketTitel: "Heizung defekt — Wohnung 3.OG",
    ticketBeschreibung: "Die Heizung im Wohnzimmer gibt kein warmes Wasser mehr. Mieter meldet seit 2 Tagen.",
    gewerk: "heizung_sanitaer",
    dringlichkeit: "zeitnah",
    einsatzort: "Schönhauser Allee 80, 10439 Berlin",
    distanzKm: 2.3,
    auktionEnde: "15. Mai 2026, 14:00",
    ticketId: "test-123",
  }),
  neues_angebot: () => neuesAngebotEmail({
    verwalterName: "Anna Verwalter",
    handwerkerName: "Max Mustermann",
    handwerkerFirma: "Müller Sanitär GmbH",
    ticketTitel: "Heizung defekt — Wohnung 3.OG",
    angebotPreis: 55.98,
    angebotAnzahl: 3,
    ticketId: "test-123",
  }),
  abgelaufen: () => auktionAbgelaufenEmail({
    verwalterName: "Anna Verwalter",
    ticketTitel: "Heizung defekt — Wohnung 3.OG",
    angebotAnzahl: 3,
    ticketId: "test-123",
  }),
  zuschlag: () => zuschlagEmail({
    handwerkerName: "Max Mustermann",
    ticketTitel: "Heizung defekt — Wohnung 3.OG",
    ticketBeschreibung: "Die Heizung im Wohnzimmer gibt kein warmes Wasser mehr.",
    einsatzort: "Schönhauser Allee 80, 10439 Berlin",
    angebotPreis: 55.98,
    ticketId: "test-123",
  }),
  absage: () => absageEmail({
    handwerkerName: "Otto Elektriker",
    ticketTitel: "Heizung defekt — Wohnung 3.OG",
  }),
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Nur in Development verfügbar" }, { status: 403 })
  }

  let body: { template?: string; to?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const fixture = body.template ? FIXTURES[body.template] : undefined
  if (!fixture) {
    return NextResponse.json(
      { error: "Template nicht gefunden", available: Object.keys(FIXTURES) },
      { status: 400 },
    )
  }
  if (!body.to || !body.to.includes("@")) {
    return NextResponse.json({ error: "Gültige E-Mail-Adresse in 'to' erforderlich" }, { status: 400 })
  }

  const { subject, html } = fixture()
  const result = await sendEmail({ to: body.to, subject, html })
  return NextResponse.json(result)
}
