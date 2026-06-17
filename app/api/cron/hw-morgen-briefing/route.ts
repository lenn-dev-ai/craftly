import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { sendEmail } from "@/lib/email/send"
import { type TagesBriefingResponse } from "@/app/api/hw/tages-briefing/route"

// POST /api/cron/hw-morgen-briefing
// Sprint AV — täglicher KI-Morgen-Briefing Cron (07:00 CET = 06:00 UTC).
//
// Ablauf:
//   1. Alle aktiven HW mit Terminen heute aus Supabase laden
//   2. Pro HW: /api/hw/tages-briefing?userId=... aufrufen (KI + Route)
//   3. HTML-Email via Resend senden (RESEND_PAUSED=1 → skippt silent)
//
// Nur via x-cron-secret erreichbar. Vom Netlify Scheduled Function getriggert.

// Generiert die HTML-Email für das Briefing.
function briefingHtml(name: string, datum: string, b: TagesBriefingResponse): string {
  const datumLabel = new Date(datum + "T12:00:00").toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })

  const stopRows = b.stops.map((s, i) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:10px 8px;font-weight:bold;color:#3D8B7A;width:28px;text-align:center">${i + 1}</td>
      <td style="padding:10px 8px">
        <div style="font-weight:600;color:#111">${s.titel}</div>
        ${s.adresse ? `<div style="font-size:12px;color:#888;margin-top:2px">📍 ${s.adresse}</div>` : ""}
      </td>
      <td style="padding:10px 8px;white-space:nowrap;color:#555;font-size:13px;text-align:right">
        ${s.von.slice(0, 5)}–${s.bis.slice(0, 5)}
        ${s.fahrzeitVorher > 0 ? `<br><span style="font-size:11px;color:#aaa">~${s.fahrzeitVorher} min Fahrt</span>` : ""}
      </td>
    </tr>`).join("")

  const statsBlock = (b.gesamtFahrzeitMin > 0 || b.gesamtDistanzKm > 0)
    ? `<div style="margin-top:20px;padding:14px 16px;background:#f8fffe;border-radius:10px;border:1px solid #e0f0ed;font-size:13px;color:#444">
        <strong style="color:#3D8B7A">Route gesamt:</strong>
        ${b.gesamtFahrzeitMin > 0 ? `${b.gesamtFahrzeitMin} min Fahrt` : ""}
        ${b.gesamtDistanzKm > 0 ? ` · ${b.gesamtDistanzKm.toFixed(1)} km` : ""}
        ${b.aktiveAuftraege > 0 ? ` · ${b.aktiveAuftraege} offene Aufträge` : ""}
       </div>`
    : ""

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#3D8B7A,#2D6B5A);padding:28px 28px 24px">
      <div style="color:rgba(255,255,255,.75);font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase">Reparo · KI-Assistent</div>
      <h1 style="margin:8px 0 4px;color:#fff;font-size:22px;font-weight:700">Guten Morgen, ${name} 👋</h1>
      <div style="color:rgba(255,255,255,.8);font-size:13px">${datumLabel}</div>
    </div>

    <!-- KI-Text -->
    <div style="padding:24px 28px 4px">
      <p style="margin:0;font-size:15px;line-height:1.6;color:#333">${b.kiText}</p>
    </div>

    ${b.stops.length === 0 ? `
    <!-- Freier Tag -->
    <div style="padding:20px 28px;text-align:center">
      <div style="font-size:40px;margin-bottom:12px">🌤️</div>
      <div style="color:#666;font-size:14px">Heute keine geplanten Termine.
        ${b.aktiveAuftraege > 0 ? `Du hast ${b.aktiveAuftraege} offene Aufträge.` : ""}
      </div>
    </div>` : `
    <!-- Stops-Tabelle -->
    <div style="padding:20px 28px 0">
      <div style="font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#aaa;margin-bottom:10px">Deine Stops heute</div>
      <table style="width:100%;border-collapse:collapse">
        <tbody>${stopRows}</tbody>
      </table>
    </div>
    ${statsBlock}`}

    <!-- CTA -->
    <div style="padding:24px 28px">
      <a href="${process.env.URL || "https://reparo-app.netlify.app"}/dashboard-handwerker/karte"
         style="display:inline-block;padding:12px 22px;background:#3D8B7A;color:#fff;border-radius:10px;font-weight:600;font-size:14px;text-decoration:none">
        Route in der Karte öffnen →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;border-top:1px solid #f0f0f0;font-size:11px;color:#bbb">
      Reparo · KI-Assistent für Handwerker · Automatisch generiert
    </div>
  </div>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret")
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const siteUrl = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"
  const supabase = createServiceRoleClient()
  const heute = new Date().toISOString().slice(0, 10)

  // 1. Alle HW mit mindestens einem Termin heute laden
  //    (oder alle aktiven HW — auch Briefing bei freiem Tag ist wertvoll)
  const { data: hwProfiles } = await supabase
    .from("profiles")
    .select("id, name, firma, email")
    .eq("rolle", "handwerker")
    .not("email", "is", null)
    .limit(200)  // Sicherheitslimit — aktuell nur Demo-Account

  if (!hwProfiles || hwProfiles.length === 0) {
    return NextResponse.json({ ok: true, gesendet: 0, skipped: 0 })
  }

  let gesendet = 0
  let skipped = 0
  const errors: string[] = []

  for (const hw of hwProfiles) {
    try {
      // 2. Briefing pro HW generieren (ruft KI + Route-Optimizer auf)
      const briefingUrl = `${siteUrl}/api/hw/tages-briefing?datum=${heute}&userId=${hw.id}`
      const res = await fetch(briefingUrl, {
        headers: { "x-cron-secret": process.env.CRON_SECRET || "" },
      })

      if (!res.ok) {
        errors.push(`HW ${hw.id}: briefing HTTP ${res.status}`)
        skipped++
        continue
      }

      const briefing: TagesBriefingResponse = await res.json()
      const name = hw.name || hw.firma || "Handwerker"
      const email = hw.email as string

      // 3. Email senden (RESEND_PAUSED=1 → skippt silent via lib/email/send.ts)
      await sendEmail({
        to: email,
        subject: `Dein Tag — ${new Date(heute + "T12:00:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}`,
        html: briefingHtml(name, heute, briefing),
      })

      gesendet++
    } catch (err) {
      errors.push(`HW ${hw.id}: ${String(err)}`)
      skipped++
    }
  }

  console.log(`[hw-morgen-briefing] ${heute}: gesendet=${gesendet} skipped=${skipped}`)

  return NextResponse.json({
    ok: true,
    datum: heute,
    gesendet,
    skipped,
    ...(errors.length > 0 ? { errors } : {}),
  })
}
