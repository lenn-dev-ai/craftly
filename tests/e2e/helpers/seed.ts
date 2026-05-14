import { adminClient } from "./supabase-admin"

// Test-User + Fixtures für E2E-Tests.
//
// Deterministische Credentials — werden vor jedem Test-Run frisch
// angelegt. Passwords sind bewusst trivial, weil die DB lokal-isoliert
// läuft und niemals Prod-Daten enthält.
//
// Wichtig: Diese Datei darf nur lokal/CI gegen eine TEST-DB laufen.
// E2E_SUPABASE_URL gegen Prod richten ist ein Sicherheits-Vorfall.

export const TEST_USERS = {
  mieter: {
    email: "mieter@reparo.test",
    password: "TestMieter2026!",
    name: "Maxi Mieter",
    rolle: "mieter" as const,
  },
  hw_diagnose: {
    email: "hw-diagnose@reparo.test",
    password: "TestHwDiag2026!",
    name: "Diana Diagnose",
    firma: "Diagnose-Sanitär GmbH",
    rolle: "handwerker" as const,
    gewerk: "sanitaer",
    lat: 52.52,
    lng: 13.405,
    radius_km: 30,
    basis_stundensatz: 70,
  },
  hw_konkurrent: {
    email: "hw-konkurrent@reparo.test",
    password: "TestHwKonk2026!",
    name: "Konrad Konkurrent",
    firma: "Mitbewerber Sanitär",
    rolle: "handwerker" as const,
    gewerk: "sanitaer",
    lat: 52.515,
    lng: 13.41,
    radius_km: 30,
    basis_stundensatz: 65,
  },
  verwalter: {
    email: "verwalter@reparo.test",
    password: "TestVerwalt2026!",
    name: "Vera Verwalter",
    rolle: "verwalter" as const,
  },
}

export const TEST_OBJEKT = {
  bezeichnung: "Teststraße 1 Berlin",
  adresse: "Teststraße 1, 10115 Berlin",
  lat: 52.53,
  lng: 13.4,
}

interface SeededUser {
  id: string
  email: string
  password: string
}

interface SeedResult {
  mieter: SeededUser
  hwDiagnose: SeededUser
  hwKonkurrent: SeededUser
  verwalter: SeededUser
  objektId: string
}

async function createOrFindUser(spec: typeof TEST_USERS.mieter | typeof TEST_USERS.hw_diagnose | typeof TEST_USERS.verwalter): Promise<string> {
  const admin = adminClient()
  // Existiert User bereits? Wenn ja: löschen, neu erstellen (sauberer State).
  // listUsers liefert paginiert — für Tests reicht erste Page.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const existing = list?.users.find(u => u.email === spec.email)
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id)
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: spec.email,
    password: spec.password,
    email_confirm: true,
    user_metadata: { name: spec.name },
  })
  if (createErr || !created.user) {
    throw new Error(`User-Erstellung fehlgeschlagen für ${spec.email}: ${createErr?.message}`)
  }
  return created.user.id
}

async function upsertProfile(userId: string, profile: Record<string, unknown>): Promise<void> {
  const admin = adminClient()
  const { error } = await admin
    .from("profiles")
    .upsert({ id: userId, ...profile }, { onConflict: "id" })
  if (error) throw new Error(`Profile-Upsert fehlgeschlagen für ${userId}: ${error.message}`)
}

export async function resetTestDaten(userIds: string[]): Promise<void> {
  const admin = adminClient()
  // Reihenfolge folgt den Foreign-Key-Abhängigkeiten
  // Lösche alles was auf Test-User zeigt — andere User bleiben unberührt.
  await admin.from("nachtraege").delete().in("handwerker_id", userIds)
  await admin.from("provisionen").delete().in("verwalter_id", userIds)
  await admin.from("provisionen").delete().in("handwerker_id", userIds)
  await admin.from("angebote").delete().in("handwerker_id", userIds)
  await admin.from("nachrichten").delete().in("absender_id", userIds)
  await admin.from("einladungen").delete().in("handwerker_id", userIds)
  await admin.from("termine").delete().in("handwerker_id", userIds)
  await admin.from("bewertungen").delete().in("handwerker_id", userIds)
  await admin.from("tickets").delete().in("erstellt_von", userIds)
  await admin.from("tickets").delete().in("zugewiesener_hw", userIds)
  await admin.from("objekte").delete().in("verwalter_id", userIds)
}

export async function seedTestUsers(): Promise<SeedResult> {
  const admin = adminClient()

  // Phase 1: Auth-User anlegen
  const mieterId = await createOrFindUser(TEST_USERS.mieter)
  const hwDiagId = await createOrFindUser(TEST_USERS.hw_diagnose)
  const hwKonkId = await createOrFindUser(TEST_USERS.hw_konkurrent)
  const verwalterId = await createOrFindUser(TEST_USERS.verwalter)

  // Phase 2: Cleanup vorheriger Test-Tickets/Angebote für genau diese User
  await resetTestDaten([mieterId, hwDiagId, hwKonkId, verwalterId])

  // Phase 3: Profile setzen
  await upsertProfile(mieterId, {
    name: TEST_USERS.mieter.name,
    rolle: "mieter",
    email: TEST_USERS.mieter.email,
  })
  await upsertProfile(hwDiagId, {
    name: TEST_USERS.hw_diagnose.name,
    firma: TEST_USERS.hw_diagnose.firma,
    rolle: "handwerker",
    email: TEST_USERS.hw_diagnose.email,
    gewerk: TEST_USERS.hw_diagnose.gewerk,
    lat: TEST_USERS.hw_diagnose.lat,
    lng: TEST_USERS.hw_diagnose.lng,
    startort_lat: TEST_USERS.hw_diagnose.lat,
    startort_lng: TEST_USERS.hw_diagnose.lng,
    radius_km: TEST_USERS.hw_diagnose.radius_km,
    basis_stundensatz: TEST_USERS.hw_diagnose.basis_stundensatz,
    bewertung_avg: 4.5,
    angebotstreue: 100,
  })
  await upsertProfile(hwKonkId, {
    name: TEST_USERS.hw_konkurrent.name,
    firma: TEST_USERS.hw_konkurrent.firma,
    rolle: "handwerker",
    email: TEST_USERS.hw_konkurrent.email,
    gewerk: TEST_USERS.hw_konkurrent.gewerk,
    lat: TEST_USERS.hw_konkurrent.lat,
    lng: TEST_USERS.hw_konkurrent.lng,
    startort_lat: TEST_USERS.hw_konkurrent.lat,
    startort_lng: TEST_USERS.hw_konkurrent.lng,
    radius_km: TEST_USERS.hw_konkurrent.radius_km,
    basis_stundensatz: TEST_USERS.hw_konkurrent.basis_stundensatz,
    bewertung_avg: 4.0,
    angebotstreue: 100,
  })
  await upsertProfile(verwalterId, {
    name: TEST_USERS.verwalter.name,
    rolle: "verwalter",
    email: TEST_USERS.verwalter.email,
  })

  // Phase 4: Verwalter-Objekt anlegen
  const { data: objekt, error: objErr } = await admin
    .from("objekte")
    .insert({
      verwalter_id: verwalterId,
      bezeichnung: TEST_OBJEKT.bezeichnung,
      adresse: TEST_OBJEKT.adresse,
      lat: TEST_OBJEKT.lat,
      lng: TEST_OBJEKT.lng,
    })
    .select("id")
    .single<{ id: string }>()
  if (objErr || !objekt) throw new Error(`Objekt anlegen fehlgeschlagen: ${objErr?.message}`)

  // Phase 5: diagnose_preise sicherstellen (Migration sollte das anlegen, aber failsafe)
  await admin.from("diagnose_preise").upsert(
    [
      { gewerk: "sanitaer", preis: 89 },
      { gewerk: "heizung", preis: 89 },
      { gewerk: "elektro", preis: 79 },
      { gewerk: "allgemein", preis: 59 },
    ],
    { onConflict: "gewerk" },
  )

  return {
    mieter: { id: mieterId, email: TEST_USERS.mieter.email, password: TEST_USERS.mieter.password },
    hwDiagnose: { id: hwDiagId, email: TEST_USERS.hw_diagnose.email, password: TEST_USERS.hw_diagnose.password },
    hwKonkurrent: { id: hwKonkId, email: TEST_USERS.hw_konkurrent.email, password: TEST_USERS.hw_konkurrent.password },
    verwalter: { id: verwalterId, email: TEST_USERS.verwalter.email, password: TEST_USERS.verwalter.password },
    objektId: objekt.id,
  }
}
