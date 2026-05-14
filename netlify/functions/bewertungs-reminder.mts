import { Config } from "@netlify/functions"

// Täglich um 03:00 UTC: Bewertungs-Reminder an Mieter mit erledigten
// Tickets ≥ 3 Tage ohne Bewertung. Idempotent — pro Ticket nur einmal
// (Tracking via tickets.bewertung_reminder_gesendet).
export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app"
  try {
    const response = await fetch(`${siteUrl}/api/cron/bewertungs-reminder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET || "netlify-scheduled",
      },
    })
    const data = await response.json()
    console.log("[Cron] bewertungs-reminder result:", JSON.stringify(data))
    return new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
  } catch (error) {
    console.error("[Cron] bewertungs-reminder failed:", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 })
  }
}

export const config: Config = {
  schedule: "0 3 * * *", // täglich 03:00 UTC
}
