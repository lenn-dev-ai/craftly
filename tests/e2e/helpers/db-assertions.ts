import { expect } from "@playwright/test"
import { adminClient } from "./supabase-admin"

// Direkt-DB-Assertions für E2E-Tests. Service-Role-Client umgeht RLS,
// damit der Test sicher liest was wirklich in der DB steht — unabhängig
// von der UI-Anzeige.

export async function getTicket(id: string) {
  const admin = adminClient()
  const { data, error } = await admin.from("tickets").select("*").eq("id", id).single()
  if (error) throw new Error(`getTicket(${id}): ${error.message}`)
  return data
}

export async function getProvision(ticketId: string) {
  const admin = adminClient()
  const { data, error } = await admin.from("provisionen").select("*").eq("ticket_id", ticketId).single()
  if (error) throw new Error(`getProvision(${ticketId}): ${error.message}`)
  return data
}

export async function getAngebotstreue(handwerkerId: string): Promise<number> {
  const admin = adminClient()
  const { data, error } = await admin
    .from("profiles")
    .select("angebotstreue")
    .eq("id", handwerkerId)
    .single<{ angebotstreue: number }>()
  if (error) throw new Error(`getAngebotstreue(${handwerkerId}): ${error.message}`)
  return Number(data.angebotstreue)
}

export async function findProjektTicket(diagnoseTicketId: string) {
  const admin = adminClient()
  const { data, error } = await admin
    .from("tickets")
    .select("*")
    .eq("diagnose_ticket_id", diagnoseTicketId)
    .maybeSingle()
  if (error) throw new Error(`findProjektTicket(${diagnoseTicketId}): ${error.message}`)
  return data
}

export async function findDiagnoseTicketByMieter(mieterId: string, titel: string) {
  const admin = adminClient()
  const { data, error } = await admin
    .from("tickets")
    .select("*")
    .eq("erstellt_von", mieterId)
    .eq("ticket_typ", "diagnose")
    .eq("titel", titel)
    .maybeSingle()
  if (error) throw new Error(`findDiagnoseTicketByMieter: ${error.message}`)
  return data
}

export function expectClose(actual: number, expected: number, msg?: string): void {
  expect(Math.abs(actual - expected), msg ?? `expected ~${expected}, got ${actual}`).toBeLessThan(0.01)
}

// Legt direkt ein Projekt-Ticket im in_bearbeitung-Status an — für
// Nachtrags-Tests die nicht den ganzen Diagnose→Annehmen-Flow brauchen.
export async function legeProjektTicketDirekt(params: {
  erstelltVon: string
  zugewiesenerHw: string
  titel: string
  projektAngebot: number
  kostenFinal: number
  diagnoseTicketId?: string
}): Promise<string> {
  const admin = adminClient()
  const { data: ticket, error: tErr } = await admin
    .from("tickets")
    .insert({
      titel: params.titel,
      beschreibung: "E2E-Test Projekt-Ticket",
      gewerk: "sanitaer",
      prioritaet: "planbar",
      vergabemodus: "auktion",
      status: "in_bearbeitung",
      erstellt_von: params.erstelltVon,
      zugewiesener_hw: params.zugewiesenerHw,
      einsatzort_adresse: "Teststraße 1, 10115 Berlin",
      einsatzort_lat: 52.53,
      einsatzort_lng: 13.4,
      ticket_typ: "projekt",
      diagnose_ticket_id: params.diagnoseTicketId,
      projekt_angebot: params.projektAngebot,
      kosten_final: params.kostenFinal,
      diagnosegebuehr_angerechnet: !!params.diagnoseTicketId,
      surge_faktor: 1.0,
    })
    .select("id")
    .single<{ id: string }>()
  if (tErr || !ticket) throw new Error(`Projekt-Ticket-Insert: ${tErr?.message}`)

  // Provisions-Snapshot anlegen — der Nachtrag-Trigger erwartet eine
  // existierende Zeile zum Aktualisieren (keine Auto-Insert-Logik).
  const provBetrag = Math.round(params.kostenFinal * 0.05 * 100) / 100
  const { error: pErr } = await admin.from("provisionen").insert({
    ticket_id: ticket.id,
    verwalter_id: params.erstelltVon,
    handwerker_id: params.zugewiesenerHw,
    auftragswert: params.kostenFinal,
    provision_rate: 0.05,
    provision_betrag: provBetrag,
    gesamt: params.kostenFinal + provBetrag,
    is_early_adopter: false,
  })
  if (pErr) throw new Error(`Provisions-Insert: ${pErr.message}`)

  return ticket.id
}
