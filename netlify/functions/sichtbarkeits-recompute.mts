import { Config } from "@netlify/functions"

// Täglich um 03:20 UTC: verfuegbarkeit_score + sichtbarkeit_stufe
// für alle Handwerker recomputen aus Zeitslot-Anzahl, bewertung_avg
// und Bid-Aktivität letzte 30 Tage.
export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app"
  try {
    const response = await fetch(`${siteUrl}/api/cron/sichtbarkeits-recompute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET || "netlify-scheduled",
      },
    })
    const data = await response.json()
    console.log("[Cron] sichtbarkeits-recompute result:", JSON.stringify(data))
    return new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
  } catch (error) {
    console.error("[Cron] sichtbarkeits-recompute failed:", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 })
  }
}

export const config: Config = {
  schedule: "20 3 * * *", // täglich 03:20 UTC (10 Min nach stille-hw)
}
