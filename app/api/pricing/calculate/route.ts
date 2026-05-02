import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { calculateTotal, getEffectiveRate } from "@/lib/pricing/commission"

// POST /api/pricing/calculate
// Body: { stunden: number, stundensatz: number, handwerker_id?: string }
// Auth: Verwalter-Session via Cookies erforderlich
export async function POST(request: NextRequest) {
  let body: { stunden?: number; stundensatz?: number; handwerker_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const stunden = Number(body.stunden)
  const stundensatz = Number(body.stundensatz)

  if (!isFinite(stunden) || stunden <= 0) {
    return NextResponse.json({ error: "stunden muss > 0 sein" }, { status: 400 })
  }
  if (!isFinite(stundensatz) || stundensatz <= 0) {
    return NextResponse.json({ error: "stundensatz muss > 0 sein" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle, created_at, early_adopter_bis")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 404 })
  }
  if (profile.rolle !== "verwalter" && profile.rolle !== "admin") {
    return NextResponse.json({ error: "Nur Verwalter dürfen Preise berechnen" }, { status: 403 })
  }

  const { rate, isEarlyAdopter } = await getEffectiveRate(supabase, profile)
  const calc = calculateTotal(stundensatz, stunden, rate)

  return NextResponse.json({
    auftragswert: calc.auftragswert,
    provisionRate: rate,
    provisionBetrag: calc.provisionBetrag,
    gesamt: calc.gesamt,
    isEarlyAdopter,
    earlyAdopterBis: profile.early_adopter_bis ?? null,
    handwerker_id: body.handwerker_id ?? null,
    aufschluesselung: {
      handwerkerkosten: calc.auftragswert,
      reparoGebuehr: calc.provisionBetrag,
      gesamt: calc.gesamt,
    },
  })
}
