import { describe, it, expect } from "vitest"
import {
  AUKTIONS_CONFIGS,
  MAX_AUKTIONSDAUER_STUNDEN,
  radiusEskalation,
  berechneAuktionsEnde,
  effektiveProvisionsRate,
} from "@/lib/auction/auction-manager"

describe("AUKTIONS_CONFIGS", () => {
  it("keine Dringlichkeitsstufe überschreitet den 72h-Cap (Lennart, Iter 11)", () => {
    for (const cfg of Object.values(AUKTIONS_CONFIGS)) {
      expect(cfg.auktionsDauerStunden).toBeLessThanOrEqual(MAX_AUKTIONSDAUER_STUNDEN)
    }
  })

  it("Notfall ist Sofort-Match mit höchstem Surge", () => {
    expect(AUKTIONS_CONFIGS.notfall.auktionsDauerStunden).toBe(0)
    expect(AUKTIONS_CONFIGS.notfall.surgeFaktor).toBeGreaterThan(AUKTIONS_CONFIGS.planbar.surgeFaktor)
  })
})

describe("radiusEskalation", () => {
  it("Standard-Stufen: Start → +5 → +15 → 50km-Cap", () => {
    expect(radiusEskalation(10)).toEqual([10, 15, 25, 50])
    expect(radiusEskalation(25)).toEqual([25, 30, 40, 50])
  })

  it("dedupliziert am Cap", () => {
    expect(radiusEskalation(48)).toEqual([48, 50])
    expect(radiusEskalation(50)).toEqual([50])
  })
})

describe("berechneAuktionsEnde", () => {
  const start = new Date("2026-07-03T10:00:00Z")

  it("0 Stunden (Notfall) → kein Auktionsende", () => {
    expect(berechneAuktionsEnde(start, 0)).toBeNull()
  })

  it("48h-Auktion endet 48h später", () => {
    expect(berechneAuktionsEnde(start, 48)?.toISOString()).toBe("2026-07-05T10:00:00.000Z")
  })

  it("cappt hart bei 72h — auch bei Alt-Daten mit 168h", () => {
    expect(berechneAuktionsEnde(start, 168)?.toISOString()).toBe("2026-07-06T10:00:00.000Z")
  })
})

describe("effektiveProvisionsRate", () => {
  it("Surge multipliziert die Basis-Rate (5% × 1.2 = 6%)", () => {
    const r = effektiveProvisionsRate(0.05, 1.2, false)
    expect(r.effektiveRate).toBe(0.06)
    expect(r.finalRate).toBe(0.06)
  })

  it("rundet auf 4 Nachkommastellen (5% × 1.1 = 5.5%)", () => {
    expect(effektiveProvisionsRate(0.05, 1.1, false).finalRate).toBe(0.055)
  })

  it("Early Adopter zahlt final 0 — Surge hin oder her", () => {
    const r = effektiveProvisionsRate(0.05, 1.2, true)
    expect(r.finalRate).toBe(0)
    expect(r.effektiveRate).toBe(0.06) // transparent ausgewiesen
  })
})
