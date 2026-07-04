import { createHmac, timingSafeEqual } from "crypto"

// Zero-Login-Statuslink (Produkt-Review 2026-07-03).
//
// Der Mieter ist ein Einmal-im-Jahr-Nutzer — für "Wo steht meine Meldung?"
// darf kein Passwort nötig sein. Der Link /status/[ticketId]?t=TOKEN trägt
// eine HMAC-Signatur über die Ticket-ID (Schlüssel: CRON_SECRET, wie bei
// den signierten Voice-Tool-URLs). Kein Ablauf: der Link zeigt nur einen
// minimalen Lese-Status und ist ohne gültige Signatur wertlos.

export function statusToken(ticketId: string): string | null {
  const secret = process.env.CRON_SECRET
  if (!secret) return null
  return createHmac("sha256", secret).update(`status.${ticketId}`).digest("hex")
}

export function verifyStatusToken(ticketId: string, token: string | null | undefined): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !token) return false
  const erwartet = createHmac("sha256", secret).update(`status.${ticketId}`).digest("hex")
  return token.length === erwartet.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(erwartet))
}

/** Absolute Status-URL fürs Mail-Template (null wenn CRON_SECRET fehlt). */
export function statusUrl(ticketId: string): string | null {
  const token = statusToken(ticketId)
  if (!token) return null
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"
  return `${base}/status/${ticketId}?t=${token}`
}
