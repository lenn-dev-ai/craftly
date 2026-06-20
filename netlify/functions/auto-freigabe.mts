import { Config } from "@netlify/functions"

// Stündlich: gibt Mieter-Tickets, die das Sicherheitsnetz zurückhält
// (zeitnah/planbar, warten auf Verwalter-Freigabe), automatisch frei,
// sobald die in den Verwalter-Präferenzen gesetzte Frist
// (auto_freigabe_stunden) abgelaufen ist.
// Sprint BD — siehe app/api/cron/auto-freigabe/route.ts.
export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app"
  try {
    const response = await fetch(`${siteUrl}/api/cron/auto-freigabe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    })
    const data = await response.json()
    console.log("[Cron] auto-freigabe result:", JSON.stringify(data))
    return new Response(JSON.stringify({ ok: true, ...data }), { status: 200 })
  } catch (error) {
    console.error("[Cron] auto-freigabe failed:", error)
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 })
  }
}

export const config: Config = {
  schedule: "0 * * * *", // stündlich zur vollen Stunde
}
