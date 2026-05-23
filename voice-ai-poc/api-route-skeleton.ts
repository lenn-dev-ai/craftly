/*
 * Voice-AI PoC — API-Route-Skeleton
 *
 * Das ist eine GEKÜRZTE Referenz-Version. Die tatsächlich deployed
 * Implementation lebt in:
 *
 *   app/api/voice-call/ingest/route.ts
 *
 * Sie folgt diesem Skeleton, mit zusätzlicher Gewerk/Dringlichkeits-
 * Normalisierung, Telefon-Suffix-Matching und Service-Role-Insert.
 *
 * Dieses File ist read-only Dokumentation, kein Build-Input.
 */

// @ts-nocheck
import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { verifyVapiSignature } from "@/lib/sms/verify-vapi-signature"
import { sendSms } from "@/lib/sms/twilio"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // 1. Signatur prüfen
  if (!verifyVapiSignature(rawBody, request.headers.get("x-vapi-signature"), process.env.VAPI_WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const body = JSON.parse(rawBody) as VapiPayload

  // 2. Caller-Phone → Verwalter
  const supabase = createServiceRoleClient()
  const { data: verwalter } = await supabase
    .from("profiles")
    .select("id, name, telefon")
    .eq("rolle", "verwalter")
    .not("telefon", "is", null)

  // Suffix-Match (siehe production-Implementation)
  const match = matchByPhoneSuffix(verwalter, body.caller_phone)
  if (!match) return NextResponse.json({ error: "Unknown caller" }, { status: 403 })

  // 3. Ticket-Insert
  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      titel: body.extracted_data.beschreibung.slice(0, 80),
      beschreibung: body.extracted_data.beschreibung,
      gewerk: body.extracted_data.gewerk,
      prioritaet: body.extracted_data.dringlichkeit,
      status: "offen",
      vergabemodus: "direkt",
      erstellt_von: match.id,
      verwalter_id: match.id,
      einsatzort_adresse: body.extracted_data.adresse,
      eingetragen_von_verwalter: true,
      eingetragen_via: "voice-ai",
      voice_call_recording_url: body.recording_url,
      voice_call_transcript: body.transcript_full,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 4. SMS fire-and-forget
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://reparo-app.netlify.app"
  void sendSms({
    to: body.caller_phone,
    body: `Reparo-Ticket #${ticket.id.slice(0, 8)}: ${appUrl}/dashboard-verwalter/ticket/${ticket.id}`,
  })

  return NextResponse.json({ ok: true, ticket_id: ticket.id })
}

interface VapiPayload {
  call_id: string
  caller_phone: string
  transcript_full: string
  recording_url: string
  extracted_data: {
    adresse: string
    gewerk: string
    beschreibung: string
    dringlichkeit: "notfall" | "zeitnah" | "planbar"
    mieter_telefon?: string
    fotos_verfuegbar?: boolean
  }
}

function matchByPhoneSuffix(verwalter: any[] | null, callerPhone: string) {
  const suffix = callerPhone.replace(/\D/g, "").slice(-10)
  return verwalter?.find(v => (v.telefon ?? "").replace(/\D/g, "").slice(-10) === suffix)
}
