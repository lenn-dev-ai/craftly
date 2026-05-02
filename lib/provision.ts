// Provisions-Modell
// ============================================================================
// Reparo nimmt 5 % Provision vom Auftragswert. Der Verwalter trägt sie —
// der Handwerker bekommt den vollen Auftragswert ausgezahlt.
//
// Early-Adopter-Bonus:
//   In den ersten 90 Tagen nach Verwalter-Registrierung fällt KEINE Provision an.
//   Der Verwalter zahlt also nur den Auftragswert an den Handwerker.
//
// Berechnung erfolgt am Anzeige-Zeitpunkt (kein DB-Snapshot). Sobald echte
// Zahlungs-Abwicklung dazukommt (Stripe), wird hier zum Zeitpunkt der
// Rechnungsstellung snapshotted und die berechneten Werte mitgespeichert.
// ============================================================================

export const PROVISION_PROZENT_STANDARD = 5
export const EARLY_ADOPTER_TAGE = 90

export interface ProvisionInfo {
  prozent: number                    // 0 oder 5
  betrag: number                     // EUR (auf Cent gerundet)
  earlyAdopter: boolean              // true wenn aktuell im 90-Tage-Bonus
  earlyAdopterTageVerbleibend: number // Wenn earlyAdopter: wieviele Tage noch
  netto: number                      // Was Verwalter über Plattform bezahlt
  handwerkerErhaelt: number          // = kostenFinal, immer (HW kriegt voll)
}

export function berechneProvision(
  kostenFinal: number,
  verwalterCreatedAt: string | null | undefined,
): ProvisionInfo {
  const created = verwalterCreatedAt ? new Date(verwalterCreatedAt) : null
  const tageSeitRegistrierung =
    created && !isNaN(created.getTime())
      ? (Date.now() - created.getTime()) / 86_400_000
      : Infinity

  const earlyAdopter = tageSeitRegistrierung < EARLY_ADOPTER_TAGE
  const earlyAdopterTageVerbleibend = earlyAdopter
    ? Math.max(0, Math.ceil(EARLY_ADOPTER_TAGE - tageSeitRegistrierung))
    : 0

  const prozent = earlyAdopter ? 0 : PROVISION_PROZENT_STANDARD
  const betrag = Math.round((kostenFinal * prozent) / 100 * 100) / 100

  return {
    prozent,
    betrag,
    earlyAdopter,
    earlyAdopterTageVerbleibend,
    netto: Math.round((kostenFinal + betrag) * 100) / 100,
    handwerkerErhaelt: kostenFinal,
  }
}

// Aggregations-Helfer für Reporting
export function summiereProvision(
  tickets: { kosten_final?: number | null; status?: string }[],
  verwalterCreatedAt: string | null | undefined,
): { provisionGesamt: number; auftragswertGesamt: number; nettoGesamt: number; anzahl: number } {
  let provisionGesamt = 0
  let auftragswertGesamt = 0
  for (const t of tickets) {
    if (t.status !== "erledigt" || !t.kosten_final) continue
    const p = berechneProvision(t.kosten_final, verwalterCreatedAt)
    provisionGesamt += p.betrag
    auftragswertGesamt += t.kosten_final
  }
  return {
    provisionGesamt: Math.round(provisionGesamt * 100) / 100,
    auftragswertGesamt: Math.round(auftragswertGesamt * 100) / 100,
    nettoGesamt: Math.round((auftragswertGesamt + provisionGesamt) * 100) / 100,
    anzahl: tickets.filter(t => t.status === "erledigt" && t.kosten_final).length,
  }
}

export function formatiereGeld(eur: number): string {
  return `${eur.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}
