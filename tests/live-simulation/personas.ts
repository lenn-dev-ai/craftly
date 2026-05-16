import { pickAddress } from "./fixtures/addresses"

export type SimRole = "mieter" | "verwalter" | "handwerker"
export type SimBehavior = "schnell" | "langsam" | "unsicher" | "power_user" | "fehleranfällig"

export interface Persona {
  id: string
  rolle: SimRole
  name: string
  email: string
  passwort: string
  firma?: string
  gewerk?: string
  adresse?: string
  bezirk?: string
  verhalten: SimBehavior
}

const FIRST_NAMES = [
  "Lina", "Mara", "Noah", "Ben", "Emilia", "Paul", "Lea", "Jonas", "Mila", "Anton",
  "Sofia", "Elias", "Nina", "Lukas", "Hannah", "Felix", "Clara", "Tom", "Nora", "Oskar",
]

const LAST_NAMES = [
  "Keller", "Berger", "Schubert", "Vogel", "Hartmann", "Neumann", "Winkler", "Krüger", "Bauer", "Lange",
  "Seidel", "Fischer", "Becker", "Richter", "Koch", "Scholz", "Brandt", "Peters", "Jung", "Hoffmann",
]

const BEHAVIORS: SimBehavior[] = ["schnell", "langsam", "unsicher", "power_user", "fehleranfällig"]

const HANDWERKER_GEWERKE = [
  "sanitaer", "heizung", "elektro", "maler", "schreiner",
  "sanitaer", "elektro", "heizung", "maler", "schreiner",
  "dachdecker", "schlosser", "allgemein", "sanitaer", "elektro",
  "heizung", "maler", "schreiner", "sanitaer", "elektro",
  "heizung", "dachdecker", "schlosser", "sanitaer", "allgemein",
] as const

const VERWALTER_FIRMEN = [
  "Hausverwaltung Mitte",
  "Quartier Service GmbH",
  "Berg & Partner Immobilien",
  "KiezVerwaltung Nord",
  "Stadtgrund Verwaltung",
]

const HANDWERKER_FIRMEN = [
  "Keller Sanitär GmbH",
  "Winkler Heiztechnik",
  "Bauer Elektro Service",
  "Krüger Malerbetrieb",
  "Scholz Holz & Ausbau",
  "Vogel Dach & Fassade",
  "Hartmann Schlosserdienst",
  "Neumann Allround Service",
]

function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pick<T>(list: readonly T[], index: number): T {
  return list[index % list.length]
}

function buildName(index: number): string {
  const first = pick(FIRST_NAMES, index)
  const last = pick(LAST_NAMES, Math.floor(index / FIRST_NAMES.length))
  return `${first} ${last}`
}

function behaviorFor(role: SimRole, index: number): SimBehavior {
  const offset = role === "mieter" ? 0 : role === "verwalter" ? 1 : 2
  return BEHAVIORS[(index + offset) % BEHAVIORS.length]
}

function rolePrefix(role: SimRole): string {
  return role === "mieter" ? "mieter" : role === "verwalter" ? "verwalter" : "hw"
}

function emailFor(role: SimRole, index: number): string {
  return `sim+${rolePrefix(role)}-${String(index + 1).padStart(3, "0")}@reparo.test`
}

export function buildPersonas(total = 100): Persona[] {
  const target = Math.min(Math.max(total, 1), 100)
  const counts = [
    { role: "verwalter" as const, count: 5 },
    { role: "handwerker" as const, count: 25 },
    { role: "mieter" as const, count: 70 },
  ]

  const personas: Persona[] = []
  let globalIndex = 0

  for (const { role, count } of counts) {
    for (let localIndex = 0; localIndex < count && personas.length < target; localIndex++) {
      const name = buildName(globalIndex)
      const address = pickAddress(globalIndex)
      const behavior = behaviorFor(role, globalIndex)
      const base = {
        id: `${role}-${String(localIndex + 1).padStart(3, "0")}`,
        rolle: role,
        name,
        email: emailFor(role, globalIndex),
        passwort: `Sim${role[0].toUpperCase()}${String(localIndex + 1).padStart(3, "0")}!`,
        verhalten: behavior,
        adresse: `${address.strasse}, ${address.plz} ${address.ort}`,
        bezirk: address.bezirk,
      }

      if (role === "verwalter") {
        personas.push({
          ...base,
          firma: pick(VERWALTER_FIRMEN, localIndex),
          adresse: address.bezirk,
        })
      } else if (role === "handwerker") {
        const gewerk = HANDWERKER_GEWERKE[localIndex % HANDWERKER_GEWERKE.length]
        personas.push({
          ...base,
          firma: pick(HANDWERKER_FIRMEN, localIndex),
          gewerk,
          adresse: `${address.strasse}, ${address.plz} ${address.ort}`,
        })
      } else {
        personas.push({
          ...base,
          adresse: address.bezirk,
        })
      }

      globalIndex++
    }
  }

  return personas
}

export const PERSONAS = buildPersonas(100)
