import type { SimRole } from "./personas"

export interface Scenario {
  id: string
  name: string
  rolle: SimRole
  weight: number
  writes: boolean
  steps: string[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: "schaden_melden_text",
    name: "Schaden textlich melden",
    rolle: "mieter",
    weight: 35,
    writes: true,
    steps: ["Landing öffnen", "Login öffnen", "Registrierung öffnen", "Schaden-Melden-Formular öffnen"],
  },
  {
    id: "schaden_melden_foto_optional",
    name: "Schaden mit optionalem Foto melden",
    rolle: "mieter",
    weight: 20,
    writes: true,
    steps: ["Landing öffnen", "Login öffnen", "Registrierung öffnen", "Foto-gestützte Meldung vorbereiten"],
  },
  {
    id: "ticket_status_pruefen",
    name: "Ticketstatus prüfen",
    rolle: "mieter",
    weight: 25,
    writes: false,
    steps: ["Landing öffnen", "Login öffnen", "Registrierung öffnen", "Ticketübersicht öffnen"],
  },
  {
    id: "bewertung_abgeben",
    name: "Bewertung abgeben",
    rolle: "mieter",
    weight: 10,
    writes: true,
    steps: ["Landing öffnen", "Login öffnen", "Registrierung öffnen", "Bewertungsformular öffnen"],
  },
  {
    id: "unvollstaendige_meldung",
    name: "Unvollständige Meldung erzeugen",
    rolle: "mieter",
    weight: 10,
    writes: true,
    steps: ["Landing öffnen", "Login öffnen", "Registrierung öffnen", "Fehlerhafte Eingabe simulieren"],
  },
  {
    id: "dashboard_pruefen",
    name: "Dashboard prüfen",
    rolle: "verwalter",
    weight: 30,
    writes: false,
    steps: ["Landing öffnen", "Login öffnen", "Verwalter-Dashboard öffnen"],
  },
  {
    id: "neue_meldung_oeffnen",
    name: "Neue Meldung öffnen",
    rolle: "verwalter",
    weight: 15,
    writes: false,
    steps: ["Dashboard öffnen", "Neue Meldung lesen", "Ticketdetails öffnen"],
  },
  {
    id: "handwerker_buchen",
    name: "Handwerker buchen",
    rolle: "verwalter",
    weight: 10,
    writes: true,
    steps: ["Marktplatz öffnen", "Handwerker auswählen", "Buchung absenden"],
  },
  {
    id: "auktion_starten",
    name: "Auktion starten",
    rolle: "verwalter",
    weight: 10,
    writes: true,
    steps: ["Ticket öffnen", "Auktion starten", "Auktionsseite prüfen"],
  },
  {
    id: "angebot_annehmen",
    name: "Angebot annehmen",
    rolle: "verwalter",
    weight: 15,
    writes: true,
    steps: ["Auktionsdetails öffnen", "Angebot vergleichen", "Angebot annehmen"],
  },
  {
    id: "nachtrag_pruefen",
    name: "Nachtrag prüfen",
    rolle: "verwalter",
    weight: 10,
    writes: true,
    steps: ["Ticket öffnen", "Nachtrag lesen", "Entscheidung prüfen"],
  },
  {
    id: "reporting_pruefen",
    name: "Reporting prüfen",
    rolle: "verwalter",
    weight: 10,
    writes: false,
    steps: ["Reporting öffnen", "Kosten und Provisionen lesen", "Auswertung prüfen"],
  },
  {
    id: "dashboard_pruefen_hw",
    name: "Dashboard prüfen",
    rolle: "handwerker",
    weight: 30,
    writes: false,
    steps: ["Landing öffnen", "Login öffnen", "Handwerker-Dashboard öffnen"],
  },
  {
    id: "zeitslot_pflegen",
    name: "Zeitslot pflegen",
    rolle: "handwerker",
    weight: 15,
    writes: true,
    steps: ["Zeitslots öffnen", "Slot vorbereiten", "Slot speichern"],
  },
  {
    id: "angebot_abgeben",
    name: "Angebot abgeben",
    rolle: "handwerker",
    weight: 15,
    writes: true,
    steps: ["Ausschreibung öffnen", "Preis setzen", "Angebot absenden"],
  },
  {
    id: "diagnose_annehmen",
    name: "Diagnose annehmen",
    rolle: "handwerker",
    weight: 10,
    writes: true,
    steps: ["Diagnose öffnen", "Termin annehmen", "Befund vorbereiten"],
  },
  {
    id: "befund_abgeben",
    name: "Befund abgeben",
    rolle: "handwerker",
    weight: 10,
    writes: true,
    steps: ["Diagnose öffnen", "Befund schreiben", "Projektpreis abgeben"],
  },
  {
    id: "profil_pflegen",
    name: "Profil pflegen",
    rolle: "handwerker",
    weight: 10,
    writes: true,
    steps: ["Profil öffnen", "Stammdaten prüfen", "Änderungen speichern"],
  },
  {
    id: "einnahmen_pruefen",
    name: "Einnahmen prüfen",
    rolle: "handwerker",
    weight: 10,
    writes: false,
    steps: ["Einnahmen öffnen", "Umsätze lesen", "Entwicklung prüfen"],
  },
]

export function scenariosForRole(role: SimRole): Scenario[] {
  return SCENARIOS.filter(s => s.rolle === role)
}

export function readOnlyScenariosForRole(role: SimRole): Scenario[] {
  return scenariosForRole(role).filter(s => !s.writes)
}

export function weightedScenarioChoice(role: SimRole, seed: number, allowWrites: boolean): Scenario {
  const pool = allowWrites ? scenariosForRole(role) : readOnlyScenariosForRole(role)
  if (pool.length === 0) {
    throw new Error(`Keine Szenarien für Rolle ${role} verfügbar`)
  }

  const totalWeight = pool.reduce((sum, scenario) => sum + scenario.weight, 0)
  const normalized = seed % totalWeight
  let acc = 0
  for (const scenario of pool) {
    acc += scenario.weight
    if (normalized < acc) return scenario
  }
  return pool[pool.length - 1]
}
