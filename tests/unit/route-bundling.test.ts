import { describe, it, expect } from "vitest"
import { optimiereRoute, hatRoutenBonus } from "@/lib/auction/route-bundling"

// Start: Alexanderplatz. A ist am nächsten, C mittel, B am weitesten —
// Nearest-Neighbor muss A → C → B laufen.
const START = { lat: 52.52, lng: 13.405 }
const A = { ticketId: "a", latitude: 52.53, longitude: 13.41 }
const B = { ticketId: "b", latitude: 52.6, longitude: 13.5 }
const C = { ticketId: "c", latitude: 52.55, longitude: 13.45 }

describe("optimiereRoute", () => {
  it("leere Punktliste → leere Route", () => {
    expect(optimiereRoute(START.lat, START.lng, [])).toEqual({
      reihenfolge: [],
      gesamtDistanzKm: 0,
      gesamtFahrzeitMin: 0,
    })
  })

  it("sortiert per Nearest-Neighbor (A → C → B)", () => {
    const r = optimiereRoute(START.lat, START.lng, [B, C, A])
    expect(r.reihenfolge.map(p => p.ticketId)).toEqual(["a", "c", "b"])
  })

  it("besucht jeden Punkt genau einmal und summiert Distanz + Fahrzeit", () => {
    const r = optimiereRoute(START.lat, START.lng, [A, B, C])
    expect(r.reihenfolge).toHaveLength(3)
    expect(new Set(r.reihenfolge.map(p => p.ticketId)).size).toBe(3)
    expect(r.gesamtDistanzKm).toBeGreaterThan(0)
    expect(r.gesamtFahrzeitMin).toBeGreaterThan(0)
  })
})

describe("hatRoutenBonus", () => {
  const einsatzort = { lat: 52.52, lng: 13.405 }

  it("Job ~1 km entfernt → Bonus (Default-Radius 5 km)", () => {
    expect(
      hatRoutenBonus(einsatzort.lat, einsatzort.lng, [{ latitude: 52.529, longitude: 13.41 }]),
    ).toBe(true)
  })

  it("Job ~10 km entfernt → kein Bonus", () => {
    expect(
      hatRoutenBonus(einsatzort.lat, einsatzort.lng, [{ latitude: 52.61, longitude: 13.41 }]),
    ).toBe(false)
  })

  it("keine bestehenden Jobs → kein Bonus", () => {
    expect(hatRoutenBonus(einsatzort.lat, einsatzort.lng, [])).toBe(false)
  })

  it("eigener Radius überschreibt den Default", () => {
    expect(
      hatRoutenBonus(einsatzort.lat, einsatzort.lng, [{ latitude: 52.61, longitude: 13.41 }], 15),
    ).toBe(true)
  })
})
