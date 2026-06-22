import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { pruefeKiGesundheit } from "@/lib/monitoring/ki-health"
import { sendEmailFireAndForget } from "@/lib/email/send"

// POST /api/cron/ki-health
//
// Proaktives KI-Health-Monitoring: erkennt stille Ausfälle der KI-/Automatik-
// Pfade (Voice/Vapi, LLM/Anthropic, Vergabe-Engine) und alarmiert die Admins
// per Mail. Hintergrund: heute lief das Telefon tagelang stumm, ohne dass es
// jemand merkte — "die KI treibt den Prozess" darf nicht heißen "und keiner
// merkt, wenn sie stehenbleibt".
//
// Auth wie alle Crons: x-cron-secret (CRON_SECRET) ODER eingeloggter Admin.
// Netlify-Wrapper: netlify/functions/ki-health.mts.

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
  const report = await pruefeKiGesundheit(admin)

  if (!report.ok) {
    // Laut ins Log (sichtbar in den Netlify-Function-Logs).
    console.error("[Cron] ki-health ALARM:", JSON.stringify(report.probleme))

    // Admins per Mail benachrichtigen (No-op solange Resend pausiert ist —
    // greift automatisch, sobald RESEND wieder aktiv ist).
    try {
      const { data: admins } = await admin
        .from("profiles")
        .select("email")
        .eq("rolle", "admin")
        .not("email", "is", null)
        .returns<Array<{ email: string | null }>>()

      const liste = report.probleme.map(p => `<li>${p}</li>`).join("")
      const html = `
        <p><strong>KI-Health-Alarm</strong> — mindestens ein KI-/Automatik-Pfad meldet ein Problem:</p>
        <ul>${liste}</ul>
        <p>Stand: ${report.timestamp}</p>
        <p>Details im Admin-Board (Mission Control → System).</p>`

      for (const a of admins ?? []) {
        if (a.email) {
          sendEmailFireAndForget({ to: a.email, subject: "⚠️ Reparo KI-Health-Alarm", html })
        }
      }
    } catch (err) {
      console.error("[Cron] ki-health Mail-Versand fehlgeschlagen:", err)
    }
  }

  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } })
}
