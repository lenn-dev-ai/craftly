import { Config } from "@netlify/functions"

// Alle 5 Minuten: prüft offene Direktvergabe-Anfragen auf Timeout
// (direktvergabe_angefragt_am + direktvergabe_timeout_min) und eskaliert
// zum nächsten Kandidaten bzw. Mass-Invite-Fallback.
// Sprint AM Phase 2e — siehe app/api/cron/direktvergabe-eskalation/route.ts
// und lib/auction/direktvergabe.ts (eskaliereDirektvergabe).
export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app"
  try {
    const response = await fetch(`${siteUrl}/api/cron/direktvergabe-eskalation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // CRON_SECRET muss in Netlify gesetzt sein. Kein Fallback-Secret:
        // fehlt es, lehnt die API-Route den Cron mit 401 ab.
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    })
    const data = await response.json()
    console.log("[Cron] direktvergabe-eskalation result:", JSON.stringify(data))
    return new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
  } catch (error) {
    console.error("[Cron] direktvergabe-eskalation failed:", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 })
  }
}

export const config: Config = {
  schedule: "*/5 * * * *", // alle 5 Minuten
}
