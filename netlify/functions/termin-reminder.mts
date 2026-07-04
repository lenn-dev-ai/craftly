import { Config } from "@netlify/functions"

// Stündlich: 24h-Reminder an Handwerker, wenn der Mieter auf vorgeschlagene
// Termin-Slots noch nicht reagiert hat (K1.3c). Idempotent — die Route
// trifft jede Slot-Gruppe genau einmal (Fenster 24–25h alt).
// Fehlte bisher als Wrapper → Reminder liefen in Produktion nie (Review 2026-07-03).
export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app"
  try {
    const response = await fetch(`${siteUrl}/api/cron/termin-reminder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // CRON_SECRET muss in Netlify gesetzt sein. Kein Fallback-Secret:
        // fehlt es, lehnt die API-Route den Cron mit 401 ab.
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    })
    const data = await response.json()
    console.log("[Cron] termin-reminder result:", JSON.stringify(data))
    return new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
  } catch (error) {
    console.error("[Cron] termin-reminder failed:", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 })
  }
}

export const config: Config = {
  schedule: "30 * * * *", // stündlich :30 (versetzt zu anderen Crons)
}
