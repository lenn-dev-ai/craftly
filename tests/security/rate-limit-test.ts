// Verifiziert die /api/ki/schadenserkennung Rate-Limit-Funktion via
// direkten RPC-Call auf try_consume_ki_quota — wir brauchen das echte
// API-Endpoint nicht zu fluten (würde Anthropic-Calls auslösen).
//
// Lauf:
//   bash -c 'source tests/e2e/load-env.sh > /dev/null && npx tsx tests/security/rate-limit-test.ts'

import { createClient } from "@supabase/supabase-js"
import { adminClient } from "../e2e/helpers/supabase-admin"
import { seedTestUsers } from "../e2e/helpers/seed"

async function main() {
  console.log("=".repeat(70))
  console.log("Rate-Limit-Test: try_consume_ki_quota (10/Tag)")
  console.log("=".repeat(70))

  const seed = await seedTestUsers()
  const admin = adminClient()

  // Quota für Test-Mieter zurücksetzen
  await admin.from("ki_quota").delete().eq("user_id", seed.mieter.id)

  // Mieter-Session
  const url = process.env.E2E_SUPABASE_URL!
  const anon = process.env.E2E_SUPABASE_ANON_KEY!
  const sb = createClient(url, anon, { auth: { persistSession: false } })
  await sb.auth.signInWithPassword({
    email: seed.mieter.email,
    password: seed.mieter.password,
  })

  let allowedCount = 0
  let blockedCount = 0
  for (let i = 0; i < 12; i++) {
    const { data } = await sb
      .rpc("try_consume_ki_quota", { _max_per_day: 10 })
      .single<{ allowed: boolean; remaining: number; reset_at: string }>()
    if (data?.allowed) {
      allowedCount++
      console.log(`  Call ${i + 1}: ✓ allowed, remaining=${data.remaining}`)
    } else {
      blockedCount++
      console.log(`  Call ${i + 1}: ✗ blocked, reset=${data?.reset_at}`)
    }
  }

  console.log()
  console.log("Erwartung: 10 allowed, 2 blocked")
  console.log(`Tatsächlich: ${allowedCount} allowed, ${blockedCount} blocked`)

  const ok = allowedCount === 10 && blockedCount === 2
  if (!ok) {
    console.log("🔴 FEHLGESCHLAGEN")
    process.exit(1)
  }
  console.log("✅ Rate-Limit funktioniert wie erwartet")

  // Aufräumen
  await admin.from("ki_quota").delete().eq("user_id", seed.mieter.id)
  process.exit(0)
}

main().catch(err => {
  console.error("Rate-Limit-Test abgebrochen:", err)
  process.exit(2)
})
