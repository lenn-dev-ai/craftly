import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { berechneVerfuegbarkeitScore } from "@/lib/scoring/verfuegbarkeit"

// POST /api/verfuegbarkeit/update-score
// Re-berechnet den Verfügbarkeits-Score des eingeloggten Handwerkers
// und persistiert verfuegbarkeit_score + sichtbarkeit_stufe.
// Pflegt zusätzlich kalender_streak: +1 wenn die letzte Pflege < 7 Tage
// her ist, sonst Reset auf 1.

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const admin = createServiceRoleClient()

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

  const jetzt = new Date().toISOString()

  // Systemfelder auf profiles sind durch protect_profile_fields vor
  // Self-Service-Updates geschützt. Daher schreibt dieser API-Pfad nach
  // erfolgreicher Auth- und Rollenprüfung bewusst mit Service-Role.
  const { error: pflegeErr } = await admin
    .from("profiles")
    .update({
      letzte_kalender_pflege: jetzt,
      kalender_streak: neuerStreak,
    })
    .eq("id", user.id)
  if (pflegeErr) {
    return NextResponse.json(
      { error: "Kalenderpflege konnte nicht gespeichert werden: " + pflegeErr.message },
      { status: 500 },
    )
  }

  const result = await berechneVerfuegbarkeitScore(admin, user.id)

  const { error: scoreErr } = await admin
    .from("profiles")
    .update({
      verfuegbarkeit_score: result.score,
      sichtbarkeit_stufe: result.stufe,
    })
    .eq("id", user.id)
  if (scoreErr) {
    return NextResponse.json(
      { error: "Verfügbarkeits-Score konnte nicht gespeichert werden: " + scoreErr.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    score: result.score,
    stufe: result.stufe,
    freieSlots: result.freieSlots,
    streak: neuerStreak,
    pflegeRate: result.pflegeRate,
  })
}
