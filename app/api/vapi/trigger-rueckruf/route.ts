import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// POST /api/vapi/trigger-rueckruf
// Body: { ticket_id: string }
// Auth: Session-User muss Ersteller des Tickets sein.
//
// Prüft ob das Ticket "lückenhaft" ist (Beschreibung < 30 Zeichen oder
// keine Adresse). Falls ja und der Mieter eine Telefonnummer hat, wird
// via Vapi API ein Outbound-Call initiiert.
//
// ENV required:
//   VAPI_API_KEY           — Vapi API Key
//   VAPI_PHONE_NUMBER_ID   — Vapi-Rufnummer-ID (von der aus angerufen wird)
//   VAPI_WEBHOOK_SECRET    — HMAC-Secret (gleich wie für hw-assistant)
//   NEXT_PUBLIC_SITE_URL   — Basis-URL für serverUrl im Assistant-Config

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://reparo-app.netlify.app"
const VAPI_API_KEY = process.env.VAPI_API_KEY
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

interface TicketRow {
  id: string
  titel: string
  beschreibung: string | null
  einsatzort_adresse: string | null
  wohneinheit_referenz: string | null
  gewerk: string | null
  erstellt_von: string
  rueckruf_status: string
}

interface ProfileRow {
  id: string
  name: string | null
  telefon: string | null
}

interface FehlendInfo {
  lückenhaft: boolean
  fehlende: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pruefeLückenhaft(ticket: TicketRow): FehlendInfo {
  const fehlende: string[] = []

  const beschr = (ticket.beschreibung ?? "").trim()
  if (beschr.length < 30) fehlende.push("beschreibung")

  const hatAdresse = Boolean(ticket.einsatzort_adresse) || Boolean(ticket.wohneinheit_referenz)
  if (!hatAdresse) fehlende.push("adresse")

  return { lückenhaft: fehlende.length > 0, fehlende }
}

/** Telefonnummer → E.164 (+49...). Gibt null zurück wenn nicht normalisierbar. */
function toE164(telefon: string): string | null {
  const digits = telefon.replace(/\D/g, "")
  if (digits.length < 7) return null
  if (telefon.trimStart().startsWith("+")) return "+" + digits
  if (digits.startsWith("00")) return "+" + digits.slice(2)
  if (digits.startsWith("0") && digits.length >= 10) return "+49" + digits.slice(1)
  if (digits.length >= 10) return "+49" + digits
  return null
}

function buildAssistantConfig(
  ticket: TicketRow,
  fehlende: string[],
  mieterName: string | null,
) {
  const vorname = mieterName?.split(" ")[0] ?? "du"

  const fehlendText = fehlende
    .map(f => {
      if (f === "beschreibung") return "eine genauere Beschreibung des Schadens"
      if (f === "adresse") return "die genaue Adresse, wo der Schaden ist"
      return f
    })
    .join(" und ")

  const systemPrompt = `Du bist der Reparo-Assistent und rufst ${vorname} an — sie haben gerade einen Schaden gemeldet.
Titel des Tickets: "${ticket.titel}"

Fehlende Informationen: ${fehlendText}.
Stelle genau 1–2 kurze Fragen um diese Infos zu erfragen.
Sobald du sie hast, ruf sofort das Tool update_ticket auf.
Halte das Gespräch unter 2 Minuten. Kein Smalltalk.
Sprich Deutsch, du-Form, freundlich und direkt.`

  return {
    firstMessage: `Hallo ${vorname}, hier ist dein Reparo-Assistent. Du hast gerade einen Schaden gemeldet – ${ticket.titel}. Ich hab noch eine kurze Rückfrage dazu, geht das kurz?`,
    model: {
      provider: "anthropic",
      model: "claude-haiku-4-5",
      temperature: 0.2,
      systemPrompt,
      maxTokens: 150,
    },
    voice: {
      provider: "azure",
      voiceId: "de-DE-KatjaNeural",
    },
    tools: [
      {
        type: "function",
        function: {
          name: "update_ticket",
          description: "Speichert die vom Mieter geklärten Angaben zum Ticket.",
          parameters: {
            type: "object",
            properties: {
              beschreibung: {
                type: "string",
                description: "Genauere Beschreibung des Schadens, wie vom Mieter geschildert",
              },
              einsatzort_adresse: {
                type: "string",
                description: "Vollständige Adresse des Schadens (Straße, Hausnr., PLZ, Ort)",
              },
            },
            required: [],
          },
        },
      },
    ],
    serverUrl: `${SITE_URL}/api/vapi/mieter-outbound`,
    endCallMessage: "Danke sehr, ich habe alles notiert. Einen schönen Tag noch!",
    endCallPhrases: ["tschüss", "auf wiedersehen", "danke", "ciao", "bye", "tschau"],
    maxDurationSeconds: 180,
    backgroundSound: "off",
    silenceTimeoutSeconds: 20,
    responseDelaySeconds: 0.4,
  }
}

// ---------------------------------------------------------------------------
// Route-Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { ticket_id?: string }
  try {
    body = await request.json() as { ticket_id?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const ticketId = body.ticket_id
  if (!ticketId) return NextResponse.json({ error: "ticket_id fehlt" }, { status: 400 })

  const admin = createServiceRoleClient()

  // Ticket laden
  const { data: ticket, error: ticketErr } = await admin
    .from("tickets")
    .select("id, titel, beschreibung, einsatzort_adresse, wohneinheit_referenz, gewerk, erstellt_von, rueckruf_status")
    .eq("id", ticketId)
    .single<TicketRow>()

  if (ticketErr || !ticket) {
    return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  }

  // Sicherheitscheck: nur Ersteller darf Rückruf triggern
  if (ticket.erstellt_von !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Idempotenz: bereits geplant → nicht nochmal
  if (ticket.rueckruf_status !== "idle") {
    return NextResponse.json({ initiated: false, grund: "bereits_verarbeitet" })
  }

  // Vollständigkeit prüfen
  const { lückenhaft, fehlende } = pruefeLückenhaft(ticket)

  if (!lückenhaft) {
    await admin.from("tickets").update({ rueckruf_status: "nicht_noetig" }).eq("id", ticketId)
    return NextResponse.json({ initiated: false, grund: "vollstaendig" })
  }

  // Mieter-Profil laden (Telefonnummer)
  const { data: profile } = await admin
    .from("profiles")
    .select("id, name, telefon")
    .eq("id", user.id)
    .single<ProfileRow>()

  const rawTelefon = profile?.telefon ?? ""
  const telefon = rawTelefon ? toE164(rawTelefon) : null

  if (!telefon) {
    console.log(`[trigger-rueckruf] Kein Telefon für Mieter ${user.id} — kein Rückruf`)
    await admin.from("tickets").update({ rueckruf_status: "fehlgeschlagen" }).eq("id", ticketId)
    return NextResponse.json({ initiated: false, grund: "kein_telefon" })
  }

  if (!VAPI_API_KEY || !VAPI_PHONE_NUMBER_ID) {
    console.warn("[trigger-rueckruf] VAPI_API_KEY oder VAPI_PHONE_NUMBER_ID fehlt — Rückruf übersprungen")
    return NextResponse.json({ initiated: false, grund: "vapi_nicht_konfiguriert" })
  }

  // Vapi Outbound-Call initiieren
  const vapiBody = {
    phoneNumberId: VAPI_PHONE_NUMBER_ID,
    customer: { number: telefon },
    metadata: {
      ticket_id: ticketId,
      fehlende: fehlende.join(","),
    },
    assistant: buildAssistantConfig(ticket, fehlende, profile?.name ?? null),
  }

  let vapiOk = false
  try {
    const vapiRes = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vapiBody),
    })

    if (!vapiRes.ok) {
      const errText = await vapiRes.text()
      console.error(`[trigger-rueckruf] Vapi Fehler ${vapiRes.status}: ${errText}`)
    } else {
      vapiOk = true
    }
  } catch (err) {
    console.error("[trigger-rueckruf] Vapi-Fetch fehlgeschlagen:", err)
  }

  const newStatus = vapiOk ? "geplant" : "fehlgeschlagen"
  await admin.from("tickets").update({ rueckruf_status: newStatus }).eq("id", ticketId)

  return NextResponse.json({ initiated: vapiOk, fehlende })
}
