import Stripe from "stripe"

// Server-only Stripe-Client.
//
// Wenn STRIPE_SECRET_KEY nicht gesetzt ist (z. B. lokale Entwicklung
// ohne Stripe-Account, oder Beta-User die Stripe noch nicht aktivieren
// wollen), liefert getStripe() null. Aufrufer MÜSSEN das null-Case
// behandeln und einen sauberen Fehler-State zeigen statt zu crashen.
//
// Pflicht: dieser Modul niemals client-seitig importieren — würde sonst
// den Secret-Key ins Bundle ziehen. Nur in /app/api/* + cron + lib/*-
// server-helpers verwenden.

let cached: Stripe | null | undefined = undefined

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    cached = null
    return null
  }
  cached = new Stripe(key, {
    // explizite API-Version damit Provider-Updates keine Breaking-Changes
    // einschleichen. Wenn upgegradet: hier UND tests/security/pen-tests
    // anpassen, sicherheitsrelevante Felder neu validieren.
    apiVersion: Stripe.API_VERSION,
    typescript: true,
    appInfo: { name: "Reparo", version: "0.1.0" },
  })
  return cached
}

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

// Plattform-Account-ID — der Account auf den die Penalty-Beträge
// fließen. NULL wenn nicht konfiguriert (lokaler Dev).
export function platformAccountId(): string | null {
  return process.env.STRIPE_PLATFORM_ACCOUNT_ID || null
}

export const PENALTY_AMOUNT_CENTS = 2000  // €20 default penalty
export const PENALTY_CURRENCY = "eur"
