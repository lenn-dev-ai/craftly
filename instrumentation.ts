// Next.js 13+ Instrumentation Hook — wird beim Server-Boot ausgeführt.
// Wir delegieren an die runtime-spezifischen Sentry-Configs.
// Wenn kein DSN gesetzt: Configs no-op'en, kein Performance-Impact.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}
