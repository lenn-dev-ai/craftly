export type Rolle = "verwalter" | "handwerker" | "mieter" | "admin"
export type TicketStatus = "offen" | "auktion" | "in_bearbeitung" | "erledigt"
export type Prioritaet = "normal" | "hoch" | "dringend"
export type AngebotStatus = "eingereicht" | "angenommen" | "abgelehnt"

export interface UserProfile {
  id: string
  email: string
  name: string
  rolle: Rolle
  telefon?: string
  firma?: string
  gewerk?: string
  plz_bereich?: string
  bewertung_avg?: number
  auftraege_anzahl?: number
  created_at: string
}

export interface Objekt {
  id: string
  name: string
  adresse: string
  plz: string
  verwalter_id: string
  einheiten_anzahl?: number
  created_at: string
}

export interface Ticket {
  id: string
  titel: string
  beschreibung?: string
  foto_url?: string
  status: TicketStatus
  prioritaet: Prioritaet
  vergabemodus: "direkt" | "auktion"
  objekt_id?: string
  wohnung?: string
  erstellt_von: string
  zugewiesener_hw?: string
  auktion_ende?: string
  kosten_final?: number
  created_at: string
  objekt?: Objekt
  objekte?: Objekt
  ersteller?: UserProfile
  handwerker?: UserProfile
  angebote?: Angebot[]
  nachrichten?: Nachricht[]
}

export interface Angebot {
  id: string
  ticket_id: string
  handwerker_id: string
  preis: number
  fruehester_termin?: string
  nachricht?: string
  status: AngebotStatus
  created_at: string
  handwerker?: UserProfile
}

export interface Nachricht {
  id: string
  ticket_id: string
  absender_id: string
  text: string
  created_at: string
  absender?: UserProfile
}

export interface Bewertung {
  id: string
  ticket_id: string
  handwerker_id: string
  bewerter_id: string
  sterne: number
  kommentar?: string
  created_at: string
}
