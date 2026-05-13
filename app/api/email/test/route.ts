import { NextResponse, type NextRequest } from "next/server"
import { sendEmail } from "@/lib/email/send"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import {
  einladungEmail,
  neuesAngebotEmail,
  auktionAbgelaufenEmail,
  zuschlagEmail,
  absageEmail,
} from "@/lib/email/templates"

// POST /api/email/test
// Body: { template: 'einladung'|'neues_angebot'|'abgelaufen'|'zuschlag'|'absage', to: 'mail@example.com' }
//
// Auth-Modell:
//   - Development (NODE_ENV !== 'production'): offen, beliebige Empfänger
//   - Production: muss eingeloggter Admin sein, Empfänger MUSS die eigene
//     auth-Email sein (verhindert Quota-Missbrauch und Versand an Dritte)
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

  let empfaenger = body.to

  // Production: Auth + Self-Address-Lock
  if (process.env.NODE_ENV === "production") {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("rolle")
      .eq("id", user.id)
      .single<{ rolle: string }>()
    if (profile?.rolle !== "admin") {
      return NextResponse.json({ error: "Nur Admins dürfen Test-Mails senden" }, { status: 403 })
    }
    // Empfänger auf eigene Auth-Email sperren (Quota-Schutz)
    if (!user.email) {
      return NextResponse.json({ error: "Eigener Account hat keine Email" }, { status: 400 })
    }
    if (empfaenger && empfaenger !== user.email) {
      return NextResponse.json(
        { error: "In Production werden Test-Mails nur an die eigene Auth-Email gesendet", erlaubt: user.email },
        { status: 403 },
      )
    }
    empfaenger = user.email
  }

  if (!empfaenger || !empfaenger.includes("@")) {
    return NextResponse.json({ error: "Gültige E-Mail-Adresse in 'to' erforderlich" }, { status: 400 })
  }

  const { subject, html } = fixture()
  const result = await sendEmail({ to: empfaenger, subject, html })
  return NextResponse.json({ ...result, to: empfaenger })
}
