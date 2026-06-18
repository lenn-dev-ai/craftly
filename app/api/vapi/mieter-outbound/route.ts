import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { verifyVapiSignature } from "@/lib/sms/verify-vapi-signature"

// POST /api/vapi/mieter-outbound
// Sprint BB — Webhook für Voice-AI V2 Outbound-Rückruf an Mieter.
//
// Vapi ruft diesen Endpoint auf wenn:
//   1. tool-calls       → Mieter hat Infos gegeben, KI will Ticket updaten
//   2. end-of-call-report → Gespräch beendet (Abnehmer oder nicht)
//   3. status-update    → ignoriert
//
// ticket_id kommt via call.metadata.ticket_id (gesetzt in trigger-rueckruf).
// Auth: HMAC via x-vapi-signature (VAPI_WEBHOOK_SECRET).

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

interface VapiCall {
  id: string
  customer?: { number?: string }
  metadata?: Record<string, string>
}

type VapiMessage =
  | { type: "tool-calls"; call: VapiCall; toolCallList: VapiToolCall[] }
  | { type: "end-of-call-report"; call: VapiCall; endedReason?: string; transcript?: string }
  | { type: "status-update"; call: VapiCall; status?: string }
  | { type: "assistant-request"; call: VapiCall }

interface VapiToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

interface UpdateTicketArgs {
  beschreibung?: string
  einsatzort_adresse?: string
}

// ---------------------------------------------------------------------------
// Route-Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const secret = process.env.VAPI_WEBHOOK_SECRET
  const sig = request.headers.get("x-vapi-signature")
  if (secret) {
    if (!verifyVapiSignature(rawBody, sig, secret)) {
      console.warn("[vapi/mieter-outbound] Ungültige Signatur abgelehnt")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  } else {
    console.warn("[vapi/mieter-outbound] VAPI_WEBHOOK_SECRET nicht gesetzt")
  }

  let payload: { message?: VapiMessage }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const msg = payload.message
  if (!msg) return NextResponse.json({ ok: true })

  const ticketId = msg.call.metadata?.ticket_id
  const admin = createServiceRoleClient()

  // ---- tool-calls — Ticket mit gesammelten Infos updaten ----
  if (msg.type === "tool-calls") {
    const results = await Promise.all(
      msg.toolCallList.map(async (tc) => {
        if (tc.function.name !== "update_ticket") {
          return { toolCallId: tc.id, result: "Unbekanntes Tool." }
        }

        if (!ticketId) {
          console.error("[vapi/mieter-outbound] tool-calls ohne ticket_id in metadata")
          return { toolCallId: tc.id, result: "Fehler: Kein Ticket-Bezug." }
        }

        let args: UpdateTicketArgs = {}
        try {
          args = JSON.parse(tc.function.arguments) as UpdateTicketArgs
        } catch {
          return { toolCallId: tc.id, result: "Fehler: Ungültige Argumente." }
        }

        const updates: Record<string, unknown> = {}
        if (args.beschreibung && args.beschreibung.trim().length > 5) {
          updates.beschreibung = args.beschreibung.trim()
        }
        if (args.einsatzort_adresse && args.einsatzort_adresse.trim().length > 5) {
          updates.einsatzort_adresse = args.einsatzort_adresse.trim()
        }

        if (Object.keys(updates).length === 0) {
          return { toolCallId: tc.id, result: "Keine Änderungen — zu kurze Angaben." }
        }

        const { error } = await admin.from("tickets").update(updates).eq("id", ticketId)
        if (error) {
          console.error("[vapi/mieter-outbound] Ticket-Update fehlgeschlagen:", error.message)
          return { toolCallId: tc.id, result: "Speichern fehlgeschlagen — bitte nochmal." }
        }

        console.log(`[vapi/mieter-outbound] Ticket ${ticketId} aktualisiert:`, Object.keys(updates))
        return { toolCallId: tc.id, result: "Gespeichert. Danke!" }
      }),
    )

    return NextResponse.json({ results })
  }

  // ---- end-of-call-report — Status abschließen ----
  if (msg.type === "end-of-call-report") {
    if (ticketId) {
      const endedReason = (msg as { type: "end-of-call-report"; call: VapiCall; endedReason?: string }).endedReason ?? ""
      const nichtAbgenommen = endedReason.includes("did-not-answer") || endedReason.includes("no-answer")
      const newStatus = nichtAbgenommen ? "fehlgeschlagen" : "durchgefuehrt"

      await admin.from("tickets").update({ rueckruf_status: newStatus }).eq("id", ticketId)
      console.log(`[vapi/mieter-outbound] Ticket ${ticketId} → rueckruf_status=${newStatus} (${endedReason})`)
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
