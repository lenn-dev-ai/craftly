import { Config } from "@netlify/functions";

// Alle 5 Minuten abgelaufene Auktionen prüfen und automatisch vergeben
export default async () => {
  const siteUrl = process.env.URL || "https://reparo-app.netlify.app";

  try {
    const response = await fetch(`${siteUrl}/api/auction/check-expired`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // CRON_SECRET muss in Netlify gesetzt sein. Kein Fallback —
        // sonst würde der Cron den Auth-Check via beliebigem String
        // bypassen können.
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
    });

    const data = await response.json();
    console.log("[Cron] check-expired result:", JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true, ...data }), {
      status: 200,
    });
  } catch (error) {
    console.error("[Cron] check-expired failed:", error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
    });
  }
};

export const config: Config = {
  // Alle 5 Minuten
  schedule: "*/5 * * * *",
};
