import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { berechneVerfuegbarkeitScore } from "@/lib/scoring/verfuegbarkeit"

// POST /api/verfuegbarkeit/update-score
// Re-berechnet den Verfügbarkeits-Score des eingeloggten Handwerkers
// und persistiert verfuegbarkeit_score + sichtbarkeit_stufe.
// Pflegt zusätzlich kalender_streak: +1 wenn die letzte Pflege < 7 Tage
// her ist, sonst Reset auf 1.

export async function POST(_request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profil } = await supabase
    .from("profiles")
    .select("rolle, letzte_kalender_pflege, kalender_streak")
    .eq("id", user.id)
    .single<{
      rolle: string
      letzte_kalender_pflege: string | null
      kalender_streak: number | null
    }>()
  if (!profil) return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 404 })
  if (profil.rolle !== "handwerker") {
    return NextResponse.json({ error: "Nur Handwerker haben einen Verfügbarkeits-Score" }, { status: 403 })
  }

  // Streak vor dem Update bestimmen — basierend auf dem alten Pflege-Zeitpunkt
  const letzte = profil.letzte_kalender_pflege ? new Date(profil.letzte_kalender_pflege) : null
  const tageSeit = letzte ? Math.floor((Date.now() - letzte.getTime()) / 86400000) : 999
  const neuerStreak = letzte && tageSeit <= 7
    ? (profil.kalender_streak ?? 0) + 1
    : 1

  // Letzte Pflege auf jetzt setzen, BEVOR der Score gelesen wird (damit der
  // Score mit dem frischen pflegeRate = 1.0 berechnet wird).
  await supabase
    .from("profiles")
    .update({
      letzte_kalender_pflege: new Date().toISOString(),
      kalender_streak: neuerStreak,
    })
    .eq("id", user.id)

  const result = await berechneVerfuegbarkeitScore(supabase, user.id)

  await supabase
    .from("profiles")
    .update({
      verfuegbarkeit_score: result.score,
      sichtbarkeit_stufe: result.stufe,
    })
    .eq("id", user.id)

  return NextResponse.json({
    ok: true,
    score: result.score,
    stufe: result.stufe,
    freieSlots: result.freieSlots,
    streak: neuerStreak,
    pflegeRate: result.pflegeRate,
  })
}
