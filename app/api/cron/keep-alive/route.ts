import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

// Anti-Pause: Supabase Free Tier pausiert das Projekt nach ~7 Tagen ohne
// aktive DB-Verbindungen (Symptom: 503 auf /auth/v1/token, endloser
// Login-Spinner). Dieser Cron pingt täglich die DB an, um das zu verhindern.
//
// Netlify Scheduled Function: netlify/functions/keep-alive.mts → 06:00 UTC
// Auth: x-cron-secret-Header (CRON_SECRET env). CRON_SECRET MUSS gesetzt sein —
// fehlt die Env-Var, antwortet der Endpoint mit 503 statt offen zu laufen.

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "Endpoint not configured — CRON_SECRET missing" }, { status: 503 })
  }
  if (request.headers.get("x-cron-secret") !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from("profiles").select("id").limit(1)
  if (error) {
    console.error("[keep-alive] Supabase ping FAILED", error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }

  console.log("[keep-alive] Supabase ping OK", new Date().toISOString())
  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
