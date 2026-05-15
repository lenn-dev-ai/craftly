// Sentry-Init für Browser-Errors (Client-Side).
// Lädt nur wenn NEXT_PUBLIC_SENTRY_DSN gesetzt ist — sonst stumm.

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
    // Sample-Rates konservativ — bei Bedarf in Sentry-UI hochdrehen
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.05,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true, // DSGVO: keine User-Inputs in Recordings
        blockAllMedia: true,
      }),
    ],
    // Bekannte unkritische Errors filtern
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
    ],
  })
}
