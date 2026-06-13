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
      resend: await checkResend(),
      vapi: { ok: !!process.env.VAPI_API_KEY },
      mapbox: { ok: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN },
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}

// Health-Fix Loop-27: Resend-Dot war rot, ohne dass der Grund sichtbar war
// (Check prüfte nur, ob RESEND_API_KEY gesetzt ist). Jetzt wird zusätzlich
// ein leichter API-Call gemacht und der Fehlergrund (`reason`) zurückgegeben,
// damit er im UI als Tooltip angezeigt werden kann.
async function checkResend(): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, reason: "RESEND_API_KEY nicht gesetzt" }
  }
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      return { ok: true }
    }
    const body = await res.text()
    return { ok: false, reason: `HTTP ${res.status}: ${body.slice(0, 100)}` }
  } catch (err) {
    return { ok: false, reason: String(err) }
  }
}
