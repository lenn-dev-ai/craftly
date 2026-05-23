import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { verifyVapiSignature } from "@/lib/sms/verify-vapi-signature"
import { sendSms } from "@/lib/sms/twilio"

// POST /api/voice-call/ingest (Voice-AI PoC)
// Webhook-Endpoint für Vapi. Wird aufgerufen wenn ein Anruf beendet ist.
//
// Auth: HMAC-Signatur via x-vapi-signature-Header gegen
// VAPI_WEBHOOK_SECRET. Kein User-Session — Service-Role-Client für den
// DB-Insert, weil Vapi keine User-Session hat.
//
// Workflow:
// 1. Signatur verifizieren (constant-time HMAC-Compare)
// 2. Caller-Phone gegen profiles.telefon matchen → Verwalter finden
// 3. Ticket per service-role inserten (eingetragen_via='voice-ai')
// 4. SMS an Verwalter mit Ticket-Link (fire-and-forget)
// 5. Response 200 mit ticket_id (Vapi loggt das)

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type VapiPayload = {
  call_id?: string
  duration_seconds?: number
  caller_phone?: string
  transcript_full?: string
  extracted_data?: {
    adresse?: string
    gewerk?: string
    beschreibung?: string
    dringlichkeit?: string
    mieter_telefon?: string
    fotos_verfuegbar?: boolean
  }
  recording_url?: string
}

const ERLAUBTE_GEWERKE = new Set([
  "heizung_sanitaer", "elektro", "schreiner", "maler",
  "dachdecker", "bodenleger", "schluessel", "allgemein",
])

const GEWERK_ALIAS: Record<string, string> = {
  wasser: "heizung_sanitaer",
  heizung: "heizung_sanitaer",
  sanitaer: "heizung_sanitaer",
  strom: "elektro",
  schloss: "schluessel",
}

const DRINGLICHKEIT_ALIAS: Record<string, string> = {
  notfall: "notfall",
  zeitnah: "zeitnah",
  planbar: "planbar",
  "dringend": "notfall",
  "sofort": "notfall",
  "akut": "notfall",
  "bald": "zeitnah",
  "normal": "planbar",
}

export async function POST(request: NextRequest) {
  // 1. Raw body lesen für HMAC. NextRequest.text() konsumiert den Body,
  //    danach kann er nicht mehr per .json() gelesen werden — wir
  //    parsen manuell.
  const rawBody = await request.text()
  const secret = process.env.VAPI_WEBHOOK_SECRET
  const sigHeader = request.headers.get("x-vapi-signature")

  if (!secret) {
    console.error("[voice-call] VAPI_WEBHOOK_SECRET nicht gesetzt — Request abgelehnt")
    return NextResponse.json({ error: "Server not configured" }, { status: 503 })
  }
  if (!verifyVapiSignature(rawBody, sigHeader, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: VapiPayload
  try {
    body = JSON.parse(rawBody) as VapiPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const caller = body.caller_phone?.trim()
  const data = body.extracted_data
  if (!caller || !data) {
    return NextResponse.json({ error: "caller_phone + extracted_data erforderlich" }, { status: 400 })
  }
  if (!data.adresse || !data.beschreibung) {
    return NextResponse.json({ error: "adresse + beschreibung erforderlich" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // 2. Caller-Phone → Verwalter-Profil. Phone-Normalisierung: alle
  //    nicht-Ziffern entfernen, dann letzte 10 Ziffern matchen (toleriert
  //    "+49 170 ..." vs. "0170..." vs. "+49170...")
  const callerNormalisiert = caller.replace(/\D/g, "")
  const callerSuffix = callerNormalisiert.slice(-10)

  const { data: verwalter, error: lookupErr } = await supabase
    .from("profiles")
    .select("id, name, telefon")
    .eq("rolle", "verwalter")
    .not("telefon", "is", null)
    .returns<Array<{ id: string; name: string | null; telefon: string | null }>>()

  if (lookupErr) {
    return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 })
  }

  const match = verwalter?.find(v => {
    const norm = (v.telefon ?? "").replace(/\D/g, "")
    return norm && norm.slice(-10) === callerSuffix
  })

  if (!match) {
    return NextResponse.json(
      { error: "Unknown caller — kein Verwalter mit dieser Telefon-Nummer" },
      { status: 403 },
    )
  }

  // 3. Gewerk + Dringlichkeit normalisieren
  const gewerkRaw = (data.gewerk ?? "allgemein").toLowerCase()
  const gewerk = ERLAUBTE_GEWERKE.has(gewerkRaw)
    ? gewerkRaw
    : (GEWERK_ALIAS[gewerkRaw] ?? "allgemein")

  const prioRaw = (data.dringlichkeit ?? "planbar").toLowerCase()
  const prioritaet = DRINGLICHKEIT_ALIAS[prioRaw] ?? "planbar"

  // 4. Anrufer-Notiz oben in die Beschreibung (analog Sprint-G-Wizard).
  //    Mieter-Tel-Nr wird mit-gepackt, damit der HW später den Mieter
  //    anrufen kann.
  const mieterZeile = data.mieter_telefon
    ? `📞 Voice-AI · Anrufer: ${match.name ?? "Verwalter"} · Mieter ${data.mieter_telefon}`
    : `📞 Voice-AI · Anrufer: ${match.name ?? "Verwalter"}`
  const volleBeschreibung = `${mieterZeile}\n\n${data.beschreibung.trim()}${
    data.fotos_verfuegbar ? "\n\n(Mieter hat Fotos verfügbar — folgen per SMS/E-Mail.)" : ""
  }`

  const titel = data.beschreibung.split(/[.,;\n]/)[0].slice(0, 80) || "Voice-AI-Schaden"

  const insertPayload: Record<string, unknown> = {
    titel,
    beschreibung: volleBeschreibung,
    gewerk,
    prioritaet,
    status: "offen",
    vergabemodus: "direkt",
    erstellt_von: match.id,
    verwalter_id: match.id,
    einsatzort_adresse: data.adresse.trim(),
    eingetragen_von_verwalter: true,
    eingetragen_via: "voice-ai",
    voice_call_recording_url: body.recording_url ?? null,
    voice_call_transcript: body.transcript_full ?? null,
  }

  const { data: ticket, error: insertErr } = await supabase
    .from("tickets")
    .insert(insertPayload)
    .select("id")
    .single<{ id: string }>()

  if (insertErr) {
    return NextResponse.json({
      error: insertErr.message,
      hint: "Falls 'column does not exist': Migrations 20260605000050 + 20260605000070 noch nicht angewandt.",
    }, { status: 500 })
  }

  // 5. SMS-Bestätigung — fire-and-forget. Wenn Twilio-ENV fehlt
  //    no-op, kein Fehler für den Caller.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://reparo-app.netlify.app"
  const ticketKurz = ticket.id.slice(0, 8)
  void sendSms({
    to: caller,
    body: `Reparo-Ticket #${ticketKurz} erstellt: ${appUrl}/dashboard-verwalter/ticket/${ticket.id}`,
  }).catch(err => console.error("[voice-call] SMS-Send fehlgeschlagen:", err))

  return NextResponse.json({
    ok: true,
    ticket_id: ticket.id,
    verwalter_id: match.id,
  })
}
