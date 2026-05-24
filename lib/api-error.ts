// Sprint N — Shared API-Error → User-Message-Mapper.
// Verwandelt unbekannte/technische Fehler in deutsche, handlungs-
// orientierte Texte. Wird typischerweise direkt vor einem Toast-Show
// genutzt: `show(getUserMessage(err).description, "error")`.

export interface UserError {
  title: string
  description: string
  action?: { label: string; href?: string }
}

const AUTH_PATTERNS = /unauthorized|not.*authenticated|invalid.*token|jwt|session.*expired/i
const PERMISSION_PATTERNS = /forbidden|permission|rls|not allowed|policy/i
const RATE_PATTERNS = /rate.*limit|too many|429/i
const NETWORK_PATTERNS = /network|fetch.*failed|aborted|TypeError.*fetch/i
const VALIDATION_PATTERNS = /invalid.*input|validation|required|must be/i
const NOT_FOUND_PATTERNS = /not.*found|404|does not exist/i
const STRIPE_PATTERNS = /stripe|payment|card.*declined/i

export function getUserMessage(error: unknown): UserError {
  const msg = errorMessage(error)

  if (NETWORK_PATTERNS.test(msg)) {
    return {
      title: "Verbindungsproblem",
      description: "Die Verbindung zu Reparo ist abgerissen. Bitte Internet prüfen und erneut versuchen.",
    }
  }
  if (AUTH_PATTERNS.test(msg)) {
    return {
      title: "Anmeldung abgelaufen",
      description: "Bitte logge dich neu ein.",
      action: { label: "Zum Login", href: "/login" },
    }
  }
  if (PERMISSION_PATTERNS.test(msg)) {
    return {
      title: "Keine Berechtigung",
      description: "Für diese Aktion fehlt dir die Berechtigung. Falls das ein Fehler ist, melde dich kurz beim Reparo-Team.",
    }
  }
  if (RATE_PATTERNS.test(msg)) {
    return {
      title: "Zu schnell",
      description: "Du klickst schneller als unser System mitkommt. Bitte 30 Sekunden warten und erneut versuchen.",
    }
  }
  if (NOT_FOUND_PATTERNS.test(msg)) {
    return {
      title: "Nicht gefunden",
      description: "Der gesuchte Eintrag existiert nicht mehr. Vielleicht wurde er gelöscht oder verschoben.",
    }
  }
  if (VALIDATION_PATTERNS.test(msg)) {
    return {
      title: "Eingabe prüfen",
      description: msg.length < 160 ? msg : "Einige Felder sind ungültig — bitte Eingaben prüfen.",
    }
  }
  if (STRIPE_PATTERNS.test(msg)) {
    return {
      title: "Zahlungsproblem",
      description: "Die Zahlung konnte nicht abgewickelt werden. Bitte Zahlungsmethode prüfen.",
    }
  }
  return {
    title: "Etwas ist schiefgelaufen",
    description: msg && msg.length < 160 ? msg : "Bitte erneut versuchen oder über die Feedback-Bubble melden.",
  }
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === "string") return m
  }
  return ""
}
