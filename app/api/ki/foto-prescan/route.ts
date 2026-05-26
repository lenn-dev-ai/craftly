import { NextResponse, type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// POST /api/ki/foto-prescan
// Sprint AF Phase 2 — Schneller Vision-Call der ein Foto auf 1 der 8
// Pill-Keys mappt (heizung/wasser/elektro/tuer/schimmel/dach/fassade/
// boden/sonstiges). Antwortet binnen ~1.5s und wird im Mieter-Wizard
// HINTERGRUND-AUFGERUFEN — UI rendert vorab Default-Pills, hebt die
// likelyPill hervor sobald die Response da ist.
//
// Unterschied zu /api/ki/schadenserkennung:
//   - Hier nur 1 Token (pill-key), keine Beschreibung/Titel
//   - Schneller (claude-haiku-4-5 + max_tokens=10)
//   - Kein Cache (Pre-Scan ist je Bild einmalig)

const MODEL = "claude-haiku-4-5"
const MAX_BYTES = 4 * 1024 * 1024
const ERLAUBTE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

const VALID_PILLS = new Set([
  "heizung", "wasser", "elektro", "tuer", "schimmel",
  "dach", "fassade", "boden", "sonstiges",
])

const SYSTEM = `Du klassifizierst Wohnungsschaden-Fotos. Antworte AUSSCHLIESSLICH mit genau einem der folgenden keys (kein json, kein satz, kein code-block, nur das wort):
heizung | wasser | elektro | tuer | schimmel | dach | fassade | boden | sonstiges

Beispiele:
- nasse decke → wasser
- schimmelfleck → schimmel
- defekte tür → tuer
- kaputter heizkörper → heizung`

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "AI nicht konfiguriert" }, { status: 503 })
  }

  let foto: File | null = null
  try {
    const form = await request.formData()
    const candidate = form.get("foto")
    if (candidate instanceof File) foto = candidate
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 })
  }
  if (!foto) return NextResponse.json({ error: "Foto fehlt" }, { status: 400 })
  if (foto.size === 0 || foto.size > MAX_BYTES) {
    return NextResponse.json({ error: `Foto-Größe muss zwischen 1 Byte und ${MAX_BYTES} Byte sein` }, { status: 400 })
  }
  if (!ERLAUBTE_MIMES.has(foto.type)) {
    return NextResponse.json({ error: `Nur ${Array.from(ERLAUBTE_MIMES).join(", ")} erlaubt` }, { status: 400 })
  }

  const buf = Buffer.from(await foto.arrayBuffer())
  const b64 = buf.toString("base64")
  const mediaType = (foto.type === "image/jpeg" || foto.type === "image/png" || foto.type === "image/gif" || foto.type === "image/webp")
    ? foto.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp"
    : "image/jpeg"

  try {
    const client = new Anthropic({ apiKey })
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 10,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: b64 },
            },
            { type: "text", text: "Klassifiziere." },
          ],
        },
      ],
    })

    let raw = ""
    for (const block of resp.content) {
      if (block.type === "text") raw += block.text
    }
    const key = raw.toLowerCase().trim().split(/\s+/)[0] ?? "sonstiges"
    const likelyPill = VALID_PILLS.has(key) ? key : "sonstiges"

    return NextResponse.json(
      { likelyPill, raw },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "vision-call failed" },
      { status: 502 },
    )
  }
}
