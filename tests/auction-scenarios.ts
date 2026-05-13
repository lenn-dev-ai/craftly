/* eslint-disable @typescript-eslint/no-unused-vars */
// Test-Szenarien für die Auction-Engine.
// Ausführen: npx tsc --target es2020 --module commonjs --moduleResolution node \
//            --esModuleInterop --strict --outDir .test-out tests/auction-scenarios.ts \
//            lib/auction/smart-score.ts lib/auction/auction-manager.ts \
//            lib/auction/route-bundling.ts lib/distance.ts \
//            && node .test-out/tests/auction-scenarios.js
//
// Oder einfacher mit tsx (falls installiert): npx tsx tests/auction-scenarios.ts
//
// Die Szenarien decken die im Prompt genannten Fälle ab:
// 1) Notfall: Nähe + Bewertung dominieren, Preis irrelevant
// 2) Zeitnah: ausgewogene Mischung
// 3) Planbar: identisch zu Zeitnah, aber andere Surge/Dauer
// 4) Routen-Bonus: +10 % Score
// 5) Tie-Break-Setup
// 6) Surge-Mathematik mit Early-Adopter
// 7) Surge-Mathematik ohne Early-Adopter
// 8) Radius-Eskalation
// 9) Auktions-Ende-Berechnung
// 10) Nearest-Neighbor-TSP

import {
  berechneSmartScore,
  berechneSmartScoreBreakdown,
  type Dringlichkeit,
} from "../lib/auction/smart-score"
import {
  AUKTIONS_CONFIGS,
  effektiveProvisionsRate,
  radiusEskalation,
  berechneAuktionsEnde,
  konfigFuer,
} from "../lib/auction/auction-manager"
import {
  optimiereRoute,
  hatRoutenBonus,
  type RoutenPunkt,
} from "../lib/auction/route-bundling"

let bestanden = 0
let fehlgeschlagen = 0

function check(name: string, condition: boolean, details?: string) {
  if (condition) {
    bestanden++
    console.log(`  ✓ ${name}`)
  } else {
    fehlgeschlagen++
    console.error(`  ✗ ${name}${details ? " — " + details : ""}`)
  }
}

function nahe(a: number, b: number, toleranz = 0.01): boolean {
  return Math.abs(a - b) <= toleranz
}

console.log("\n=== Smart-Score: Notfall (Nähe 60 %, Bewertung 40 %, Preis 0 %) ===")
{
  const billigerWeit = berechneSmartScore({
    angebotPreis: 50,
    durchschnittPreis: 100,
    entfernungKm: 9,
    maxRadius: 10,
    bewertung: 4.5,
    istRoutenBonus: false,
    dringlichkeit: "notfall",
  })
  const teurerNah = berechneSmartScore({
    angebotPreis: 150,
    durchschnittPreis: 100,
    entfernungKm: 1,
    maxRadius: 10,
    bewertung: 4.5,
    istRoutenBonus: false,
    dringlichkeit: "notfall",
  })
  check("Notfall: nahe Anbieter schlägt billigen Anbieter weit weg",
    teurerNah > billigerWeit,
    `nah=${teurerNah}, weit=${billigerWeit}`)
}

console.log("\n=== Smart-Score: Zeitnah (ausgewogen) ===")
{
  const guenstig = berechneSmartScoreBreakdown({
    angebotPreis: 80,
    durchschnittPreis: 100,
    entfernungKm: 5,
    maxRadius: 15,
    bewertung: 4.0,
    istRoutenBonus: false,
    dringlichkeit: "zeitnah",
  })
  const teuer = berechneSmartScoreBreakdown({
    angebotPreis: 130,
    durchschnittPreis: 100,
    entfernungKm: 5,
    maxRadius: 15,
    bewertung: 4.0,
    istRoutenBonus: false,
    dringlichkeit: "zeitnah",
  })
  check("Zeitnah: günstigeres Angebot hat höheren Score (bei sonst gleich)",
    guenstig.total > teuer.total,
    `guenstig=${guenstig.total}, teuer=${teuer.total}`)
  check("Zeitnah: Preis-Score 80€/100€-Schnitt (Verhältnis 0.8) liegt zwischen 0 und 100",
    guenstig.preisScore > 50 && guenstig.preisScore <= 100,
    `preisScore=${guenstig.preisScore}`)
}

console.log("\n=== Smart-Score: Planbar (selbe Gewichtung wie Zeitnah) ===")
{
  const planbar = berechneSmartScore({
    angebotPreis: 100,
    durchschnittPreis: 100,
    entfernungKm: 5,
    maxRadius: 25,
    bewertung: 5.0,
    istRoutenBonus: false,
    dringlichkeit: "planbar",
  })
  const zeitnah = berechneSmartScore({
    angebotPreis: 100,
    durchschnittPreis: 100,
    entfernungKm: 5,
    maxRadius: 25,
    bewertung: 5.0,
    istRoutenBonus: false,
    dringlichkeit: "zeitnah",
  })
  check("Planbar und Zeitnah haben identische Gewichte",
    nahe(planbar, zeitnah),
    `planbar=${planbar}, zeitnah=${zeitnah}`)
}

console.log("\n=== Smart-Score: Routen-Bonus +10 % ===")
{
  const ohneBonus = berechneSmartScore({
    angebotPreis: 100,
    durchschnittPreis: 100,
    entfernungKm: 5,
    maxRadius: 25,
    bewertung: 4.0,
    istRoutenBonus: false,
    dringlichkeit: "planbar",
  })
  const mitBonus = berechneSmartScore({
    angebotPreis: 100,
    durchschnittPreis: 100,
    entfernungKm: 5,
    maxRadius: 25,
    bewertung: 4.0,
    istRoutenBonus: true,
    dringlichkeit: "planbar",
  })
  check("Routen-Bonus erhöht Score um ca. 10 %",
    nahe(mitBonus / ohneBonus, 1.1, 0.05),
    `verhältnis=${(mitBonus / ohneBonus).toFixed(3)}`)
}

console.log("\n=== Smart-Score: Sichtbarkeits-Bonus (Gold + 10 %, Silber + 5 %) ===")
{
  const bronze = berechneSmartScore({
    angebotPreis: 100, durchschnittPreis: 100, entfernungKm: 5, maxRadius: 25,
    bewertung: 4.0, istRoutenBonus: false, dringlichkeit: "planbar",
  })
  const silber = berechneSmartScore({
    angebotPreis: 100, durchschnittPreis: 100, entfernungKm: 5, maxRadius: 25,
    bewertung: 4.0, istRoutenBonus: false, dringlichkeit: "planbar",
    sichtbarkeitsStufe: "silber",
  })
  const gold = berechneSmartScore({
    angebotPreis: 100, durchschnittPreis: 100, entfernungKm: 5, maxRadius: 25,
    bewertung: 4.0, istRoutenBonus: false, dringlichkeit: "planbar",
    sichtbarkeitsStufe: "gold",
  })
  check("Silber: ca. + 5 % über Bronze",
    nahe(silber / bronze, 1.05, 0.01),
    `verhältnis=${(silber / bronze).toFixed(3)}`)
  check("Gold: ca. + 10 % über Bronze",
    nahe(gold / bronze, 1.10, 0.01),
    `verhältnis=${(gold / bronze).toFixed(3)}`)
  check("Default ohne Stufe = Bronze (kein Bonus)",
    berechneSmartScore({
      angebotPreis: 100, durchschnittPreis: 100, entfernungKm: 5, maxRadius: 25,
      bewertung: 4.0, istRoutenBonus: false, dringlichkeit: "planbar",
    }) === bronze,
    "Optional-Param greift transparent")

  const breakdown = berechneSmartScoreBreakdown({
    angebotPreis: 100, durchschnittPreis: 100, entfernungKm: 5, maxRadius: 25,
    bewertung: 4.0, istRoutenBonus: false, dringlichkeit: "planbar",
    sichtbarkeitsStufe: "gold",
  })
  check("Breakdown enthält sichtbarkeitsBonus > 0 bei Gold",
    breakdown.sichtbarkeitsBonus > 0,
    `bonus=${breakdown.sichtbarkeitsBonus}`)
}

console.log("\n=== Smart-Score: Cap bei 100 ===")
{
  const max = berechneSmartScore({
    angebotPreis: 1,
    durchschnittPreis: 100,
    entfernungKm: 0,
    maxRadius: 25,
    bewertung: 5.0,
    istRoutenBonus: true,
    dringlichkeit: "planbar",
  })
  check("Smart-Score wird auf 100 gedeckelt",
    max <= 100,
    `score=${max}`)
}

console.log("\n=== Surge: Provisions-Mathematik ===")
{
  const notfall = effektiveProvisionsRate(0.05, 1.20, false)
  check("Notfall-Surge: 5 % × 1.20 = 6 %",
    nahe(notfall.finalRate, 0.06, 0.0001),
    `rate=${notfall.finalRate}`)

  const zeitnah = effektiveProvisionsRate(0.05, 1.10, false)
  check("Zeitnah-Surge: 5 % × 1.10 = 5.5 %",
    nahe(zeitnah.finalRate, 0.055, 0.0001),
    `rate=${zeitnah.finalRate}`)

  const planbar = effektiveProvisionsRate(0.05, 1.00, false)
  check("Planbar: 5 % × 1.00 = 5 %",
    nahe(planbar.finalRate, 0.05, 0.0001),
    `rate=${planbar.finalRate}`)

  const earlyAdopter = effektiveProvisionsRate(0.05, 1.20, true)
  check("Early-Adopter zahlt 0 % auch bei Notfall-Surge",
    earlyAdopter.finalRate === 0,
    `rate=${earlyAdopter.finalRate}`)
}

console.log("\n=== Auktions-Konfig + Radius-Eskalation ===")
{
  check("Notfall: 10 km, 0 h Dauer, +20 % Surge",
    konfigFuer("notfall").radiusKm === 10 &&
    konfigFuer("notfall").auktionsDauerStunden === 0 &&
    konfigFuer("notfall").surgeFaktor === 1.20)

  check("Zeitnah: 15 km, 48 h, +10 %",
    konfigFuer("zeitnah").radiusKm === 15 &&
    konfigFuer("zeitnah").auktionsDauerStunden === 48 &&
    konfigFuer("zeitnah").surgeFaktor === 1.10)

  check("Planbar: 25 km, 168 h, kein Surge",
    konfigFuer("planbar").radiusKm === 25 &&
    konfigFuer("planbar").auktionsDauerStunden === 168 &&
    konfigFuer("planbar").surgeFaktor === 1.00)

  const eskalation10 = radiusEskalation(10)
  check("Radius-Eskalation 10 → endet bei 50",
    eskalation10[0] === 10 && eskalation10[eskalation10.length - 1] === 50,
    `kette=${eskalation10.join(",")}`)
}

console.log("\n=== Auktions-Ende ===")
{
  const start = new Date("2026-05-08T10:00:00Z")
  const ende = berechneAuktionsEnde(start, 48)
  check("48 h nach 10 Uhr → 2 Tage später 10 Uhr",
    ende?.toISOString() === "2026-05-10T10:00:00.000Z",
    `ende=${ende?.toISOString()}`)

  check("0-Stunden Auktion (Notfall) → null",
    berechneAuktionsEnde(start, 0) === null)
}

console.log("\n=== Routen-Bündelung: Nearest-Neighbor ===")
{
  // Drei Punkte in Berlin als Lat/Lng
  const start = { lat: 52.520, lng: 13.405 } // Mitte
  const punkte: RoutenPunkt[] = [
    { ticketId: "weit", latitude: 52.560, longitude: 13.500 },     // ~7 km
    { ticketId: "nah",  latitude: 52.525, longitude: 13.410 },     // ~600 m
    { ticketId: "mittel", latitude: 52.540, longitude: 13.450 },   // ~3.5 km
  ]
  const route = optimiereRoute(start.lat, start.lng, punkte)
  check("Nearest-Neighbor besucht 'nah' zuerst",
    route.reihenfolge[0].ticketId === "nah",
    `reihenfolge=${route.reihenfolge.map(r => r.ticketId).join("→")}`)
  check("Alle Punkte besucht",
    route.reihenfolge.length === 3)
  check("Distanz > 0 wenn Punkte vorhanden",
    route.gesamtDistanzKm > 0)
}

console.log("\n=== Routen-Bonus-Erkennung ===")
{
  // Neuer Einsatzort am Hackeschen Markt — bestehender Termin am Alex (1 km)
  const ja = hatRoutenBonus(52.523, 13.402, [{ latitude: 52.522, longitude: 13.413 }])
  check("Bestehender Job 1 km entfernt → Routen-Bonus", ja)

  const nein = hatRoutenBonus(52.523, 13.402, [{ latitude: 52.450, longitude: 13.500 }])
  check("Bestehender Job 10 km entfernt → kein Bonus", !nein)

  const leer = hatRoutenBonus(52.523, 13.402, [])
  check("Keine bestehenden Jobs → kein Bonus", !leer)
}

console.log("\n=== Tie-Break-Setup (Smart-Score gleich) ===")
{
  const a = berechneSmartScore({
    angebotPreis: 100, durchschnittPreis: 100, entfernungKm: 5, maxRadius: 25,
    bewertung: 4.0, istRoutenBonus: false, dringlichkeit: "planbar",
  })
  const b = berechneSmartScore({
    angebotPreis: 100, durchschnittPreis: 100, entfernungKm: 5, maxRadius: 25,
    bewertung: 4.0, istRoutenBonus: false, dringlichkeit: "planbar",
  })
  check("Identische Inputs → identische Smart-Scores", nahe(a, b),
    `a=${a}, b=${b} (Tie-Break muss in close-Endpoint per erfahrung erfolgen)`)
}

// --- Zusammenfassung ---
console.log("\n========================================")
console.log(`  Tests: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`)
console.log("========================================\n")
process.exit(fehlgeschlagen === 0 ? 0 : 1)
