import { Config } from "@netlify/functions"

// Anti-Pause: hält das Supabase-Free-Tier-Projekt wach (verhindert Auto-Pause
// nach 7 Tagen Inaktivität, die zu endlosem Login-Spinner / 503 führt).
export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app"
  try {
    const response = await fetch(`${siteUrl}/api/cron/keep-alive`, {
      method: "GET",
      headers: {
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    })
    const data = await response.json()
    console.log("[Cron] keep-alive result:", JSON.stringify(data))
    return new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
  } catch (error) {
    console.error("[Cron] keep-alive failed:", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 })
  }
}

export const config: Config = {
  schedule: "0 6 * * *", // täglich 06:00 UTC
}
