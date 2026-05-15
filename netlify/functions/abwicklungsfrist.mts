import { Config } from "@netlify/functions"

// Täglich um 03:00 prüft der Cron, ob HW-Aufträge die 14-Tage-Frist
// gerissen haben. Siehe app/api/cron/abwicklungsfrist/route.ts.
export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app"
  try {
    const res = await fetch(`${siteUrl}/api/cron/abwicklungsfrist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    })
    const data = await res.json()
    console.log("[Cron] abwicklungsfrist:", JSON.stringify(data))
    return new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
  } catch (err) {
    console.error("[Cron] abwicklungsfrist failed:", err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 })
  }
}

export const config: Config = {
  // Täglich um 03:00 UTC
  schedule: "0 3 * * *",
}
