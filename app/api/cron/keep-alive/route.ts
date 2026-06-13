import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

// Anti-Pause: Supabase Free Tier pausiert das Projekt nach ~7 Tagen ohne
// aktive DB-Verbindungen (Symptom: 503 auf /auth/v1/token, endloser
// Login-Spinner). Dieser Cron pingt täglich die DB an, um das zu verhindern.
//
// Netlify Scheduled Function: netlify/functions/keep-alive.mts → 06:00 UTC
// Auth: x-cron-secret-Header (CRON_SECRET env). Fallback: offen (read-only,
// harmloser Health-Ping ohne sensible Daten).

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authViaSecret = request.headers.get("x-cron-secret") === cronSecret
    if (!authViaSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const supabase = createServiceRoleClient()
    const { error } = await supabase.from("profiles").select("id").limit(1)
    if (error) throw error

    console.log("[keep-alive] Supabase ping OK", new Date().toISOString())
    return NextResponse.json({ ok: true, ts: new Date().toISOString() })
  } catch (err) {
    console.error("[keep-alive] Supabase ping FAILED", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
