import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { verifyVapiSignature } from "@/lib/sms/verify-vapi-signature"
import {
  scoreEinladung,
  scoreZuSprache,
  type EinladungInput,
  type HwPreferences,
} from "@/lib/agent/score-einladung"

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

/** Sprint AX Phase 4 — Neue Anfragen mit Agent-Empfehlung (gesprochener String). */
async function getNeuAnfragenMitEmpfehlungText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()

  // HW-Präferenzen laden (brauchen wir für Score)
  const { data: hwData } = await admin
    .from("profiles")
    .select("handwerker_gewerke, gewerk, radius_km, agent_max_radius_km, agent_auto_accept, agent_min_auftragswert, startort_lat, startort_lng, mindest_stundensatz")
    .eq("id", hwId)
    .single()

  if (!hwData) return "Ich konnte deine Einstellungen nicht laden."

  const hwPrefs: HwPreferences = {
    handwerker_gewerke: (hwData as { handwerker_gewerke?: string[] | null }).handwerker_gewerke ?? null,
    gewerk: (hwData as { gewerk?: string | null }).gewerk ?? null,
    radius_km: (hwData as { radius_km?: number | null }).radius_km ?? null,
    agent_max_radius_km: (hwData as { agent_max_radius_km?: number | null }).agent_max_radius_km ?? null,
    agent_auto_accept: (hwData as { agent_auto_accept?: boolean }).agent_auto_accept ?? false,
    agent_min_auftragswert: (hwData as { agent_min_auftragswert?: number | null }).agent_min_auftragswert ?? null,
    startort_lat: (hwData as { startort_lat?: number | null }).startort_lat ?? null,
    startort_lng: (hwData as { startort_lng?: number | null }).startort_lng ?? null,
    mindest_stundensatz: (hwData as { mindest_stundensatz?: number | null }).mindest_stundensatz ?? null,
  }

  // Offene Einladungen laden (max 5 für Voice-Briefing)
  interface RawEinladung {
    id: string
    ticket_id: string
    tickets: {
      titel: string
      gewerk: string | null
      einsatzort_adresse: string | null
      einsatzort_lat: number | null
      einsatzort_lng: number | null
      kosten_final: number | null
      dringlichkeit: string | null
    } | null
  }

  const { data: einladungen } = await admin
    .from("einladungen")
    .select("id, ticket_id, tickets (titel, gewerk, einsatzort_adresse, einsatzort_lat, einsatzort_lng, kosten_final, dringlichkeit)")
    .eq("handwerker_id", hwId)
    .eq("status", "offen")
    .order("erstellt_am", { ascending: false })
    .limit(5)
    .returns<RawEinladung[]>()

  if (!einladungen || einladungen.length === 0) {
    return "Du hast aktuell keine neuen Anfragen. Alles erledigt!"
  }

  // Jede Anfrage bewerten
  const scored = einladungen.map(e => {
    const t = e.tickets
    const input: EinladungInput = {
      id: e.id,
      ticket_id: e.ticket_id,
      titel: t?.titel ?? "Auftrag",
      gewerk: t?.gewerk ?? null,
      einsatzort_adresse: t?.einsatzort_adresse ?? null,
      einsatzort_lat: t?.einsatzort_lat ?? null,
      einsatzort_lng: t?.einsatzort_lng ?? null,
      kosten_final: t?.kosten_final ?? null,
      dringlichkeit: t?.dringlichkeit ?? null,
    }
    return { input, score: scoreEinladung(input, hwPrefs) }
  })

  // Beste zuerst
  scored.sort((a, b) => b.score.score - a.score.score)

  const texte = scored.map(({ input, score }) => scoreZuSprache(input, score))
  const intro = `Du hast ${einladungen.length} neue Anfrage${einladungen.length === 1 ? "" : "n"}. `
  return intro + texte.join(" Als Nächstes: ") + " Schau in Reparo für Details."
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
- Neue Anfragen mit Agent-Empfehlung (Tool: get_neue_anfragen_mit_empfehlung)

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
        {
          type: "function",
          function: {
            name: "get_neue_anfragen_mit_empfehlung",
            description:
              "Sprint AX: Listet neue Direktvergabe-Anfragen mit Agent-Empfehlung (annehmen/ablehnen/prüfen) auf. Aufrufen wenn der HW fragt 'Was empfiehlst du mir?', 'Was sind neue Anfragen?' oder 'Welche Aufträge lohnen sich?'.",
            parameters: { type: "object", properties: {}, required: [] },
          },
        },
      ]
    : []

  const config: Record<string, unknown> = {
    firstMessage: greeting,
    transcriber: {
      provider: "deepgram",
      model: "nova-3",
      language: "de",
    },
    model: {
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      temperature: 0.3,
      messages: [{ role: "system", content: systemPrompt }],
      maxTokens: 200,
    },
    voice: {
      provider: "11labs",
      voiceId: "FUfBrNit0NNZAwb58KWH",  // Dt. Stimme — gleiche wie Lead Follow-up Agent (DE)
      model: "eleven_turbo_v2_5",
    },
    endCallMessage: "Alles klar. Bis bald und einen guten Tag!",
    endCallPhrases: ["tschüss", "auf wiedersehen", "danke tschüss", "ciao", "bye", "tschau"],
    maxDurationSeconds: 300,  // 5 Minuten max — Schutz vor versehentlich offenem Anruf
    silenceTimeoutSeconds: 30,
    responseDelaySeconds: 0.4,  // kurze Pause vor Antwort wirkt natürlicher
  }

  // Tools nur setzen wenn vorhanden — leeres Array kann Vapi verwirren
  if (tools.length > 0) {
    config.tools = tools
    // serverUrl + serverMessages nur wenn tools aktiv sind (für tool-calls nötig)
    config.serverUrl = `${SITE_URL}/api/vapi/hw-assistant`
    config.serverMessages = ["tool-calls"]
  }

  return config
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
        } else if (tc.function.name === "get_neue_anfragen_mit_empfehlung") {
          result = await getNeuAnfragenMitEmpfehlungText(hw.id)
        }

        return { toolCallId: tc.id, result }
      })
    )

    return NextResponse.json({ results })
  }

  // ---- 3. Alles andere (status-update, end-of-call-report) ----
  return NextResponse.json({ ok: true })
}
