import { Config } from "@netlify/functions"

// Cortex-Reflexe (03:15 UTC — vor dem Schlaf-Zyklus um 03:30, damit die
// Deliberation die Reflex-Ergebnisse im Journal vorfindet).
// Siehe app/api/cron/cortex-reflexe/route.ts.
export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app"
  try {
    const res = await fetch(`${siteUrl}/api/cron/cortex-reflexe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    })
    const data = await res.json()
    console.log("[Cron] cortex-reflexe:", JSON.stringify(data))
    return new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
  } catch (err) {
    console.error("[Cron] cortex-reflexe failed:", err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 })
  }
}

export const config: Config = {
  // Täglich um 03:15 UTC
  schedule: "15 3 * * *",
}
