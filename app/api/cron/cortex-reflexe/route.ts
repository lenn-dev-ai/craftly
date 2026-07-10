import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { reflexeAusfuehren } from "@/lib/cortex/reflexe"

// POST /api/cron/cortex-reflexe (Sprint CI — handelnde Stufe)
//
// Führt die deterministischen Cortex-Reflexe aus (Auto-Reparaturen mit
// engen Leitplanken, siehe lib/cortex/reflexe.ts). Eigener Zyklus vor
// dem Schlaf (03:15), damit die Deliberation die Reflex-Ergebnisse im
// Journal vorfindet. Dual-Auth wie die übrigen Crons; Kill-Switch
// CORTEX_REFLEXE_OFF=1.

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
  const ergebnis = await reflexeAusfuehren(admin)
  return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 500 })
}
