export type Rolle = "verwalter" | "handwerker" | "mieter" | "admin"
export type TicketStatus = "offen" | "auktion" | "in_bearbeitung" | "erledigt"
export type Prioritaet = "normal" | "hoch" | "dringend"
export type AngebotStatus = "eingereicht" | "angenommen" | "abgelehnt"
export type EinladungStatus = "offen" | "angebot" | "abgelehnt"
export type ZeitslotStatus = "verfuegbar" | "reserviert" | "vergeben" | "abgelaufen"
export type GebotStatus = "offen" | "angenommen" | "abgelehnt" | "abgelaufen"

export type Gewerk =
  | "sanitaer" | "elektro" | "heizung" | "maler"
  | "schreiner" | "dachdecker" | "schlosser" | "allgemein"

export const GEWERK_LABELS: Record<string, string> = {
  sanitaer: "Sanitär",
  sanitaer_heizung: "Sanitär & Heizung",
  heizung_sanitaer: "Sanitär & Heizung",
  elektro: "Elektro",
  elektrik: "Elektro",
  heizung: "Heizung",
  maler: "Maler",
  schreiner: "Schreiner",
  tischler: "Schreiner",
  dachdecker: "Dachdecker",
  schlosser: "Schlosser",
  klempner: "Klempner",
  bodenleger: "Bodenleger",
  schimmel_sanierer: "Schimmel-Sanierer",
  allgemein: "Allgemein",
}

export function formatGewerk(gewerk: string | null | undefined): string {
  if (!gewerk) return "Allgemein"
  const key = gewerk
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
  return GEWERK_LABELS[key] ?? gewerk
}

export interface UserProfile {
  id: string; email: string; name: string; rolle: Rolle
  telefon?: string; firma?: string; gewerk?: string; plz_bereich?: string
  basis_preis?: number; bewertung_avg?: number; auftraege_anzahl?: number
  adresse?: string; lat?: number; lng?: number; radius_km?: number
  // Route-Optimierung
  basis_stundensatz?: number; mindest_stundensatz?: number; fahrtkosten_pro_km?: number
  startort_adresse?: string; startort_lat?: number; startort_lng?: number
  // Provisions-Modell
  early_adopter_bis?: string | null
  // Sichtbarkeit + Gamification (V1-Cron)
  sichtbarkeit_stufe?: "gold" | "silber" | "bronze" | null
  verfuegbarkeit_score?: number | null
  angebotstreue?: number | null
  created_at: string
}

export interface Objekt {
  id: string; name: string; adresse: string; plz: string
  verwalter_id: string; einheiten_anzahl?: number
  lat?: number; lng?: number
  created_at: string
}

export interface Ticket {
  id: string; titel: string; beschreibung?: string; foto_url?: string
  status: TicketStatus; prioritaet: Prioritaet
  vergabemodus: "direkt" | "auktion"; gewerk?: string
  objekt_id?: string; wohnung?: string; raum?: string
  erstellt_von: string; zugewiesener_hw?: string
  verwalter_id?: string | null
  auktion_ende?: string; kosten_final?: number; created_at: string
  einsatzort_adresse?: string; einsatzort_lat?: number; einsatzort_lng?: number
  objekt?: Objekt; objekte?: Objekt; ersteller?: UserProfile
  handwerker?: UserProfile; angebote?: Angebot[]
  einladungen?: Einladung[]; nachrichten?: Nachricht[]
  // Diagnose → Projekt (Phase 1+2)
  ticket_typ?: "standard" | "diagnose" | "projekt"
  diagnose_ticket_id?: string | null
  befund_text?: string | null
  befund_fotos?: string[] | null
  befund_aufwand_stunden?: number | null
  projekt_angebot?: number | null
  leistungsumfang?: string[] | null
  vorkaufsrecht_bis?: string | null
  preiskorridor_min?: number | null
  preiskorridor_max?: number | null
  diagnosegebuehr_angerechnet?: boolean | null
  surge_faktor?: number | null
}

export interface Angebot {
  id: string; ticket_id: string; handwerker_id: string
  preis: number; fruehester_termin?: string; nachricht?: string
  status: AngebotStatus; created_at: string; handwerker?: UserProfile
  // Route-Daten (berechnet beim Einreichen)
  routen_score?: number; fahrzeit_minuten?: number
  fahrzeit_delta_minuten?: number; effektiv_preis?: number
  // Auction-Engine: gepflegt von lib/auction/scoring-pipeline.ts
  smart_score?: number | null
  entfernung_km?: number | null
  fahrzeit_min?: number | null
  ist_routen_bonus?: boolean | null
}

export interface Einladung {
  id: string; ticket_id: string; handwerker_id: string
  status: EinladungStatus; empfohlener_preis: number
  created_at: string; handwerker?: UserProfile; ticket?: Ticket
}

export interface Nachricht {
  id: string; ticket_id: string; absender_id: string
  text: string; created_at: string; absender?: UserProfile
}

export interface Bewertung {
  id: string; ticket_id: string; handwerker_id: string
  bewerter_id: string; sterne: number; kommentar?: string; created_at: string
}

export type NachtragStufe = "bagatell" | "wesentlich" | "erheblich"
export type NachtragStatus = "offen" | "genehmigt" | "abgelehnt"

export interface Nachtrag {
  id: string
  ticket_id: string
  handwerker_id: string
  ursprungspreis: number
  nachtrag_betrag: number
  aufpreis_prozent: number
  stufe: NachtragStufe
  begruendung: string
  fotos: string[]
  status: NachtragStatus
  genehmigt_von?: string | null
  genehmigt_am?: string | null
  created_at: string
}

export const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const

export interface Verfuegbarkeit {
  id: string; handwerker_id: string; wochentag: number
  von: string; bis: string; aktiv: boolean; created_at: string
}

export interface Termin {
  id: string; handwerker_id: string; ticket_id?: string
  titel: string; datum: string; von: string; bis: string
  notizen?: string; google_event_id?: string; created_at: string
  einsatzort_adresse?: string; einsatzort_lat?: number; einsatzort_lng?: number
  ticket?: Ticket
}

export interface PrivatTermin {
  id: string; handwerker_id: string
  datum: string; von: string; bis: string
  adresse?: string; lat?: number; lng?: number
  bezeichnung?: string; created_at: string
}

/* ============ YIELD MANAGEMENT TYPES ============ */

export interface Zeitslot {
  id: string
  handwerker_id: string
  titel: string
  gewerk?: string
  datum: string
  von: string
  bis: string
  stunden: number
  basis_preis_stunde: number
  dynamischer_preis?: number
  preisfaktor: number
  status: ZeitslotStatus
  ist_luecke: boolean
  notizen?: string
  created_at: string
  handwerker?: UserProfile
  gebote?: ZeitslotGebot[]
}

export interface ZeitslotGebot {
  id: string
  zeitslot_id: string
  verwalter_id: string
  ticket_id?: string
  gebotener_preis: number
  wunsch_stunden?: number
  nachricht?: string
  status: GebotStatus
  created_at: string
  verwalter?: UserProfile
  zeitslot?: Zeitslot
  ticket?: Ticket
}

export interface HandwerkerStats {
  handwerker_id: string
  woche_einnahmen: number
  monat_einnahmen: number
  gesamt_einnahmen: number
  slots_diese_woche: number
  slots_naechste_woche: number
  auslastung_prozent: number
  durchschnitt_stundensatz: number
  updated_at: string
}
