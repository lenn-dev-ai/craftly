import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { createServiceRoleClient } from "@/lib/supabase-server"
import Anthropic from "@anthropic-ai/sdk"

// POST /api/verwalter/ki-hw-empfehlung
// Sprint BB — KI-Empfehlung für Handwerker-Auswahl (Verwalter-Perspektive).
//
// Nimmt die bereits berechneten Kandidaten-Daten (Scores, Distanzen, Preise)
// und lässt Claude Haiku eine Top-3-Empfehlung mit Begründung generieren.
//
// Request Body:
//   ticket: { titel, gewerk, beschreibung?, dringlichkeit?, einsatzort_adresse? }
//   kandidaten: HWKandidat[]
//
// Response:
//   { kiText: string, top3: { hwId, rang, begruendung }[] }

interface HWKandidat {
  id: string
  name: string | null
  firma: string | null
  gewerk: string | null
  distanzKm: number | null
  fahrzeitMin: number | null
  routenScore: number | null
  effektivPreisFinal: number | null
  basis_stundensatz: number | null
  basis_preis: number | null
  bewertung_avg: number | null
  auftraege_anzahl: number | null
  istFavorit: boolean
}

interface RequestBody {
  ticket: {
    titel: string
    gewerk: string
    beschreibung?: string | null
    dringlichkeit?: string | null
    einsatzort_adresse?: string | null
  }
  kandidaten: HWKandidat[]
}

export async function POST(req: NextRequest) {
  const { user } = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Rolle prüfen (nur Verwalter + Admin)
  const supabase = createServiceRoleClient()
  const { data: profil } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single()
  if (!profil || !["verwalter", "admin"].includes(profil.rolle ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body: RequestBody = await req.json()
  const { ticket, kandidaten } = body

  if (!kandidaten || kandidaten.length === 0) {
    return NextResponse.json({ error: "Keine Kandidaten übergeben" }, { status: 400 })
  }

  // Maximal 10 Kandidaten für Token-Effizienz
  const topK = kandidaten.slice(0, 10)

  const dringlichkeitLabel: Record<string, string> = {
    planbar: "Planbar (flexible Terminwahl)",
    zeitnah: "Zeitnah (innerhalb dieser Woche)",
    notfall: "Notfall (sofort erforderlich)",
  }

  const prompt = `Du bist ein Assistent für Immobilienverwaltung. Analysiere diese Handwerker-Kandidaten und empfehle die Top 3 für den Auftrag.

AUFTRAG:
- Bezeichnung: ${ticket.titel}
- Gewerk: ${ticket.gewerk}
- Dringlichkeit: ${dringlichkeitLabel[ticket.dringlichkeit ?? ""] ?? ticket.dringlichkeit ?? "planbar"}
${ticket.beschreibung ? `- Beschreibung: ${ticket.beschreibung}` : ""}
${ticket.einsatzort_adresse ? `- Einsatzort: ${ticket.einsatzort_adresse}` : ""}

KANDIDATEN (${topK.length}):
${topK.map((hw, i) => {
  const name = hw.firma || hw.name || "Unbekannt"
  const stundensatz = hw.basis_stundensatz ?? hw.basis_preis
  return `${i + 1}. ${name} [ID: ${hw.id}]
   Distanz: ${hw.distanzKm != null ? hw.distanzKm.toFixed(1) + " km" : "—"} | Fahrzeit: ${hw.fahrzeitMin != null ? hw.fahrzeitMin + " min" : "—"}
   Stundensatz: ${stundensatz != null ? "€" + stundensatz : "—"} | Effektivpreis: ${hw.effektivPreisFinal != null ? "€" + hw.effektivPreisFinal.toFixed(2) : "—"}
   Bewertung: ${hw.bewertung_avg != null ? hw.bewertung_avg + "/5.0" : "Neu"} | Aufträge: ${hw.auftraege_anzahl ?? 0}
   Favorit: ${hw.istFavorit ? "✓ Ja" : "Nein"} | Routen-Score: ${hw.routenScore != null ? hw.routenScore : "—"}/100`
}).join("\n\n")}

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Text davor oder danach.
{
  "kiText": "Ein bis zwei Sätze als sachliche Gesamtempfehlung. Kein Markdown, kein Lob, direkt auf den Punkt.",
  "top3": [
    { "hwId": "<ID>", "rang": 1, "begruendung": "Ein Satz, sachlich, max. 15 Wörter" },
    { "hwId": "<ID>", "rang": 2, "begruendung": "Ein Satz, sachlich, max. 15 Wörter" },
    { "hwId": "<ID>", "rang": 3, "begruendung": "Ein Satz, sachlich, max. 15 Wörter" }
  ]
}

Wähle nur IDs aus der obigen Liste. Bevorzuge bei gleichwertigem Score: Favoriten, niedrigere Distanz, bessere Bewertung.`

  try {
    const anthropic = new Anthropic()
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : ""

    // JSON aus der Antwort extrahieren (defensive Parsing)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error("[ki-hw-empfehlung] Kein JSON in Antwort:", text)
      return NextResponse.json({ error: "KI-Antwort konnte nicht geparst werden" }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0]) as {
      kiText: string
      top3: { hwId: string; rang: number; begruendung: string }[]
    }

    // Validierung: nur IDs aus der Kandidatenliste akzeptieren
    const validIds = new Set(topK.map(hw => hw.id))
    result.top3 = (result.top3 ?? []).filter(t => validIds.has(t.hwId)).slice(0, 3)

    return NextResponse.json(result)
  } catch (e) {
    console.error("[ki-hw-empfehlung] Fehler:", e)
    return NextResponse.json({ error: "KI-Fehler" }, { status: 500 })
  }
}
