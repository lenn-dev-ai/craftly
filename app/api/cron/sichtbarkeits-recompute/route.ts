import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// POST /api/cron/sichtbarkeits-recompute
//
// Ruft die PostgreSQL-Function recompute_sichtbarkeit_all() auf, die in
// einem einzigen DB-Scan alle Handwerker-Scores aktualisiert (Sprint AR).
// Vorher: N×4 sequenzielle Round-Trips pro HW — jetzt: 1 RPC-Call.
//
// Score-Formel (100 Punkte, Details in migration sprint_ar_sichtbarkeit_sql_function):
//   15 Pkt  Google-Cal verbunden
//   15 Pkt  Antwort-Rate letzte 30 Tage
//   50 Pkt  bewertung_avg (Neuling-Default: 30)
//   20 Pkt  Direktvergabe-Aktivität letzte 30 Tage
//
// Stufen: ≥75 → gold (×1.10), ≥50 → silber (×1.05), sonst → bronze (×1.00)

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authViaSecret =
    !!cronSecret && request.headers.get("x-cron-secret") === cronSecret

  if (!authViaSecret) {
    const { supabase, user } = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("rolle").eq("id", user.id).single()
    if (profile?.rolle !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  const { data, error } = await admin.rpc("recompute_sichtbarkeit_all")

  if (error) {
    console.error("[sichtbarkeits-recompute] RPC fehlgeschlagen:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log("[sichtbarkeits-recompute] OK", data)
  return NextResponse.json(data ?? { ok: true })
}
