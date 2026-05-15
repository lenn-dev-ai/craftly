// Sentry-Init für Node-Runtime (API-Routes + Server-Components).

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Verschlüsselte/persönliche Daten aus Errors ausfiltern
    beforeSend(event) {
      // Auth-Tokens nie loggen
      if (event.request?.headers?.authorization) {
        event.request.headers.authorization = "[REDACTED]"
      }
      if (event.request?.cookies) {
        // cookies ist Record<string, string> — alle Werte redaktieren
        event.request.cookies = Object.fromEntries(
          Object.keys(event.request.cookies).map(k => [k, "[REDACTED]"]),
        )
      }
      return event
    },
  })
}
