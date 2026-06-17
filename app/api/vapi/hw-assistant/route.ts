import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { verifyVapiSignature } from "@/lib/sms/verify-vapi-signature"

// POST /api/vapi/hw-assistant
// Sprint AW — Voice-AI Assistent für Handwerker.
//
// Vapi ruft diesen Endpoint in zwei Situationen auf:
//   1. assistant-request  → Wenn das Telefon klingelt, fragt Vapi nach dem
//      Assistenten-Config. Wir geben eine personalisierte Config zurück,
//      abgestimmt auf den anrufenden HW (via Caller-Phone-Lookup).
//   2. tool-calls         → Wenn der HW Fragen stellt ("Was hab ich heute?"),
//      ruft Vapi unsere Tools auf. Wir laden die Daten aus Supabase.
//
// Auth: HMAC via x-vapi-signature (VAPI_WEBHOOK_SECRET). Wenn ENV fehlt,
// wird in dev-Umgebung durchgelassen (Warnung im Log).
//
// Vapi-Docs: https://docs.vapi.ai/server-url

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://reparo-app.netlify.app"

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

interface VapiCall {
  id: string
  customer?: { number?: string }
}

type VapiMessage =
  | { type: "assistant-request"; call: VapiCall }
  | { type: "tool-calls"; call: VapiCall; toolCallList: VapiToolCall[] }
  | { type: "end-of-call-report"; call: VapiCall; transcript?: string }
  | { type: "status-update"; call: VapiCall; status?: string }

interface VapiToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

interface HwProfile {
  id: string
  name: string | null
  telefon: string | null
  startort_adresse: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sucht einen HW in profiles anhand der Caller-Nummer (Suffix-Match). */
async function findHwByPhone(phone: string): Promise<HwProfile | null> {
  const admin = createServiceRoleClient()
  const suffix = phone.replace(/\D/g, "").slice(-10)
  if (!suffix) return null

  const { data } = await admin
    .from("profiles")
    .select("id, name, telefon, startort_adresse")
    .eq("rolle", "handwerker")
    .not("telefon", "is", null)
    .returns<HwProfile[]>()

  return (
    data?.find(p => (p.telefon ?? "").replace(/\D/g, "").slice(-10) === suffix) ?? null
  )
}

/** Heutiges Briefing als gesprochener String (kompakt für TTS). */
async function getBriefingText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) // YYYY-MM-DD

  const { data: termine } = await admin
    .from("termine")
    .select("von, bis, titel, einsatzort_adresse")
    .eq("handwerker_id", hwId)
    .eq("datum", heute)
    .eq("status", "bestaetigt")
    .order("von")
    .returns<Array<{ von: string; bis: string; titel: string; einsatzort_adresse: string | null }>>()

  if (!termine || termine.length === 0) {
    return "Du hast heute keine bestätigten Termine. Schau in deine offenen Aufträge – vielleicht gibt es neue Anfragen."
  }

  const stopsText = termine
    .map((t, i) => {
      const von = t.von?.slice(0, 5) ?? "?"
      const titel = t.titel ?? "Termin"
      const ort = t.einsatzort_adresse
        ? ` in ${t.einsatzort_adresse.split(",")[0]}`  // Nur Straße, kein langer Adressblock
        : ""
      return `${i + 1}. Um ${von} Uhr: ${titel}${ort}.`
    })
    .join(" ")

  return `Du hast heute ${termine.length} Termin${termine.length === 1 ? "" : "e"}. ${stopsText}`
}

/** Offene Einladungen/Anfragen als gesprochener String. */
async function getOffeneAnfragenText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()

  const { count: einladungen } = await admin
    .from("einladungen")
    .select("*", { count: "exact", head: true })
    .eq("handwerker_id", hwId)
    .eq("status", "offen")

  const { count: termine } = await admin
    .from("termine")
    .select("*", { count: "exact", head: true })
    .eq("handwerker_id", hwId)
    .eq("status", "vorgeschlagen")

  const parts: string[] = []
  if (einladungen && einladungen > 0) {
    parts.push(`${einladungen} offene Auftrag${einladungen === 1 ? "" : "sanfragen"}`)
  }
  if (termine && termine > 0) {
    parts.push(`${termine} Termin${termine === 1 ? "" : "vorschläge"} die auf Bestätigung warten`)
  }

  if (parts.length === 0) {
    return "Du hast aktuell keine offenen Anfragen. Alles erledigt!"
  }

  return `Du hast ${parts.join(" und ")}. Schau kurz in Reparo.`
}

// ---------------------------------------------------------------------------
// Vapi Assistent-Config
// ---------------------------------------------------------------------------

function buildAssistantConfig(hw: HwProfile | null) {
  const vorname = hw?.name?.split(" ")[0] ?? null

  const greeting = vorname
    ? `Hallo ${vorname}! Ich bin dein Reparo-Assistent. Was kann ich für dich tun?`
    : "Hallo! Ich bin der Reparo-Assistent. Deine Nummer ist leider nicht in Reparo hinterlegt. Bitte trag sie in deinem Profil nach."

  const systemPrompt = hw
    ? `Du bist der persönliche Sprachassistent für den Handwerker ${hw.name ?? "dieser Person"} in der Reparo-Plattform.

Du kannst Folgendes beantworten:
- Heutige Termine und Route (Tool: get_heutiges_briefing)
- Offene Anfragen und wartende Terminbestätigungen (Tool: get_offene_anfragen)

Regeln:
- Antworte immer kurz und klar — der Handwerker ist oft unterwegs oder im Auto.
- Kein Fachjargon, kein HTML, keine Markdown-Formatierung.
- Sprich Deutsch, du-Form.
- Wenn du etwas nicht weißt, sag es direkt.
- Frag maximal eine Folgefrage pro Antwort.`
    : "Du bist der Reparo-Assistent. Die Handynummer des Anrufers ist nicht in Reparo hinterlegt. Bitte erklär das freundlich und beende das Gespräch."

  const tools = hw
    ? [
        {
          type: "function",
          function: {
            name: "get_heutiges_briefing",
            description:
              "Gibt die heutigen bestätigten Termine mit Uhrzeit und Ort zurück. Aufrufen wenn der HW nach seinen Terminen oder seinem Tagesplan fragt.",
            parameters: { type: "object", properties: {}, required: [] },
          },
        },
        {
          type: "function",
          function: {
            name: "get_offene_anfragen",
            description:
              "Gibt die Anzahl offener Auftragsanfragen und ausstehender Terminbestätigungen zurück.",
            parameters: { type: "object", properties: {}, required: [] },
          },
        },
      ]
    : []

  return {
    firstMessage: greeting,
    model: {
      provider: "anthropic",
      model: "claude-haiku-4-5",
      temperature: 0.3,
      systemPrompt,
      maxTokens: 200,
    },
    voice: {
      provider: "azure",
      voiceId: "de-DE-ConradNeural",  // Männliche deutsche Stimme (alternativ: de-DE-KatjaNeural)
    },
    serverUrl: `${SITE_URL}/api/vapi/hw-assistant`,
    serverMessages: ["tool-calls"],
    tools,
    endCallMessage: "Alles klar. Bis bald und einen guten Tag!",
    endCallPhrases: ["tschüss", "auf wiedersehen", "danke tschüss", "ciao", "bye", "tschau"],
    maxDurationSeconds: 300,  // 5 Minuten max — Schutz vor versehentlich offenem Anruf
    backgroundSound: "off",
    silenceTimeoutSeconds: 30,
    responseDelaySeconds: 0.4,  // kurze Pause vor Antwort wirkt natürlicher
  }
}

// ---------------------------------------------------------------------------
// Route-Handler
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Signatur-Prüfung. Ohne VAPI_WEBHOOK_SECRET im ENV nur warnen (dev-Modus).
  const secret = process.env.VAPI_WEBHOOK_SECRET
  const sig = request.headers.get("x-vapi-signature")
  if (secret) {
    if (!verifyVapiSignature(rawBody, sig, secret)) {
      console.warn("[vapi/hw-assistant] Ungültige Signatur abgelehnt")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  } else {
    console.warn("[vapi/hw-assistant] VAPI_WEBHOOK_SECRET nicht gesetzt — Signatur-Check übersprungen")
  }

  let payload: { message?: VapiMessage }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const msg = payload.message
  if (!msg) {
    // Vapi sendet manchmal leere Pings → 200 zurück
    return NextResponse.json({ ok: true })
  }

  // ---- 1. assistant-request — Assistent-Config zurückgeben ----
  if (msg.type === "assistant-request") {
    const callerPhone = msg.call.customer?.number ?? ""
    const hw = callerPhone ? await findHwByPhone(callerPhone) : null
    if (!hw) {
      console.log(`[vapi/hw-assistant] Unbekannte Nummer: ${callerPhone}`)
    }
    return NextResponse.json({ assistant: buildAssistantConfig(hw) })
  }

  // ---- 2. tool-calls — Daten aus Supabase liefern ----
  if (msg.type === "tool-calls") {
    const callerPhone = msg.call.customer?.number ?? ""
    const hw = callerPhone ? await findHwByPhone(callerPhone) : null

    const results = await Promise.all(
      msg.toolCallList.map(async (tc) => {
        if (!hw) {
          return { toolCallId: tc.id, result: "Fehler: Kein Handwerker-Profil gefunden." }
        }

        let result = "Diese Funktion ist momentan nicht verfügbar."

        if (tc.function.name === "get_heutiges_briefing") {
          result = await getBriefingText(hw.id)
        } else if (tc.function.name === "get_offene_anfragen") {
          result = await getOffeneAnfragenText(hw.id)
        }

        return { toolCallId: tc.id, result }
      })
    )

    return NextResponse.json({ results })
  }

  // ---- 3. Alles andere (status-update, end-of-call-report) ----
  return NextResponse.json({ ok: true })
}
