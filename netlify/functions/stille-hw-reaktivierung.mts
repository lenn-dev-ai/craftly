import { Config } from "@netlify/functions"

// Täglich um 03:10 UTC: stille HW (kein Bid in 14+ Tagen) bekommen
// Top-3-passende-Aufträge-Mail. Re-Send-Schutz: max alle 14 Tage.
export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app"
  try {
    const response = await fetch(`${siteUrl}/api/cron/stille-hw-reaktivierung`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET || "netlify-scheduled",
      },
    })
    const data = await response.json()
    console.log("[Cron] stille-hw-reaktivierung result:", JSON.stringify(data))
    return new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
  } catch (error) {
    console.error("[Cron] stille-hw-reaktivierung failed:", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 })
  }
}

export const config: Config = {
  schedule: "10 3 * * *", // täglich 03:10 UTC (10 Min nach bewertungs-reminder)
}
