import { Config } from "@netlify/functions"

// Nächtlicher Schlaf-Zyklus des Reparo Cortex (03:30 UTC — nach den
// Wartungs-Crons, damit deren Ergebnisse schon im Ereignisstrom liegen).
// Siehe app/api/cron/cortex-schlaf/route.ts.
export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app"
  try {
    const res = await fetch(`${siteUrl}/api/cron/cortex-schlaf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    })
    const data = await res.json()
    console.log("[Cron] cortex-schlaf:", JSON.stringify(data))
    return new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
  } catch (err) {
    console.error("[Cron] cortex-schlaf failed:", err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 })
  }
}

export const config: Config = {
  // Täglich um 03:30 UTC
  schedule: "30 3 * * *",
}
