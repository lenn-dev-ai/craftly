import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { createServiceRoleClient } from "@/lib/supabase-server"
import Anthropic from "@anthropic-ai/sdk"
import { haversineKm, schaetzeFahrzeitMin } from "@/lib/distance"

// GET /api/hw/tages-briefing?datum=2026-06-16
// Sprint AV — KI-Assistent für Handwerker.
//
// Generiert ein strukturiertes Tages-Briefing:
//   1. Heutige Termine sortiert nach optimaler Route (Greedy Nearest-Neighbor)
//   2. Geschätzte Fahrzeiten zwischen den Stops
//   3. KI-generierter Kurztext (Claude Haiku) — motivierend + informativ
//
// Wird vom HW-Dashboard-Widget UND vom Cron (hw-morgen-briefing.mts) genutzt.
// Für den Cron wird zusätzlich ?userId=... per CRON_SECRET übergeben.

const MODEL = "claude-haiku-4-5"

interface TerminStop {
  id: string
  titel: string
  datum: string
  von: string
  bis: string
  adresse: string | null
  lat: number | null
  lng: number | null
  ticketId: string | null
}

interface BriefingStop extends TerminStop {
  reihenfolge: number
  fahrzeitVorher: number   // Minuten vom vorherigen Stop (oder Startort)
  distanzVorherKm: number
}

export interface TagesBriefingResponse {
  datum: string
  stops: BriefingStop[]
  gesamtFahrzeitMin: number
  gesamtDistanzKm: number
  aktiveAuftraege: number  // offene Tickets ohne Termin heute
  kiText: string           // KI-generierter Kurztext
  startortAdresse: string | null
}

// Greedy Nearest-Neighbor-Heuristik: sortiert Stops so, dass die
// Gesamtfahrzeit minimiert wird. Startet vom HW-Startort.
function optimiereReihenfolge(
  stops: TerminStop[],
  startLat: number | null,
  startLng: number | null,
): TerminStop[] {
  if (stops.length <= 1) return stops

  // Stops mit Koordinaten zuerst optimieren, dann Rest anhängen
  const mitKoords = stops.filter(s => s.lat != null && s.lng != null)
  const ohneKoords = stops.filter(s => s.lat == null || s.lng == null)

  if (mitKoords.length <= 1) return [...stops]

  const result: TerminStop[] = []
  const remaining = [...mitKoords]
  let curLat = startLat ?? mitKoords[0].lat!
  let curLng = startLng ?? mitKoords[0].lng!

  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(curLat, curLng, remaining[i].lat!, remaining[i].lng!)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    result.push(next)
    curLat = next.lat!
    curLng = next.lng!
  }

  return [...result, ...ohneKoords]
}

export async function GET(request: NextRequest) {
  // Authentifizierung: entweder eingeloggter User ODER Cron mit Secret + userId
  const cronSecret = request.headers.get("x-cron-secret")
  const isCron = cronSecret && cronSecret === process.env.CRON_SECRET

  let userId: string

  if (isCron) {
    const uid = new URL(request.url).searchParams.get("userId")
    if (!uid) return NextResponse.json({ error: "userId required for cron" }, { status: 400 })
    userId = uid
  } else {
    const { user } = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    userId = user.id
  }

  const url = new URL(request.url)
  const datum = url.searchParams.get("datum") ?? new Date().toISOString().slice(0, 10)

  const supabase = createServiceRoleClient()

  // 1. Profil (Startort + Name)
  const { data: profil } = await supabase
    .from("profiles")
    .select("name, firma, startort_lat, startort_lng, startort_adresse")
    .eq("id", userId)
    .single()

  // 2. Heutige Termine
  const { data: termineRaw } = await supabase
    .from("termine")
    .select("id, titel, datum, von, bis, einsatzort_adresse, einsatzort_lat, einsatzort_lng, ticket_id, status")
    .eq("handwerker_id", userId)
    .eq("datum", datum)
    .neq("status", "abgelaufen")
    .neq("status", "abgelehnt")
    .order("von")

  // 3. Aktive Aufträge gesamt (für Kontext im Briefing)
  const { count: aktiveAuftraege } = await supabase
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("zugewiesener_hw", userId)
    .neq("status", "erledigt")

  const termine: TerminStop[] = (termineRaw ?? []).map(t => ({
    id: t.id,
    titel: t.titel,
    datum: t.datum,
    von: t.von,
    bis: t.bis,
    adresse: t.einsatzort_adresse,
    lat: t.einsatzort_lat,
    lng: t.einsatzort_lng,
    ticketId: t.ticket_id,
  }))

  // 4. Route optimieren
  const startLat = (profil as { startort_lat?: number | null } | null)?.startort_lat ?? null
  const startLng = (profil as { startort_lng?: number | null } | null)?.startort_lng ?? null
  const startortAdresse = (profil as { startort_adresse?: string | null } | null)?.startort_adresse ?? null

  const sortiert = optimiereReihenfolge(termine, startLat, startLng)

  // 5. Fahrzeiten berechnen
  let curLat = startLat
  let curLng = startLng
  let gesamtFahrzeitMin = 0
  let gesamtDistanzKm = 0

  const stops: BriefingStop[] = sortiert.map((t, idx) => {
    let fahrzeitVorher = 0
    let distanzVorherKm = 0
    if (curLat != null && curLng != null && t.lat != null && t.lng != null) {
      distanzVorherKm = Math.round(haversineKm(curLat, curLng, t.lat, t.lng) * 10) / 10
      fahrzeitVorher = schaetzeFahrzeitMin(distanzVorherKm)
    }
    gesamtFahrzeitMin += fahrzeitVorher
    gesamtDistanzKm += distanzVorherKm
    if (t.lat != null) { curLat = t.lat; curLng = t.lng }
    return { ...t, reihenfolge: idx + 1, fahrzeitVorher, distanzVorherKm }
  })

  // 6. KI-Text generieren (Claude Haiku — kurz und präzise)
  let kiText = ""
  try {
    const anthropic = new Anthropic()
    const name = (profil as { name?: string | null } | null)?.name
      ?? (profil as { firma?: string | null } | null)?.firma
      ?? "Handwerker"
    const stopSummary = stops.map((s, i) =>
      `Stop ${i + 1}: ${s.titel}${s.adresse ? ` (${s.adresse})` : ""} ${s.von.slice(0, 5)}–${s.bis.slice(0, 5)}${s.fahrzeitVorher > 0 ? `, ~${s.fahrzeitVorher} Min Fahrt` : ""}`
    ).join("\n")

    const prompt = stops.length === 0
      ? `Erstelle eine kurze, freundliche Nachricht (2 Sätze) für Handwerker ${name}. Heute keine geplanten Termine. Motiviere ihn kurz.`
      : `Erstelle eine kurze, professionelle Zusammenfassung (2-3 Sätze) für Handwerker ${name} für heute:

${stopSummary}

Gesamtfahrzeit: ~${gesamtFahrzeitMin} Minuten, ${gesamtDistanzKm.toFixed(1)} km

Schreibe sachlich und direkt. Hebe hervor was wichtig ist. Kein übertriebenes Lob.`

    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    })
    kiText = msg.content[0].type === "text" ? msg.content[0].text.trim() : ""
  } catch (e) {
    console.warn("[tages-briefing] KI-Text-Generierung fehlgeschlagen:", e)
    kiText = stops.length === 0
      ? "Heute keine Termine geplant."
      : `${stops.length} ${stops.length === 1 ? "Termin" : "Termine"} heute, ~${gesamtFahrzeitMin} Min Fahrtzeit gesamt.`
  }

  const response: TagesBriefingResponse = {
    datum,
    stops,
    gesamtFahrzeitMin,
    gesamtDistanzKm: Math.round(gesamtDistanzKm * 10) / 10,
    aktiveAuftraege: aktiveAuftraege ?? 0,
    kiText,
    startortAdresse,
  }

  return NextResponse.json(response)
}
