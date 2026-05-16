export type DamageGewerk =
  | "sanitaer"
  | "heizung"
  | "maler"
  | "elektro"
  | "schreiner"
  | "dachdecker"
  | "allgemein"

export interface DamageFixture {
  titel: string
  beschreibung: string
  gewerk: DamageGewerk
  dringlichkeit: "notfall" | "zeitnah" | "planbar"
  raum: string
  erwartete_zeit: string
  chaosLevel: 0 | 1 | 2 | 3
  mitFoto: boolean
}

export const DAMAGE_FIXTURES: DamageFixture[] = [
  {
    titel: "Wasserschaden im Bad",
    beschreibung: "Unter dem Waschbecken tropft es seit dem Morgen, die Fliese ist bereits feucht.",
    gewerk: "sanitaer",
    dringlichkeit: "notfall",
    raum: "Bad",
    erwartete_zeit: "sofort",
    chaosLevel: 3,
    mitFoto: true,
  },
  {
    titel: "Heizung ausgefallen",
    beschreibung: "In zwei Zimmern bleibt die Heizung kalt, Thermostat reagiert nur sporadisch.",
    gewerk: "heizung",
    dringlichkeit: "zeitnah",
    raum: "Wohnzimmer",
    erwartete_zeit: "24 Stunden",
    chaosLevel: 2,
    mitFoto: true,
  },
  {
    titel: "Schimmel an der Außenwand",
    beschreibung: "Dunkle Flecken hinter dem Schrank, wahrscheinlich durch Feuchtigkeit und schlechte Lüftung.",
    gewerk: "maler",
    dringlichkeit: "zeitnah",
    raum: "Schlafzimmer",
    erwartete_zeit: "2-3 Tage",
    chaosLevel: 2,
    mitFoto: true,
  },
  {
    titel: "Elektroproblem in der Küche",
    beschreibung: "Die Sicherung fliegt raus, sobald der Wasserkocher eingeschaltet wird.",
    gewerk: "elektro",
    dringlichkeit: "notfall",
    raum: "Küche",
    erwartete_zeit: "sofort",
    chaosLevel: 3,
    mitFoto: false,
  },
  {
    titel: "Fenster klemmt",
    beschreibung: "Das Fenster lässt sich nur mit Druck schließen, Zugluft ist deutlich spürbar.",
    gewerk: "schreiner",
    dringlichkeit: "planbar",
    raum: "Arbeitszimmer",
    erwartete_zeit: "1 Woche",
    chaosLevel: 1,
    mitFoto: false,
  },
  {
    titel: "Dach und Fassade prüfen",
    beschreibung: "Nach starkem Regen sind außen feuchte Stellen sichtbar, bitte Dachanschluss prüfen.",
    gewerk: "dachdecker",
    dringlichkeit: "zeitnah",
    raum: "Dachgeschoss",
    erwartete_zeit: "3-5 Tage",
    chaosLevel: 2,
    mitFoto: true,
  },
  {
    titel: "Unklarer Schaden im Flur",
    beschreibung: "Leichte Verfärbung an der Wand, Ursache noch unklar.",
    gewerk: "allgemein",
    dringlichkeit: "planbar",
    raum: "Flur",
    erwartete_zeit: "ein paar Tage",
    chaosLevel: 0,
    mitFoto: false,
  },
]

export function pickDamage(index: number): DamageFixture {
  return DAMAGE_FIXTURES[index % DAMAGE_FIXTURES.length]
}
