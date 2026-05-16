import { adminClient } from "../e2e/helpers/supabase-admin"
import type { Persona } from "./personas"

export interface SimulationAccountResult {
  id: string
  email: string
  password: string
}

type PersonaSeed = Persona & { rolle: Persona["rolle"] }

function buildMetadata(persona: Persona): Record<string, string> {
  const meta: Record<string, string> = {
    name: persona.name,
    rolle: persona.rolle,
  }
  if (persona.firma) meta.firma = persona.firma
  if (persona.gewerk) meta.gewerk = persona.gewerk
  if (persona.bezirk) meta.bezirk = persona.bezirk
  if (persona.adresse && persona.rolle === "handwerker") {
    meta.startort_adresse = persona.adresse
  }
  return meta
}

async function findUserByEmail(email: string): Promise<string | null> {
  const admin = adminClient()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`auth.admin.listUsers fehlgeschlagen: ${error.message}`)
    const found = data.users.find(user => user.email === email)
    if (found) return found.id
    if (!data.users.length) break
  }
  return null
}

async function upsertProfile(persona: PersonaSeed, userId: string): Promise<void> {
  const admin = adminClient()
  const payload: Record<string, unknown> = {
    id: userId,
    name: persona.name,
    email: persona.email,
    rolle: persona.rolle,
  }
  if (persona.firma) payload.firma = persona.firma
  if (persona.gewerk) payload.gewerk = persona.gewerk
  if (persona.bezirk) payload.plz_bereich = persona.bezirk
  if (persona.rolle === "handwerker") {
    payload.radius_km = 25
    payload.bewertung_avg = persona.verhalten === "power_user" ? 4.8 : 4.2
    payload.angebotstreue = 100
    if (persona.adresse) payload.startort_adresse = persona.adresse
  }

  const { error } = await admin.from("profiles").upsert(payload, { onConflict: "id" })
  if (error) throw new Error(`Profile-Upsert fehlgeschlagen für ${persona.email}: ${error.message}`)
}

export async function ensureSimulationAccounts(personas: Persona[], allowWrites: boolean): Promise<SimulationAccountResult[]> {
  if (!allowWrites) {
    throw new Error("SIM_SEED_ACCOUNTS erfordert ALLOW_WRITES=true")
  }

  const admin = adminClient()
  const seeded: SimulationAccountResult[] = []

  for (const persona of personas) {
    const existingId = await findUserByEmail(persona.email)
    if (existingId) {
      const { error } = await admin.auth.admin.updateUserById(existingId, {
        password: persona.passwort,
        email_confirm: true,
        user_metadata: buildMetadata(persona),
      })
      if (error) throw new Error(`User-Update fehlgeschlagen für ${persona.email}: ${error.message}`)
      await upsertProfile(persona, existingId)
      seeded.push({ id: existingId, email: persona.email, password: persona.passwort })
      continue
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: persona.email,
      password: persona.passwort,
      email_confirm: true,
      user_metadata: buildMetadata(persona),
    })
    if (error || !data.user) {
      throw new Error(`User-Erstellung fehlgeschlagen für ${persona.email}: ${error?.message}`)
    }
    await upsertProfile(persona, data.user.id)
    seeded.push({ id: data.user.id, email: persona.email, password: persona.passwort })
  }

  return seeded
}
