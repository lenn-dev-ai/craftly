import { getValidAccessToken } from "./oauth"
import { listEventsForUser } from "./events"

// Sprint AM — Auslastungs-Dichte für die Preisformel
// (lib/pricing/auftragswert.ts). Schwester-Funktion zu
// hasGoogleEventInRange (F1-Fix): liest dieselben Events, aggregiert sie
// aber zu einem Dichte-Wert 0..1 statt einem reinen Boolean.
//
// Fail-open wie der Rest von lib/google-cal: kein Token / API-Fehler →
// null ("kein Google-Cal") → in der Preisformel neutraler Multiplikator
// 1.0, KEIN Nachteil für HW ohne Kalender-Anbindung.

const ARBEITSSTUNDEN_PRO_TAG = 8 // vereinfachtes Modell, z.B. 08:00-16:00
const BETRACHTUNGS_TAGE = 7

/**
 * Anteil belegter Arbeitsstunden in den nächsten `BETRACHTUNGS_TAGE`
 * Tagen, 0..1.
 *
 * - Kein Google-Cal verbunden (kein gültiges Token)  → null
 * - Verbunden, aber Events nicht lesbar (API-Fehler) → null (fail-open)
 * - Verbunden, Kalender leer                          → 0
 * - Verbunden, komplett ausgebucht                    → 1 (gecappt)
 */
export async function berechneAuslastung(userId: string): Promise<number | null> {
  // Erst prüfen, ob überhaupt ein Google-Cal verbunden ist — sonst
  // könnten wir "kein Cal" (→ neutral, 1.0) nicht von "Cal, aber leer"
  // (→ Anreiz-Rabatt, 0.95) unterscheiden.
  const token = await getValidAccessToken(userId)
  if (!token) return null

  const von = new Date()
  const bis = new Date(von.getTime() + BETRACHTUNGS_TAGE * 24 * 3600 * 1000)

  try {
    const events = await listEventsForUser(userId, von, bis)

    let belegteMinuten = 0
    for (const ev of events) {
      if (ev.allDay) {
        // Ganztages-Event blockiert den vollen Arbeitstag.
        belegteMinuten += ARBEITSSTUNDEN_PRO_TAG * 60
        continue
      }
      const start = new Date(ev.start).getTime()
      const end = new Date(ev.end).getTime()
      if (!isFinite(start) || !isFinite(end) || end <= start) continue
      belegteMinuten += (end - start) / 60000
    }

    const verfuegbareMinuten = BETRACHTUNGS_TAGE * ARBEITSSTUNDEN_PRO_TAG * 60
    if (verfuegbareMinuten <= 0) return null

    return Math.min(1, belegteMinuten / verfuegbareMinuten)
  } catch (err) {
    console.error("[google-cal/auslastung] Fehler bei Berechnung:", err)
    return null // fail-open
  }
}
