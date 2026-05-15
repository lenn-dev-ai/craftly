// Reparo Lasttest mit 100 simulierten parallelen Usern.
//
// Zweck: Race-Conditions, Trigger-Throughput, Dead-Locks und reine
// Latenz unter Last aufdecken — bisher liefen Tests sequenziell.
//
// Szenarien:
//   A) 100 Auktions-Bids parallel auf dasselbe Ticket
//      → Zeigt: Wer gewinnt? Race in onConflict-upsert? Smart-Score-
//        Recompute korrekt?
//   B) 50 Verwalter starten gleichzeitig 50 Auktionen
//      → Trigger-Throughput, Index-Performance
//   C) 50 Auktionen × je 5 Bids → 250 parallele Inserts
//      → reScoreTicket-Logik unter Last
//
// Lauf:
//   bash -c 'source tests/e2e/load-env.sh > /dev/null && npx tsx tests/security/load-100-users.ts'

import { createClient } from "@supabase/supabase-js"
import { adminClient } from "../e2e/helpers/supabase-admin"

interface ScenarioResult {
  name: string
  totalMs: number
  successCount: number
  errorCount: number
  errors: string[]
  details?: Record<string, unknown>
}

const results: ScenarioResult[] = []

function record(r: ScenarioResult) {
  results.push(r)
  console.log(`\n  Tests: ${r.successCount + r.errorCount}, OK ${r.successCount}, FAIL ${r.errorCount}, Zeit ${r.totalMs}ms`)
  if (r.errors.length > 0) {
    console.log(`  Fehler-Sample:`)
    for (const e of r.errors.slice(0, 3)) console.log(`    - ${e.slice(0, 200)}`)
  }
  if (r.details) {
    for (const [k, v] of Object.entries(r.details)) console.log(`  ${k}: ${JSON.stringify(v)}`)
  }
}

// User-Pool generieren (idempotent — vorhandene User wiederverwenden)
async function ensureLoadUsers(count: number): Promise<{ id: string; email: string; password: string }[]> {
  const admin = adminClient()
  const password = "LoadTest2026!"
  const users: { id: string; email: string; password: string }[] = []

  // Bestehende load-* User listen
  const existingMap = new Map<string, string>()
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (!data?.users.length) break
    for (const u of data.users) {
      if (u.email?.startsWith("load-hw-") || u.email?.startsWith("load-vw-")) {
        existingMap.set(u.email, u.id)
      }
    }
  }

  for (let i = 0; i < count; i++) {
    const role = i < count / 2 ? "hw" : "vw"
    const email = `load-${role}-${i}@reparo-load.local`
    let userId = existingMap.get(email)
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      })
      if (error || !data.user) throw new Error(`User-Create ${email}: ${error?.message}`)
      userId = data.user.id
    } else {
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true })
    }
    users.push({ id: userId, email, password })
  }

  // Profile sicherstellen — Verwalter + Handwerker
  for (let i = 0; i < users.length; i++) {
    const isHw = i < count / 2
    await admin.from("profiles").upsert(
      isHw ? {
        id: users[i].id,
        name: `LoadHW${i}`,
        rolle: "handwerker",
        email: users[i].email,
        gewerk: "sanitaer",
        startort_lat: 52.52 + Math.random() * 0.01,
        startort_lng: 13.40 + Math.random() * 0.01,
        radius_km: 50,
        bewertung_avg: 4.0 + Math.random(),
        angebotstreue: 100,
      } : {
        id: users[i].id,
        name: `LoadVW${i}`,
        rolle: "verwalter",
        email: users[i].email,
      },
      { onConflict: "id" },
    )
  }
  return users
}

type LoadClient = ReturnType<typeof createClient>

async function loginAll(users: { email: string; password: string }[]): Promise<LoadClient[]> {
  const url = process.env.E2E_SUPABASE_URL!
  const anon = process.env.E2E_SUPABASE_ANON_KEY!
  const clients: LoadClient[] = []
  for (const u of users) {
    const c = createClient(url, anon, { auth: { persistSession: false } })
    const { error } = await c.auth.signInWithPassword({ email: u.email, password: u.password })
    if (error) throw new Error(`Login ${u.email}: ${error.message}`)
    clients.push(c)
  }
  return clients
}

// ======================================================================
// Szenario A: 50 HW bieten parallel auf dasselbe Auktions-Ticket
// ======================================================================
async function scenarioA(hwUsers: { id: string; email: string; password: string }[]): Promise<void> {
  console.log("\n— Szenario A: 50 HW bieten parallel auf dasselbe Ticket —")
  const admin = adminClient()
  const url = process.env.E2E_SUPABASE_URL!

  // Verwalter-Session-Owner anlegen (ein verwalter user reicht — admin-rolle würde RLS umgehen)
  const verwalterId = hwUsers[0].id // wir hijacken den ersten HW als ticket-owner via service-role (egal welcher)

  // Auktions-Ticket mit weit in der Zukunft liegendem Ende
  const { data: ticket } = await admin.from("tickets").insert({
    titel: "Load-A: 50 paralleler Bids",
    gewerk: "sanitaer",
    erstellt_von: verwalterId,
    verwalter_id: verwalterId,
    einsatzort_lat: 52.52,
    einsatzort_lng: 13.405,
    status: "auktion",
    auktion_start: new Date().toISOString(),
    auktion_ende: new Date(Date.now() + 3600_000).toISOString(),
    surge_faktor: 1.0,
    dringlichkeit: "zeitnah",
  }).select("id").single<{ id: string }>()

  if (!ticket) throw new Error("Setup-Ticket A fail")

  // 50 HW-Sessions
  const hwSubset = hwUsers.slice(1, 51)  // skip Index 0 (= verwalter-stand-in)
  const clients = await loginAll(hwSubset)

  const start = Date.now()
  const errors: string[] = []
  let success = 0

  const promises = clients.map(async (c, i) => {
    try {
      // Direkt-Insert via Supabase (nicht über /api/auction/bid weil das einzelne API
      // Aufrufe wären — wir simulieren reine DB-Last)
      const { error } = await c.from("angebote").upsert(
        {
          ticket_id: ticket.id,
          handwerker_id: hwSubset[i].id,
          preis: 100 + Math.floor(Math.random() * 50),
          status: "eingereicht",
        },
        { onConflict: "ticket_id,handwerker_id" },
      )
      if (error) {
        errors.push(`HW ${i}: ${error.message}`)
      } else {
        success++
      }
    } catch (e) {
      errors.push(`HW ${i}: ${(e as Error).message}`)
    }
  })

  await Promise.all(promises)
  const totalMs = Date.now() - start

  // Sanity-Check: wieviele Bids in der DB
  const { data: bids, count } = await admin
    .from("angebote")
    .select("id, preis", { count: "exact", head: false })
    .eq("ticket_id", ticket.id)

  // Cleanup
  await admin.from("angebote").delete().eq("ticket_id", ticket.id)
  await admin.from("tickets").delete().eq("id", ticket.id)

  record({
    name: "A: 50 parallele Bids auf 1 Ticket",
    totalMs, successCount: success, errorCount: errors.length, errors,
    details: { bidsInDb: count ?? 0, expected: 50, throughputPerSec: Math.round(success / (totalMs / 1000)) },
  })
}

// ======================================================================
// Szenario B: 50 Verwalter erstellen parallel je 1 Ticket
// ======================================================================
async function scenarioB(vwUsers: { id: string; email: string; password: string }[]): Promise<void> {
  console.log("\n— Szenario B: 50 Verwalter erstellen parallel je 1 Ticket —")
  const admin = adminClient()
  const subset = vwUsers.slice(0, 50)
  const clients = await loginAll(subset)

  const start = Date.now()
  const errors: string[] = []
  let success = 0
  const ticketIds: string[] = []

  const promises = clients.map(async (c, i) => {
    try {
      const { data, error } = await c.from("tickets").insert({
        titel: `Load-B-${i}`,
        gewerk: "sanitaer",
        erstellt_von: subset[i].id,
        verwalter_id: subset[i].id,
        einsatzort_lat: 52.52,
        einsatzort_lng: 13.405,
        status: "offen",
      }).select("id").single<{ id: string }>()
      if (error) errors.push(`VW ${i}: ${error.message}`)
      else { success++; ticketIds.push(data.id) }
    } catch (e) {
      errors.push(`VW ${i}: ${(e as Error).message}`)
    }
  })

  await Promise.all(promises)
  const totalMs = Date.now() - start

  // Cleanup
  if (ticketIds.length > 0) await admin.from("tickets").delete().in("id", ticketIds)

  record({
    name: "B: 50 Verwalter erstellen parallel Tickets",
    totalMs, successCount: success, errorCount: errors.length, errors,
    details: { throughputPerSec: Math.round(success / (totalMs / 1000)) },
  })
}

// ======================================================================
// Szenario C: 10 parallele Auktionen × 10 Bids = 100 parallele Bids verteilt
// ======================================================================
async function scenarioC(hwUsers: { id: string; email: string; password: string }[], vwUsers: { id: string; email: string; password: string }[]) {
  console.log("\n— Szenario C: 10 Auktionen × 10 Bids parallel verteilt —")
  const admin = adminClient()

  // 10 Auktions-Tickets vom Verwalter (service-role)
  const ticketIds: string[] = []
  for (let i = 0; i < 10; i++) {
    const { data } = await admin.from("tickets").insert({
      titel: `Load-C-Auktion-${i}`,
      gewerk: "sanitaer",
      erstellt_von: vwUsers[i].id,
      verwalter_id: vwUsers[i].id,
      einsatzort_lat: 52.52,
      einsatzort_lng: 13.405,
      status: "auktion",
      auktion_start: new Date().toISOString(),
      auktion_ende: new Date(Date.now() + 3600_000).toISOString(),
    }).select("id").single<{ id: string }>()
    if (data) ticketIds.push(data.id)
  }

  // 10 HW-Sessions, jeder bietet auf 10 Tickets
  const hwSubset = hwUsers.slice(0, 10)
  const clients = await loginAll(hwSubset)

  const start = Date.now()
  const errors: string[] = []
  let success = 0

  const promises: Promise<void>[] = []
  for (let h = 0; h < clients.length; h++) {
    for (let t = 0; t < ticketIds.length; t++) {
      promises.push((async () => {
        try {
          const { error } = await clients[h].from("angebote").upsert(
            {
              ticket_id: ticketIds[t],
              handwerker_id: hwSubset[h].id,
              preis: 80 + Math.floor(Math.random() * 100),
              status: "eingereicht",
            },
            { onConflict: "ticket_id,handwerker_id" },
          )
          if (error) errors.push(`HW${h}/T${t}: ${error.message}`)
          else success++
        } catch (e) {
          errors.push(`HW${h}/T${t}: ${(e as Error).message}`)
        }
      })())
    }
  }

  await Promise.all(promises)
  const totalMs = Date.now() - start

  // DB-Sanity
  const { count } = await admin.from("angebote").select("id", { count: "exact", head: true }).in("ticket_id", ticketIds)

  // Cleanup
  await admin.from("angebote").delete().in("ticket_id", ticketIds)
  await admin.from("tickets").delete().in("id", ticketIds)

  record({
    name: "C: 100 parallele Bids verteilt (10×10)",
    totalMs, successCount: success, errorCount: errors.length, errors,
    details: { bidsInDb: count ?? 0, expected: 100, throughputPerSec: Math.round(success / (totalMs / 1000)) },
  })
}

// ======================================================================
async function main() {
  console.log("=".repeat(70))
  console.log("Reparo Lasttest — 100 simulierte User parallel")
  console.log("=".repeat(70))

  console.log("\n[Setup] Erstelle/aktualisiere 100 Load-Test-User...")
  const users = await ensureLoadUsers(100)
  const hwUsers = users.slice(0, 50)
  const vwUsers = users.slice(50)
  console.log(`  ${hwUsers.length} HW + ${vwUsers.length} VW bereit\n`)

  await scenarioA(hwUsers)
  await scenarioB(vwUsers)
  await scenarioC(hwUsers, vwUsers)

  console.log("\n" + "=".repeat(70))
  console.log("Zusammenfassung")
  console.log("=".repeat(70))
  let totalErrors = 0
  for (const r of results) {
    const status = r.errorCount === 0 ? "✅" : "🔴"
    console.log(`  ${status} ${r.name}: ${r.successCount}/${r.successCount + r.errorCount} OK · ${r.totalMs}ms`)
    totalErrors += r.errorCount
  }
  process.exit(totalErrors > 0 ? 1 : 0)
}

main().catch(err => {
  console.error("\nLast-Test abgebrochen:", err)
  process.exit(2)
})
