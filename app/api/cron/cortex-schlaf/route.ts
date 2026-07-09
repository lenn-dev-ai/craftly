import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { schlafZyklus } from "@/lib/cortex/denken"

// POST /api/cron/cortex-schlaf (Sprint CI)
//
// Der Schlaf-Zyklus des Reparo Cortex: konsolidiert die Ereignisse der
// letzten 24h, zieht Erkenntnisse ins Gedächtnis und schickt dem
// Betreiber ein Memo. Beobachtet & meldet nur — führt nichts aus
// (Charta §1/§2). Nächtlich via netlify/functions/cortex-schlaf.mts,
// manuell auslösbar durch Admins (Dual-Auth wie auto-freigabe).

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authViaSecret =
    !!cronSecret && request.headers.get("x-cron-secret") === cronSecret

  if (!authViaSecret) {
    const { supabase, user } = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase
      .from("profiles")
      .select("rolle")
      .eq("id", user.id)
      .single<{ rolle: string }>()
    if (profile?.rolle !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const admin = createServiceRoleClient()
  const ergebnis = await schlafZyklus(admin)
  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 500 })
}
