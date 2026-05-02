// Route-Optimierung: Wo passt ein neuer Auftrag in den Tag eines Handwerkers?
//
// Konzept:
// 1. Alle Termine des Tages auf einer Achse anordnen (sortiert nach Startzeit)
// 2. Für jede Lücke prüfen, ob Auftrag von Dauer X reinpasst
// 3. Pro Lücke: Fahrzeit vom vorherigen Termin → neuer Ort → nächster Termin
// 4. Delta = wieviel ZUSÄTZLICHE Fahrzeit der neue Auftrag erzeugt
// 5. Score 0–100, Effektivpreis = Basis-Stundensatz + (Fahrzeit-vorher-km × Fahrtkosten/km)

import { haversineKm, schaetzeFahrzeitMin } from "./distance"

export interface Termin {
  von: string                  // "08:00" 24h
  bis: string                  // "10:00"
  lat: number
  lng: number
  adresse: string
  typ: "auftrag" | "privat"
  titel?: string
}

export interface RoutenAnalyse {
  zeitslot: { von: string; bis: string }
  fahrzeitVorher: number       // Min vom vorherigen Termin (oder Startort)
  fahrzeitNachher: number      // Min zum nächsten Termin (oder 0 am Tagesende)
  fahrzeitDelta: number        // Zusätzliche Fahrzeit vs. ohne neuen Auftrag
  distanzVorherKm: number      // km vom vorherigen Termin
  routenScore: number          // 0–100 (100 = perfekt in Route)
  effektivPreis: number        // Basis + anteilige Fahrtkosten (pro Std.)
  passtInLuecke: boolean       // Ob Dauer in die Lücke passt
}

export interface AnalyseInput {
  termineDesTages: Termin[]
  startort: { lat: number; lng: number } | null
  neuerEinsatzort: { lat: number; lng: number }
  dauerMinuten: number
  basisStundensatz: number
  fahrtkostenProKm: number
  arbeitsbeginn?: string       // Default "07:00"
  arbeitsende?: string         // Default "20:00"
}

// Hilfsfunktionen für Zeit-Arithmetik
function parseTimeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + (m || 0)
}

function minToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

// Score-Mapping: delta=0 → 100, delta=50min → 0, linear
function berechneScore(deltaMin: number): number {
  if (deltaMin <= 0) return 100
  return Math.max(0, Math.round(100 - deltaMin * 2))
}

export function analysiereRoute(input: AnalyseInput): RoutenAnalyse[] {
  const beginn = parseTimeToMin(input.arbeitsbeginn || "07:00")
  const ende = parseTimeToMin(input.arbeitsende || "20:00")
  const termine = [...input.termineDesTages].sort(
    (a, b) => parseTimeToMin(a.von) - parseTimeToMin(b.von)
  )

  const results: RoutenAnalyse[] = []

  // Wir bauen eine Liste virtueller "Anker": [Startort + Termine] mit Endzeiten
  // und prüfen jede Lücke zwischen aufeinanderfolgenden Anker.
  type Anker = {
    endeMin: number              // Wann der Termin endet (oder Tagesbeginn)
    lat: number | null
    lng: number | null
    label: string
  }

  const anker: Anker[] = []
  // Tagesstart
  anker.push({
    endeMin: beginn,
    lat: input.startort?.lat ?? null,
    lng: input.startort?.lng ?? null,
    label: "Tagesstart",
  })
  // Termine
  for (const t of termine) {
    anker.push({
      endeMin: parseTimeToMin(t.bis),
      lat: t.lat,
      lng: t.lng,
      label: t.adresse,
    })
  }

  // Für jede Lücke "i → i+1": von anker[i].endeMin bis startVon(termin[i]) oder Tagesende
  for (let i = 0; i < anker.length; i++) {
    const aktuell = anker[i]
    const nachfolger = termine[i] // i==0: erster termin; sonst entsprechend

    const luckeStart = aktuell.endeMin
    const luckeEnde = nachfolger
      ? parseTimeToMin(nachfolger.von)
      : ende

    if (luckeEnde - luckeStart < input.dauerMinuten) {
      continue // Lücke zu klein
    }

    // Zeitslot innerhalb der Lücke (Mitte der Lücke als Default)
    const slotVon = luckeStart + Math.floor((luckeEnde - luckeStart - input.dauerMinuten) / 2)
    const slotBis = slotVon + input.dauerMinuten

    // Fahrzeit von aktuell → neuer Einsatzort
    let fahrzeitVorher = 0
    let distanzVorherKm = 0
    if (aktuell.lat != null && aktuell.lng != null) {
      distanzVorherKm = haversineKm(
        aktuell.lat, aktuell.lng,
        input.neuerEinsatzort.lat, input.neuerEinsatzort.lng,
      )
      fahrzeitVorher = schaetzeFahrzeitMin(distanzVorherKm)
    }

    // Fahrzeit von neuer Einsatzort → nachfolger
    let fahrzeitNachher = 0
    if (nachfolger) {
      const distNach = haversineKm(
        input.neuerEinsatzort.lat, input.neuerEinsatzort.lng,
        nachfolger.lat, nachfolger.lng,
      )
      fahrzeitNachher = schaetzeFahrzeitMin(distNach)
    }

    // Baseline: direkte Fahrt von aktuell → nachfolger (ohne neuen Auftrag)
    let baselineMin = 0
    if (aktuell.lat != null && aktuell.lng != null && nachfolger) {
      const distBase = haversineKm(
        aktuell.lat, aktuell.lng,
        nachfolger.lat, nachfolger.lng,
      )
      baselineMin = schaetzeFahrzeitMin(distBase)
    }

    const fahrzeitDelta = Math.max(0, fahrzeitVorher + fahrzeitNachher - baselineMin)
    const routenScore = berechneScore(fahrzeitDelta)
    const effektivPreis = Math.round(
      (input.basisStundensatz + distanzVorherKm * input.fahrtkostenProKm) * 100
    ) / 100

    results.push({
      zeitslot: { von: minToTime(slotVon), bis: minToTime(slotBis) },
      fahrzeitVorher,
      fahrzeitNachher,
      fahrzeitDelta,
      distanzVorherKm: Math.round(distanzVorherKm * 10) / 10,
      routenScore,
      effektivPreis,
      passtInLuecke: true,
    })
  }

  // Sortiert nach bestem Score, dann frühestem Slot
  return results.sort((a, b) => {
    if (b.routenScore !== a.routenScore) return b.routenScore - a.routenScore
    return parseTimeToMin(a.zeitslot.von) - parseTimeToMin(b.zeitslot.von)
  })
}

// Convenience-Funktion: Beste Analyse oder null
export function besteRoute(input: AnalyseInput): RoutenAnalyse | null {
  const all = analysiereRoute(input)
  return all[0] || null
}

// Score-Kategorien für UI
export type RoutenKategorie = "perfekt" | "umweg" | "weit"

export function routenKategorie(score: number): RoutenKategorie {
  if (score >= 80) return "perfekt"
  if (score >= 50) return "umweg"
  return "weit"
}

export function routenLabel(score: number): string {
  const k = routenKategorie(score)
  if (k === "perfekt") return "Perfekte Route"
  if (k === "umweg") return "Kurzer Umweg"
  return "Weiter Weg"
}

export function routenFarbe(score: number): { bg: string; text: string; border: string } {
  const k = routenKategorie(score)
  if (k === "perfekt") return { bg: "bg-[#3D8B7A]/10", text: "text-[#3D8B7A]", border: "border-[#3D8B7A]/25" }
  if (k === "umweg") return { bg: "bg-[#C4956A]/10", text: "text-[#854F0B]", border: "border-[#C4956A]/30" }
  return { bg: "bg-[#C4574B]/10", text: "text-[#C4574B]", border: "border-[#C4574B]/25" }
}
