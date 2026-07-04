import { describe, it, expect } from "vitest"
import {
  scoreEinladung,
  scoreZuSprache,
  type EinladungInput,
  type HwPreferences,
} from "@/lib/agent/score-einladung"

// Fixtures: HW startet am Alexanderplatz (Berlin), Radius 25 km.
const hwBasis: HwPreferences = {
  handwerker_gewerke: ["heizung_sanitaer", "elektro"],
  gewerk: null,
  radius_km: 25,
  agent_max_radius_km: null,
  agent_auto_accept: true,
  agent_min_auftragswert: null,
  startort_lat: 52.52,
  startort_lng: 13.405,
  mindest_stundensatz: null,
}

const einladungBasis: EinladungInput = {
  id: "e1",
  ticket_id: "t1",
  titel: "Heizung entlüften",
  gewerk: "heizung_sanitaer",
  einsatzort_adresse: "Schönhauser Allee 80, 10439 Berlin",
  einsatzort_lat: 52.53, // ~1.2 km vom Startort
  einsatzort_lng: 13.41,
  kosten_final: 200,
  dringlichkeit: "zeitnah",
}

describe("scoreEinladung — Empfehlung", () => {
  it("perfekter Match (Gewerk + nah + guter Wert) → annehmen, auto-accept-fähig", () => {
    const r = scoreEinladung(einladungBasis, hwBasis)
    expect(r.empfehlung).toBe("annehmen")
    expect(r.score).toBeGreaterThanOrEqual(65)
    expect(r.autoAcceptEligible).toBe(true)
    expect(r.distanzKm).not.toBeNull()
    expect(r.distanzKm!).toBeLessThan(3)
  })

  it("falsches Gewerk ist Hard-Blocker für Auto-Accept", () => {
    const r = scoreEinladung({ ...einladungBasis, gewerk: "dachdecker" }, hwBasis)
    expect(r.autoAcceptEligible).toBe(false)
    expect(r.gruende.join(" ")).toContain("Gewerk passt nicht")
  })

  it("außerhalb des Radius → Malus + Auto-Accept-Blocker", () => {
    // München ist ~500 km entfernt
    const r = scoreEinladung(
      { ...einladungBasis, einsatzort_lat: 48.14, einsatzort_lng: 11.58 },
      hwBasis,
    )
    expect(r.autoAcceptEligible).toBe(false)
    expect(r.gruende.join(" ")).toContain("Zu weit")
  })

  it("falsches Gewerk UND zu weit → ablehnen", () => {
    const r = scoreEinladung(
      { ...einladungBasis, gewerk: "dachdecker", einsatzort_lat: 48.14, einsatzort_lng: 11.58 },
      hwBasis,
    )
    expect(r.empfehlung).toBe("ablehnen")
    expect(r.score).toBeLessThanOrEqual(35)
  })

  it("Auftragswert unter Agent-Minimum blockiert Auto-Accept", () => {
    const r = scoreEinladung(
      { ...einladungBasis, kosten_final: 80 },
      { ...hwBasis, agent_min_auftragswert: 100 },
    )
    expect(r.autoAcceptEligible).toBe(false)
    expect(r.gruende.join(" ")).toContain("unter Mindest")
  })

  it("ohne agent_auto_accept nie auto-accept-fähig — egal wie gut", () => {
    const r = scoreEinladung(einladungBasis, { ...hwBasis, agent_auto_accept: false })
    expect(r.empfehlung).toBe("annehmen")
    expect(r.autoAcceptEligible).toBe(false)
  })

  it("fehlende Koordinaten → Entfernung unbekannt, kein Crash", () => {
    const r = scoreEinladung(
      { ...einladungBasis, einsatzort_lat: null, einsatzort_lng: null },
      hwBasis,
    )
    expect(r.distanzKm).toBeNull()
    expect(r.gruende.join(" ")).toContain("Entfernung unbekannt")
  })

  it("agent_max_radius_km überschreibt den Profil-Radius", () => {
    // 1.2 km Distanz, aber Agent-Radius nur 1 km → zu weit
    const r = scoreEinladung(einladungBasis, { ...hwBasis, agent_max_radius_km: 1 })
    expect(r.autoAcceptEligible).toBe(false)
    expect(r.gruende.join(" ")).toContain("Zu weit")
  })

  it("Score bleibt in [0, 100] geklemmt", () => {
    const top = scoreEinladung({ ...einladungBasis, dringlichkeit: "notfall" }, hwBasis)
    expect(top.score).toBeLessThanOrEqual(100)
    const flop = scoreEinladung(
      { ...einladungBasis, gewerk: "dachdecker", einsatzort_lat: 48.14, einsatzort_lng: 11.58, kosten_final: 10 },
      { ...hwBasis, agent_min_auftragswert: 500 },
    )
    expect(flop.score).toBeGreaterThanOrEqual(0)
  })
})

describe("scoreZuSprache", () => {
  it("annehmen-Empfehlung wird als Empfehlung gesprochen", () => {
    const r = scoreEinladung(einladungBasis, hwBasis)
    const text = scoreZuSprache(einladungBasis, r)
    expect(text).toContain("Heizung entlüften")
    expect(text).toContain("empfehle")
  })

  it("ablehnen-Empfehlung nennt den Grund", () => {
    const einladung = { ...einladungBasis, gewerk: "dachdecker", einsatzort_lat: 48.14, einsatzort_lng: 11.58 }
    const r = scoreEinladung(einladung, hwBasis)
    const text = scoreZuSprache(einladung, r)
    expect(text).toContain("ablehnen")
  })
})
