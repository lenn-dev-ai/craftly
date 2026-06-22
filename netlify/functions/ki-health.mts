import { Config } from "@netlify/functions"

// Alle 30 Minuten: proaktives KI-Health-Monitoring. Erkennt stille Ausfälle
// der KI-/Automatik-Pfade (Voice/Vapi, LLM/Anthropic, Vergabe-Engine) und
// alarmiert die Admins per Mail. Siehe app/api/cron/ki-health/route.ts.
export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app"
  try {
    const response = await fetch(`${siteUrl}/api/cron/ki-health`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    })
    const data = await response.json()
    console.log("[Cron] ki-health result:", JSON.stringify(data))
    return new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
  } catch (error) {
    console.error("[Cron] ki-health failed:", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 })
  }
}

export const config: Config = {
  schedule: "*/30 * * * *", // alle 30 Minuten
}
