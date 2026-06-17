import { Config } from "@netlify/functions"

// Sprint AV — Tägliches HW Morgen-Briefing um 06:00 UTC (08:00 CEST / 07:00 CET).
//
// Ruft /api/cron/hw-morgen-briefing auf, das:
//   1. Alle aktiven HW lädt
//   2. Pro HW ein KI-Briefing (Claude Haiku) mit optimierter Route generiert
//   3. Emails via Resend versendet (RESEND_PAUSED=1 → skipped, log only)
//
// Voraussetzungen (Netlify ENV):
//   CRON_SECRET — wie alle Cron-Endpoints
//   ANTHROPIC_API_KEY — für Claude Haiku KI-Text
//   RESEND_API_KEY + RESEND_FROM_EMAIL — für Email-Versand (kann pausiert sein)
//
// Zum Testen: Admin-Dashboard → "Briefing jetzt senden" Trigger-Button
// (Admin-Route: /api/admin/test-briefing, nur für admins zugänglich)

export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app"
  try {
    const response = await fetch(`${siteUrl}/api/cron/hw-morgen-briefing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    })
    const data = await response.json()
    console.log("[Cron] hw-morgen-briefing result:", JSON.stringify(data))
    return new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
  } catch (error) {
    console.error("[Cron] hw-morgen-briefing failed:", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 })
  }
}

export const config: Config = {
  // Täglich 06:00 UTC = 08:00 CEST (Sommer) / 07:00 CET (Winter)
  schedule: "0 6 * * *",
}
