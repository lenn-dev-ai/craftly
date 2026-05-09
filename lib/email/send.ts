// Server-Side E-Mail-Versand über Resend.
// Wenn RESEND_API_KEY nicht gesetzt ist (z.B. lokale Dev-Umgebung ohne
// Account oder vor erstem Setup), ist sendEmail() ein No-Op und die App
// läuft normal weiter. Fehler werden geloggt, aber nie weitergeworfen —
// der aufrufende API-Pfad darf nicht durch Mail-Probleme blockiert werden.

import { Resend } from "resend"

interface SendEmailParams {
  to: string
  subject: string
  html: string
  replyTo?: string
}

interface SendEmailResult {
  success: boolean
  id?: string
  skipped?: string
  error?: unknown
}

const apiKey = process.env.RESEND_API_KEY
const resend = apiKey ? new Resend(apiKey) : null
const fromAddress = process.env.RESEND_FROM_EMAIL || "Reparo <noreply@reparo-app.de>"

export async function sendEmail({ to, subject, html, replyTo }: SendEmailParams): Promise<SendEmailResult> {
  if (!resend) {
    // Soft-skip: kein API-Key konfiguriert. Hilfreich in Dev / vor erstem Resend-Setup.
    console.warn("[Email] RESEND_API_KEY fehlt — Mail an", to, "übersprungen")
    return { success: false, skipped: "no-api-key" }
  }
  if (!to || !to.includes("@")) {
    console.warn("[Email] Ungültige Empfänger-Adresse:", to)
    return { success: false, skipped: "invalid-recipient" }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
      replyTo,
    })
    if (error) {
      console.error("[Email] Resend-Fehler an", to, "—", error)
      return { success: false, error }
    }
    console.log("[Email] gesendet an", to, "| subject:", subject, "| id:", data?.id)
    return { success: true, id: data?.id }
  } catch (err) {
    console.error("[Email] Exception an", to, "—", err)
    return { success: false, error: err }
  }
}

/**
 * Helper für fire-and-forget-Aufrufe in API-Routen. Wartet NICHT auf
 * Resend, blockiert die Response nicht. Fehler werden geloggt.
 */
export function sendEmailFireAndForget(params: SendEmailParams): void {
  void sendEmail(params).catch(err => {
    console.error("[Email] Fire-and-forget-Fehler:", err)
  })
}
