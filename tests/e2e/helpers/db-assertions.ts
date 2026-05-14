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
