// Twilio-SMS-Helper. Wird vom Voice-AI-Webhook genutzt, um dem Verwalter
// nach einem Anruf die Ticket-Nummer per SMS zu schicken.
//
// Konfiguration via Netlify-ENVs:
// - TWILIO_ACCOUNT_SID
// - TWILIO_AUTH_TOKEN
// - TWILIO_FROM_NUMBER (E.164-Format, z.B. +4915...)
//
// Wenn ENVs fehlen, ist der Helper ein no-op und loggt nur — so kann
// die Voice-Pipeline auch in Test-Umgebungen ohne Twilio-Account laufen.

export interface SmsParams {
  to: string
  body: string
}

export interface SmsResult {
  sent: boolean
  sid?: string
  skipped_reason?: string
  error?: string
}

export async function sendSms({ to, body }: SmsParams): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    console.warn("[twilio] ENV fehlt — SMS würde an", to, "gehen:", body)
    return { sent: false, skipped_reason: "TWILIO_ENV_MISSING" }
  }

  try {
    const params = new URLSearchParams({ To: to, From: from, Body: body })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const text = await res.text()
      return { sent: false, error: `Twilio ${res.status}: ${text.slice(0, 200)}` }
    }

    const data = await res.json() as { sid?: string }
    return { sent: true, sid: data.sid }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}
