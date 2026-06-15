import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// GET /api/melden/pills?wohnung_id=<uuid>
//
// Sprint AF Phase 1: Liefert die 5 wahrscheinlichsten Schadensarten als
// Pills für den Mieter-Wizard. Reihenfolge basiert auf:
//   1. Top-Schadensarten der letzten 30 Tage in diesem Verwalter-Pool
//   2. Saisonale Boosts (Heizung im Winter, Schimmel im Frühling, etc.)
//   3. Globaler Fallback wenn keine Daten / kein wohnung_id
//
// Antwort:
//   { pills: Array<Pill> }
//
// Endpoint ist absichtlich auch ohne Login aufrufbar (Pills sind keine
// sensitiven Daten), damit der Mieter-Wizard sie schon vor Auth zeigen
// kann. Wohnung-spezifische Personalisierung greift nur wenn wohnung_id
// gegeben + Caller darauf Zugriff hat — sonst still Fallback.

type Pill = {
  key: string
  label: string
  icon: string
  startText: string
  gewerkHint: string
}

const ALLE_PILLS: Record<string, Pill> = {
  heizung: {
    key: "heizung",
    label: "Heizung aus",
    icon: "!",
    startText: "Heizung funktioniert nicht mehr, Wohnung wird kalt",
    gewerkHint: "heizung_sanitaer",
  },
  wasser: {
    key: "wasser",
    label: "Wasserschaden",
    icon: "~",
    startText: "Wasser tropft oder läuft aus, Feuchtigkeit an Wand",
    gewerkHint: "heizung_sanitaer",
  },
  elektro: {
    key: "elektro",
    label: "Strom/Elektrik",
    icon: "#",
    startText: "Strom ausgefallen oder Steckdose funktioniert nicht",
    gewerkHint: "elektro",
  },
  tuer: {
    key: "tuer",
    label: "Tür/Fenster",
    icon: "|",
    startText: "Tür oder Fenster lässt sich nicht richtig schließen",
    gewerkHint: "schreiner",
  },
  schimmel: {
    key: "schimmel",
    label: "Schimmel",
    icon: "o",
    startText: "Schimmelflecken an Wand oder Decke entdeckt",
    gewerkHint: "maler",
  },
  dach: {
    key: "dach",
    label: "Dachschaden",
    icon: "△",
    startText: "Dachschaden oder Undichtigkeit erkannt, Wassereintritt möglich",
    gewerkHint: "dachdecker",
  },
  fassade: {
    key: "fassade",
    label: "Fassade",
    icon: "▢",
    startText: "Fassaden-/Außenwandschaden, lose Putzstücke oder Risse",
    gewerkHint: "maler",
  },
  boden: {
    key: "boden",
    label: "Boden",
    icon: "▭",
    startText: "Bodenbelag beschädigt — Risse, Wasserschaden oder lose Dielen",
    gewerkHint: "bodenleger",
  },
}

const DEFAULT_TOP5 = ["heizung", "wasser", "elektro", "tuer", "schimmel"]

// Saisonale Boosts: keys sind Schadens-Keys, value ist Boost-Faktor
// (multipliziert auf den jeweiligen Score).
function saisonBoosts(monat: number): Record<string, number> {
  // monat: 1-12
  if (monat >= 11 || monat <= 2) {
    // Winter: Heizung + Frost-Wasserschäden
    return { heizung: 1.5, wasser: 1.3, fassade: 0.8 }
  }
  if (monat >= 3 && monat <= 5) {
    // Frühling: Schimmel nach Winter + Dach (Sturm)
    return { schimmel: 1.4, dach: 1.2, heizung: 0.7 }
  }
  if (monat >= 6 && monat <= 8) {
    // Sommer: Dach (Sturm/Hagel), Fassade
    return { dach: 1.3, fassade: 1.2, heizung: 0.5 }
  }
  // Sep-Okt: Heizung-Inbetriebnahme
  return { heizung: 1.3, fassade: 0.9 }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const wohnungId = url.searchParams.get("wohnung_id")
  const monat = new Date().getMonth() + 1
  const boosts = saisonBoosts(monat)

  // Basis-Scores: alle Default-Top-5 starten bei 1.0, andere bei 0.3
  const scores: Record<string, number> = {}
  for (const key of Object.keys(ALLE_PILLS)) {
    scores[key] = DEFAULT_TOP5.includes(key) ? 1.0 : 0.3
  }

  // Wenn wohnung_id mitgegeben: versuche Verwalter-Statistik.
  // createServerSupabaseClient() nutzt den aufrufenden User-Kontext (RLS).
  // Anonyme Requests landen als anon-Key → RLS blockiert → stiller Fallback.
  if (wohnungId) {
    try {
      const supabase = createServerSupabaseClient()
      const { data: wohnung } = await supabase
        .from("wohnungen")
        .select("verwalter_id")
        .eq("id", wohnungId)
        .maybeSingle()

      if (wohnung?.verwalter_id) {
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
        const { data: tickets } = await supabase
          .from("tickets")
          .select("gewerk")
          .eq("verwalter_id", wohnung.verwalter_id)
          .gte("created_at", since)
          .limit(500)

        if (tickets && tickets.length > 0) {
          // Mapping gewerk → pill-key
          const gewerkToPill: Record<string, string> = {
            heizung_sanitaer: "heizung", // unscharf, könnte auch wasser sein
            elektro: "elektro",
            schreiner: "tuer",
            maler: "schimmel",
            dachdecker: "dach",
            bodenleger: "boden",
          }
          for (const t of tickets) {
            const pillKey = t.gewerk ? gewerkToPill[t.gewerk] : null
            if (pillKey && scores[pillKey] != null) {
              scores[pillKey] += 0.05 // jeder Vergangenheits-Match boostet
            }
          }
        }
      }
    } catch (err) {
      // Bei Fehler: stiller Fallback auf reine Saison-Defaults
      console.warn("[pills] verwalter-stats failed", err)
    }
  }

  // Saison-Boosts anwenden
  for (const [key, boost] of Object.entries(boosts)) {
    if (scores[key] != null) scores[key] *= boost
  }

  // Top 5 nach Score
  const sortiert = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => ALLE_PILLS[key])

  return NextResponse.json(
    { pills: sortiert },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
  )
}
