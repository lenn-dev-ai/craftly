import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { pruefeCronAuth, meldeCronHeartbeat } from "@/lib/cron/auth"
import { schlafZyklus } from "@/lib/cortex/denken"

// POST /api/cron/cortex-schlaf (Sprint CI)
//
// Der Schlaf-Zyklus des Reparo Cortex: konsolidiert die Ereignisse der
// letzten 24h, zieht Erkenntnisse ins Gedächtnis und schickt dem
// Betreiber ein Memo. Beobachtet & meldet nur — führt nichts aus
// (Charta §1/§2). Nächtlich via netlify/functions/cortex-schlaf.mts,
// manuell auslösbar durch Admins (Dual-Auth wie auto-freigabe).

export async function POST(request: NextRequest) {
  const auth = await pruefeCronAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  meldeCronHeartbeat("cortex-schlaf", auth.via)

  const admin = createServiceRoleClient()
  const ergebnis = await schlafZyklus(admin)
  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 500 })
}
