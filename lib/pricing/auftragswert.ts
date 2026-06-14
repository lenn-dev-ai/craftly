import { schaetzeFahrzeitMin } from "@/lib/distance"

// Sprint AM — zentrale Preisformel ("Auktion = Preisformel").
// Ersetzt die verstreute Inline-Berechnung
// (stundensatz × geschätzte_Stunden × surge_faktor) in
// /api/auction/start um zwei zusätzliche, objektive Faktoren:
//
//   Zeitdruck   = surge_faktor (bestehend, aus konfigFuer(dringlichkeit))
//   Fahrtweg    = Anfahrtspauschale aus haversineKm/schaetzeFahrzeitMin
//   Auslastung  = Google-Cal-Dichte-Multiplikator (0.95–1.10, Default 1.0)
//
// "Komplexität" als eigener Faktor ist bewusst nicht enthalten — die
// Stunden-Schätzung läuft weiterhin über geschaetzteStunden (estimatedH /
// befund_aufwand_stunden), siehe KONZEPT-handwerker-direktbuchung-doctolib.md
// Abschnitt 3.

export interface AuftragswertInput {
  /** € / Stunde des Handwerkers */
  stundensatz: number
  /** estimatedH (Default je Dringlichkeit) oder befund_aufwand_stunden */
  geschaetzteStunden: number
  /** surge_faktor aus konfigFuer(dringlichkeit) */
  surgeFaktor: number
  /** Entfernung Objekt <-> HW-Standort in km (haversineKm) */
  entfernungKm: number
  /**
   * Anteil belegter Arbeitsstunden der nächsten 7 Tage, 0..1.
   * null = kein Google-Cal verbunden / fail-open → neutraler Multiplikator.
   */
  auslastung: number | null
}

export interface AuftragswertBreakdown {
  basisbetrag: number
  zeitdruckBetrag: number
  fahrzeitMin: number
  anfahrtspauschale: number
  auslastungsMultiplikator: number
  /** Finaler, gerundeter Auftragswert inkl. 80€-Floor */
  gesamt: number
}

/** Bestehender Preis-Floor aus der Mass-Invite-Logik. */
export const PREIS_FLOOR = 80

/**
 * Anfahrtspauschale: Stufenmodell nach geschätzter Fahrzeit (einfache
 * Strecke). Deckt die "verlorene" Zeit pro Anfahrt ab, nicht die volle
 * Rundreise — sonst werden HW in ländlichen Gebieten unverhältnismäßig
 * teuer.
 *
 *   0–10 min   →  0 €  (Nahbereich, im Stundensatz "eingepreist")
 *   10–20 min  →  8 €
 *   20–30 min  → 15 €
 *   30+ min    → 15 € + 0,50 €/min über 30
 */
export function berechneAnfahrtspauschale(fahrzeitMin: number): number {
  if (!isFinite(fahrzeitMin) || fahrzeitMin <= 10) return 0
  if (fahrzeitMin <= 20) return 8
  if (fahrzeitMin <= 30) return 15
  return Math.round(15 + (fahrzeitMin - 30) * 0.5)
}

/**
 * Auslastungs-Multiplikator aus Kalender-Dichte (0..1):
 *   null (kein Google-Cal)  → 1.00 (neutral, fail-open)
 *   0.0  (Kalender leer)    → 0.95 (Anreiz-Rabatt)
 *   0.5  (halb voll)        → 1.00
 *   1.0  (komplett voll)    → 1.10 (Opportunitätskosten-Aufschlag)
 * Stückweise linear interpoliert zwischen den Stützpunkten.
 */
export function berechneAuslastungsMultiplikator(auslastung: number | null): number {
  if (auslastung == null || !isFinite(auslastung)) return 1.0
  const clamped = Math.max(0, Math.min(1, auslastung))
  if (clamped <= 0.5) return 0.95 + (clamped / 0.5) * 0.05
  return 1.0 + ((clamped - 0.5) / 0.5) * 0.1
}

/**
 * Zentrale Preisformel (Sprint AM):
 *
 *   Basisbetrag   = stundensatz × geschätzte_Stunden
 *   Auftragswert  = Basisbetrag × surge_faktor (Zeitdruck)
 *                 + Anfahrtspauschale(fahrzeit_min)          [Fahrtweg]
 *   Auftragswert  = Auftragswert × auslastungs_multiplikator [Auslastung]
 *
 * Ergebnis wird auf volle Euro gerundet und mit dem bestehenden
 * 80€-Floor versehen.
 */
export function berechneAuftragswert(input: AuftragswertInput): AuftragswertBreakdown {
  const stundensatz = isFinite(input.stundensatz) && input.stundensatz > 0
    ? input.stundensatz
    : 0
  const geschaetzteStunden = isFinite(input.geschaetzteStunden) && input.geschaetzteStunden > 0
    ? input.geschaetzteStunden
    : 0
  const surgeFaktor = isFinite(input.surgeFaktor) && input.surgeFaktor > 0
    ? input.surgeFaktor
    : 1.0
  const entfernungKm = isFinite(input.entfernungKm) && input.entfernungKm >= 0
    ? input.entfernungKm
    : 0

  const basisbetrag = stundensatz * geschaetzteStunden
  const zeitdruckBetrag = basisbetrag * surgeFaktor

  const fahrzeitMin = schaetzeFahrzeitMin(entfernungKm)
  const anfahrtspauschale = berechneAnfahrtspauschale(fahrzeitMin)

  const auslastungsMultiplikator = berechneAuslastungsMultiplikator(input.auslastung)

  const vorMultiplikator = zeitdruckBetrag + anfahrtspauschale
  const gesamt = Math.max(PREIS_FLOOR, Math.round(vorMultiplikator * auslastungsMultiplikator))

  return {
    basisbetrag: Math.round(basisbetrag * 100) / 100,
    zeitdruckBetrag: Math.round(zeitdruckBetrag * 100) / 100,
    fahrzeitMin,
    anfahrtspauschale,
    auslastungsMultiplikator,
    gesamt,
  }
}
