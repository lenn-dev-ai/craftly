import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { hasGoogleEventInRange } from "@/lib/google-cal/events"

// Sprint AK Stufe 2 (27.05.2026): Live-Verfügbarkeits-Check für eine Liste
// von HW-IDs. Wird vom neuen Verwalter-Marktplatz aufgerufen, um Status-
// Badges (frei/belegt/nicht verbunden) zu rendern.
//
// Performance-Hinweis: 1 Google-API-Call pro HW mit Token. Aufrufer sollte
// die Liste auf <= 20 IDs cappen.
//
// Input (POST):
//   { handwerker_ids: string[], fenster_stunden?: number }
//
// Output:
//   { status: { [id]: "frei" | "belegt" | "nicht_verbunden" | "fehler" } }

interface Body {
  handwerker_ids?: unknown
  fenster_stunden?: unknown
}

const MAX_IDS = 20
const DEFAULT_FENSTER_STD = 4

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Nur Verwalter dürfen das fragen — RoleGuard ist im Frontend, hier
  // doppelt absichern damit kein HW über die fremde HW-Liste fischt.
  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .maybeSingle<{ rolle: string }>()
  if (!profile || (profile.rolle !== "verwalter" && profile.rolle !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Body
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const ids = Array.isArray(body.handwerker_ids)
    ? body.handwerker_ids.filter((x): x is string => typeof x === "string").slice(0, MAX_IDS)
    : []
  if (ids.length === 0) {
    return NextResponse.json({ status: {} })
  }
  const fenster = typeof body.fenster_stunden === "number" && body.fenster_stunden > 0 && body.fenster_stunden <= 168
    ? body.fenster_stunden
    : DEFAULT_FENSTER_STD

  // Welche HWs haben überhaupt einen Google-Token? Ohne Token = "nicht_verbunden"
  // (kein false-positive "frei", kein API-Call vergeudet).
  const { data: oauthRows } = await supabase
    .from("hw_google_oauth")
    .select("user_id, last_error")
    .in("user_id", ids)
  const tokenMap = new Map<string, { hatToken: true; brokenError: string | null }>()
  for (const r of (oauthRows ?? []) as Array<{ user_id: string; last_error: string | null }>) {
    tokenMap.set(r.user_id, { hatToken: true, brokenError: r.last_error })
  }

  const von = new Date()
  const bis = new Date(Date.now() + fenster * 60 * 60 * 1000)

  const status: Record<string, "frei" | "belegt" | "nicht_verbunden" | "fehler"> = {}
  // Sequentiell statt Promise.all, weil Google-API gerne ratelimited.
  // Bei MAX_IDS=20 sind das im Worst-Case ~2-3 Sekunden Roundtrip; ok für MVP.
  for (const id of ids) {
    const tok = tokenMap.get(id)
    if (!tok) { status[id] = "nicht_verbunden"; continue }
    if (tok.brokenError) { status[id] = "fehler"; continue }
    try {
      const belegt = await hasGoogleEventInRange(id, von, bis)
      status[id] = belegt ? "belegt" : "frei"
    } catch (e) {
      console.warn("[hw-verfuegbarkeit] google-fehler für", id, e)
      status[id] = "fehler"
    }
  }

  return NextResponse.json({ status })
}
