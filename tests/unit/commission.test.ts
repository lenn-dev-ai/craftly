import { describe, it, expect } from "vitest"
import {
  calculateCommission,
  calculateTotal,
  isEarlyAdopter,
  getProvisionRate,
  formatPriceBreakdown,
  STANDARD_PROVISION_RATE,
} from "@/lib/pricing/commission"

// Provisions-Modell: Verwalter zahlt Provision, HW bekommt vollen
// Auftragswert. Diese Rechnungen stecken hinter jeder Vergabe —
// deshalb hier exakt festgenagelt.

describe("calculateCommission", () => {
  it("berechnet 5% Standard-Provision korrekt", () => {
    expect(calculateCommission(1000, 0.05)).toEqual({ provisionBetrag: 50, gesamt: 1050 })
  })

  it("rundet kaufmännisch auf 2 Nachkommastellen", () => {
    // 99.99 * 0.05 = 4.9995 → 5.00
    expect(calculateCommission(99.99, 0.05)).toEqual({ provisionBetrag: 5, gesamt: 104.99 })
  })

  it("Rate 0 (Early Adopter) ergibt keinen Aufschlag", () => {
    expect(calculateCommission(500, 0)).toEqual({ provisionBetrag: 0, gesamt: 500 })
  })
})

describe("calculateTotal", () => {
  it("Stundensatz × Stunden + Provision", () => {
    // 85 €/h × 3 h = 255 €, +5% = 12.75 € → 267.75 €
    expect(calculateTotal(85, 3, 0.05)).toEqual({
      auftragswert: 255,
      provisionBetrag: 12.75,
      gesamt: 267.75,
    })
  })
})

describe("isEarlyAdopter", () => {
  it("false ohne Profil oder ohne Datum", () => {
    expect(isEarlyAdopter(null)).toBe(false)
    expect(isEarlyAdopter(undefined)).toBe(false)
    expect(isEarlyAdopter({ early_adopter_bis: null })).toBe(false)
  })

  it("true wenn early_adopter_bis in der Zukunft liegt", () => {
    const zukunft = new Date(Date.now() + 30 * 86400_000).toISOString()
    expect(isEarlyAdopter({ early_adopter_bis: zukunft })).toBe(true)
  })

  it("false wenn abgelaufen oder ungültig", () => {
    const vergangenheit = new Date(Date.now() - 86400_000).toISOString()
    expect(isEarlyAdopter({ early_adopter_bis: vergangenheit })).toBe(false)
    expect(isEarlyAdopter({ early_adopter_bis: "kein-datum" })).toBe(false)
  })
})

describe("getProvisionRate", () => {
  it("Early Adopter zahlt 0", () => {
    const zukunft = new Date(Date.now() + 86400_000).toISOString()
    expect(getProvisionRate({ early_adopter_bis: zukunft })).toBe(0)
  })

  it("sonst Standard-Rate (5%)", () => {
    expect(getProvisionRate(null)).toBe(STANDARD_PROVISION_RATE)
    expect(getProvisionRate(null, 0.07)).toBe(0.07)
  })
})

describe("formatPriceBreakdown", () => {
  it("HW erhält immer den vollen Auftragswert (100%-Versprechen)", () => {
    const b = formatPriceBreakdown(320, 0.05)
    expect(b.handwerkerErhaelt).toBe(320)
    expect(b.gesamt).toBe(336)
    expect(b.isEarlyAdopter).toBe(false)
  })

  it("Rate 0 wird als Early Adopter ausgewiesen", () => {
    expect(formatPriceBreakdown(320, 0).isEarlyAdopter).toBe(true)
  })
})
