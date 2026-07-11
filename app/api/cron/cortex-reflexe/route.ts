import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { pruefeCronAuth, meldeCronHeartbeat } from "@/lib/cron/auth"
import { reflexeAusfuehren } from "@/lib/cortex/reflexe"

// POST /api/cron/cortex-reflexe (Sprint CI — handelnde Stufe)
//
// Führt die deterministischen Cortex-Reflexe aus (Auto-Reparaturen mit
// engen Leitplanken, siehe lib/cortex/reflexe.ts). Eigener Zyklus vor
// dem Schlaf (03:15), damit die Deliberation die Reflex-Ergebnisse im
// Journal vorfindet. Dual-Auth wie die übrigen Crons; Kill-Switch
// CORTEX_REFLEXE_OFF=1.

export async function POST(request: NextRequest) {
  const auth = await pruefeCronAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  meldeCronHeartbeat("cortex-reflexe", auth.via)

  const admin = createServiceRoleClient()
  const ergebnis = await reflexeAusfuehren(admin)
  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 500 })
}
