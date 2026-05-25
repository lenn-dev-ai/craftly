import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// GET /api/admin/health
// Sprint AH — System-Status-Bar:
//   db = DB-Latency-Ping (SELECT 1)
//   resend = Resend-Key konfiguriert?
//   vapi = Vapi-Key konfiguriert?
//   mapbox = Mapbox-Token konfiguriert?

export async function GET(request: NextRequest) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: prof } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single<{ rolle: string }>()
  if (prof?.rolle !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  const t0 = Date.now()
  const { error: pingErr } = await admin.from("profiles").select("id", { count: "exact", head: true }).limit(1)
  const dbLatencyMs = Date.now() - t0

  return NextResponse.json(
    {
      db: { ok: !pingErr, latency_ms: dbLatencyMs },
      resend: { ok: !!process.env.RESEND_API_KEY },
      vapi: { ok: !!process.env.VAPI_API_KEY },
      mapbox: { ok: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN },
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
