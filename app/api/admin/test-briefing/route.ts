import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { createServiceRoleClient } from "@/lib/supabase-server"

// POST /api/admin/test-briefing
// Sprint AV — Manueller Trigger für den HW Morgen-Briefing Cron.
//
// Nur für Admin-User zugänglich. Ruft /api/cron/hw-morgen-briefing auf,
// das KI-Briefings generiert und Emails sendet (falls Resend aktiv).
// Ideal für Demo/Testing ohne auf den täglichen Cron warten zu müssen.

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = createServiceRoleClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single()

  if (profile?.rolle !== "admin") {
    return NextResponse.json({ error: "Nur für Admins" }, { status: 403 })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET nicht konfiguriert" }, { status: 500 })
  }

  const siteUrl = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"

  const res = await fetch(`${siteUrl}/api/cron/hw-morgen-briefing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
  })

  const data = await res.json()

  // Resend-Status für transparentes Feedback im Admin-UI zurückgeben
  return NextResponse.json({
    ...data,
    resend_paused: process.env.RESEND_PAUSED === "1",
  }, { status: res.status })
}
