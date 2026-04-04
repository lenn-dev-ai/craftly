/* ============================================================
   REPARO FORMAT UTILITIES
   Einheitliche Formatierung für Preise, Zeiten und Zahlen
   ============================================================ */

const euroFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const euroFormatCents = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formatiert einen Betrag als "65 €" (ohne Cents) */
export function formatEuro(betrag: number): string {
  return euroFormat.format(betrag)
}

/** Formatiert einen Betrag als "1.250,00 €" (mit Cents) */
export function formatEuroCents(betrag: number): string {
  return euroFormatCents.format(betrag)
}

/** Formatiert eine Zahl mit Tausender-Trennung: 1250 → "1.250" */
export function formatZahl(n: number): string {
  return n.toLocaleString("de-DE")
}

/** Kürzt Zeitstrings auf HH:MM — "08:00:00" → "08:00" */
export function formatZeit(zeit: string): string {
  if (!zeit) return ""
  return zeit.substring(0, 5)
}
