export type Rolle = "verwalter" | "handwerker" | "mieter" | "admin"
export type TicketStatus = "offen" | "auktion" | "vergeben" | "in_bearbeitung" | "in_arbeit" | "erledigt"
export type Prioritaet = "normal" | "hoch" | "dringend"
export type AngebotStatus = "eingereicht" | "angenommen" | "abgelehnt"
export type EinladungStatus = "offen" | "angebot" | "abgelehnt"


export type Gewerk = "sanitaer" | "elektro" | "heizung" | "maler" | "schreiner" | "dachdecker" | "schlosser" | "allgemein"


export const GEWERK_LABELS: Record<string, string> = {
  sanitaer: "Sanitär",
  elektro: "Elektro",
  heizung: "Heizung",
  maler: "Maler",
  schreiner: "Schreiner",
  dachdecker: "Dachdecker",
  schlosser: "Schlosser",
  allgemein: "Allgemein",
}


export interface UserProfile {
  id: string
  email: string
  name: string
  rolle: Rolle
  telefon?: string
  firma?: string
  gewerk?: string
  plz_bereich?: string
  basis_preis?: number
  bewertung_avg?: number
  auftraege_anzahl?: number
  created_at: string
}


export interface Objekt {
  id: string
