import { NextResponse, type NextRequest } from "next/server"
import { createHash } from "crypto"
import Anthropic from "@anthropic-ai/sdk"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

// POST /api/ki/schadenserkennung
// Body: multipart/form-data mit 'foto' (Bild)
// Auth: jeder eingeloggte User (Mieter beim Melden)
//
// Antwort:
//   { schadensart, gewerk, dringlichkeit, titel_vorschlag,
//     beschreibung_vorschlag, confidence, hinweis? }
//
// Modell: claude-haiku-4-5 (günstig + schnell für Klassifikation).
// Bei fehlendem API-Key: 503 mit aussagekräftiger Meldung —
// das Mieter-UI fällt dann auf den Regex-Heuristik-Fallback zurück.

const MODEL = "claude-haiku-4-5"
const MAX_BYTES = 5 * 1024 * 1024
// Claude Vision akzeptiert JPEG/PNG/WebP/GIF — HEIC nicht. iPhone-User
// müssen vorher konvertieren (Browser-File-Picker macht das oft selbst).
const ERLAUBTE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

const SYSTEM_PROMPT = `Du bist ein Schadens-Klassifizierer für eine Hausverwaltungs-Plattform in Deutschland.
Analysiere das Foto eines Gebäudeschadens und antworte AUSSCHLIESSLICH als valides JSON (kein Markdown-Codeblock, kein Text drumherum):

{
  "schadensart": "sanitaer" | "elektrik" | "heizung" | "fenster_tuer" | "dach" | "fassade" | "boden" | "schimmel" | "sonstiges",
  "gewerk": "Klempner" | "Elektriker" | "Heizungsbauer" | "Tischler" | "Dachdecker" | "Maler" | "Bodenleger" | "Schimmel-Sanierer" | "Allgemein",
  "dringlichkeit": "notfall" | "zeitnah" | "planbar",
  "titel_vorschlag": "Kurzer Titel für das Ticket (max 60 Zeichen)",
  "beschreibung_vorschlag": "Detaillierte Beschreibung des Schadens in 2-3 Sätzen",
  "confidence": 0.0,
  "hinweis": "Optionaler Hinweis falls das Bild unklar ist"
}

Regeln Dringlichkeit:
- notfall: Aktive Wasserlecks, Stromausfall, Gasgeruch, Sturmschäden, kaputte Heizung im Winter
- zeitnah: Tropfende Hähne, defekte Steckdosen, klemmende Türen, kleine Risse
- planbar: Kosmetische Schäden, Verschleiß, Renovierungsbedarf

confidence < 0.3 wenn das Bild keinen Schaden zeigt oder unklar ist — dann hinweis-Feld füllen.`

const ALLOWED_SCHADENSARTEN = new Set([
  "sanitaer", "elektrik", "heizung", "fenster_tuer", "dach", "fassade", "boden", "schimmel", "sonstiges",
])
const ALLOWED_DRINGLICHKEIT = new Set(["notfall", "zeitnah", "planbar"])

interface KiAntwort {
  schadensart: string
  gewerk: string
  dringlichkeit: string
  titel_vorschlag: string
  beschreibung_vorschlag: string
  confidence: number
  hinweis?: string
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY nicht konfiguriert — Schadenserkennung deaktiviert" },
      { status: 503 },
    )
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // FIX-9: Erst Request validieren (formData/MIME/Size), DANN Quota
  // verbrauchen. Sonst: kaputter Request (falscher MIME, zu groß,
  // kein Foto-Feld) verbrennt trotzdem ein Tages-Credit beim User.
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "multipart/form-data erforderlich" }, { status: 400 })
  }
  const file = formData.get("foto")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Feld 'foto' fehlt oder ist kein File" }, { status: 400 })
  }
  if (!ERLAUBTE_MIMES.has(file.type)) {
    return NextResponse.json(
      { error: `MIME ${file.type} nicht unterstützt (JPEG/PNG/WebP/GIF)` },
      { status: 415 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Datei zu groß (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 413 },
    )
  }

  // Foto einmal als Buffer einlesen — wird sowohl für Hash als auch für
  // den Anthropic-Call gebraucht.
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const fotoHash = createHash("sha256").update(buffer).digest("hex")

  // KI-3 Sprint 3: Hash-Cache. Wenn der gleiche User dasselbe Foto
  // schon in den letzten 24h hochgeladen hat, gecachtes Ergebnis
  // zurückgeben — kein erneuter Anthropic-Call, kein Quota-Verbrauch.
  const admin = createServiceRoleClient()
  const cacheSeit = new Date(Date.now() - 86400_000).toISOString()
  const { data: cached } = await admin
    .from("ki_analysen_cache")
    .select("ergebnis")
    .eq("user_id", user.id)
    .eq("foto_hash", fotoHash)
    .gte("created_at", cacheSeit)
    .maybeSingle<{ ergebnis: KiAntwort }>()
  if (cached?.ergebnis) {
    return NextResponse.json({ ...cached.ergebnis, cached: true })
  }

  // Rate-Limit: max 10 KI-Calls/Tag/User. Atomic check+increment in
  // Postgres (siehe supabase/migrations/20260520100000_*).
  // Schutz vor Anthropic-Kostenexplosion durch kompromittierte Accounts
  // oder ungeduldige Mieter, die das Foto-Upload-Feature spammen.
  const { data: quotaResult, error: quotaErr } = await supabase
    .rpc("try_consume_ki_quota", { _max_per_day: 10 })
    .single<{ allowed: boolean; remaining: number; reset_at: string }>()
  if (quotaErr) {
    return NextResponse.json(
      { error: "Quota-Check fehlgeschlagen: " + quotaErr.message },
      { status: 500 },
    )
  }
  if (!quotaResult?.allowed) {
    return NextResponse.json(
      {
        error: "Tageslimit erreicht (10 KI-Analysen/Tag). Versuch's morgen wieder oder beschreibe den Schaden manuell.",
        resetAt: quotaResult?.reset_at,
      },
      { status: 429 },
    )
  }

  const base64 = buffer.toString("base64")

  const anthropic = new Anthropic({ apiKey })

  let kiAntwort: KiAntwort
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                data: base64,
              },
            },
            { type: "text", text: "Analysiere diesen Gebäudeschaden gemäß System-Prompt." },
          ],
        },
      ],
    })

    const textBlock = message.content.find(c => c.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Keine Text-Antwort vom Modell" }, { status: 502 })
    }
    // Manchmal kommt das JSON in einem Markdown-Code-Block — strippen
    const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim()
    kiAntwort = JSON.parse(raw) as KiAntwort
  } catch (err) {
    return NextResponse.json(
      { error: "KI-Analyse fehlgeschlagen", details: err instanceof Error ? err.message : "unbekannt" },
      { status: 502 },
    )
  }

  // KI-3 Sprint 3: Antwort cachen, damit identische Folge-Uploads kein
  // neues Quota verbrauchen. Best-effort: bei Konflikt (z.B. parallele
  // Calls) onConflict-Update.
  void admin.from("ki_analysen_cache").upsert(
    { user_id: user.id, foto_hash: fotoHash, ergebnis: kiAntwort },
    { onConflict: "user_id,foto_hash" },
  ).then(({ error }) => {
    if (error) console.warn("[ki-cache] Upsert fail:", error.message)
  })

  // Sanity-Checks der Modell-Antwort
  if (!ALLOWED_SCHADENSARTEN.has(kiAntwort.schadensart)) kiAntwort.schadensart = "sonstiges"
  if (!ALLOWED_DRINGLICHKEIT.has(kiAntwort.dringlichkeit)) kiAntwort.dringlichkeit = "planbar"
  if (typeof kiAntwort.confidence !== "number" || !isFinite(kiAntwort.confidence)) kiAntwort.confidence = 0
  kiAntwort.confidence = Math.max(0, Math.min(1, kiAntwort.confidence))

  return NextResponse.json(kiAntwort)
}
