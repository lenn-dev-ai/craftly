// Pen-Test für FIX-8: storage.objects-RLS auf bucket schadens-fotos
//
// Nach der Migration 20260521000000_storage_fotos_strict.sql sollten
// Fotos NUR sichtbar sein für:
//   - Owner (Hochlader, foldername-prefix = auth.uid())
//   - Admin
//   - Ticket-Beteiligte (erstellt_von, verwalter_id, zugewiesener_hw)
//
// Lauf:
//   bash -c 'source tests/e2e/load-env.sh > /dev/null && npx tsx tests/security/storage-pen-test.ts'

import { createClient as createSb } from "@supabase/supabase-js"
import { adminClient } from "../e2e/helpers/supabase-admin"
import { seedTestUsers } from "../e2e/helpers/seed"

interface Result { name: string; expected: "visible" | "blocked"; actual: "visible" | "blocked"; ok: boolean }
const results: Result[] = []

function record(name: string, expected: Result["expected"], actual: Result["actual"]) {
  const ok = expected === actual
  results.push({ name, expected, actual, ok })
  console.log(`  ${ok ? "✅" : "🔴"} ${name}: erwartet=${expected}, war=${actual}`)
}

async function asUser(email: string, password: string) {
  const url = process.env.E2E_SUPABASE_URL!
  const anon = process.env.E2E_SUPABASE_ANON_KEY!
  const sb = createSb(url, anon, { auth: { persistSession: false } })
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Login ${email}: ${error.message}`)
  return sb
}

// Test über storage.objects.list — wenn der Pfad sichtbar, kommt das Objekt
// in der Liste. Andernfalls leer (RLS filtert).
async function canSeeFoto(sb: ReturnType<typeof createSb>, prefix: string, filename: string): Promise<boolean> {
  const { data, error } = await sb.storage.from("schadens-fotos").list(prefix, { limit: 100 })
  if (error) return false
  return (data ?? []).some(o => o.name === filename)
}

async function main() {
  console.log("=".repeat(70))
  console.log("Storage-RLS Pen-Test — schadens-fotos (FIX-8)")
  console.log("=".repeat(70))

  console.log("\n[Setup] Seeding test users + uploading test foto...")
  const seed = await seedTestUsers()
  const admin = adminClient()

  // Foto-Pfad: "{mieterId}/test-foto.png" — Convention aus uploadSchadensFoto
  const filename = `pen-${Date.now()}.png`
  const path = `${seed.mieter.id}/${filename}`

  // 1. Service-Role: Foto in den Bucket einfügen (1×1 PNG)
  const onePxPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  )
  const { error: uploadErr } = await admin.storage
    .from("schadens-fotos")
    .upload(path, onePxPng, { contentType: "image/png", upsert: true })
  if (uploadErr) {
    console.error("Upload-Fehler:", uploadErr)
    process.exit(2)
  }

  // 2. Ticket anlegen, das auf das Foto verweist:
  //    erstellt_von = mieter, verwalter_id = verwalter, zugewiesener_hw = hwDiagnose
  const { data: ticket, error: tErr } = await admin.from("tickets").insert({
    titel: "Pen-Test Storage",
    erstellt_von: seed.mieter.id,
    verwalter_id: seed.verwalter.id,
    zugewiesener_hw: seed.hwDiagnose.id,
    status: "in_bearbeitung",
    foto_url: path,
  }).select("id").single<{ id: string }>()
  if (tErr || !ticket) {
    console.error("Ticket-Insert:", tErr)
    process.exit(2)
  }
  console.log(`  Foto-Pfad: ${path}`)
  console.log(`  Ticket: ${ticket.id} (mieter→verwalter→hwDiagnose)\n`)

  // === Tests ===
  console.log("— Sichtbarkeit pro Rolle —")

  // Mieter (Owner + erstellt_von) → sichtbar
  const sbMieter = await asUser(seed.mieter.email, seed.mieter.password)
  record(
    "Mieter (Owner + erstellt_von)",
    "visible",
    (await canSeeFoto(sbMieter, seed.mieter.id, filename)) ? "visible" : "blocked",
  )

  // Verwalter (verwalter_id) → sichtbar
  const sbVerwalter = await asUser(seed.verwalter.email, seed.verwalter.password)
  record(
    "Verwalter (verwalter_id)",
    "visible",
    (await canSeeFoto(sbVerwalter, seed.mieter.id, filename)) ? "visible" : "blocked",
  )

  // HW Diagnose (zugewiesener_hw) → sichtbar
  const sbHwOwn = await asUser(seed.hwDiagnose.email, seed.hwDiagnose.password)
  record(
    "Handwerker (zugewiesener_hw)",
    "visible",
    (await canSeeFoto(sbHwOwn, seed.mieter.id, filename)) ? "visible" : "blocked",
  )

  // FREMDER HW (Konkurrent, nicht beteiligt) → blocked
  const sbHwOther = await asUser(seed.hwKonkurrent.email, seed.hwKonkurrent.password)
  record(
    "Fremder HW (nicht beteiligt)",
    "blocked",
    (await canSeeFoto(sbHwOther, seed.mieter.id, filename)) ? "visible" : "blocked",
  )

  // Cleanup
  await admin.from("tickets").delete().eq("id", ticket.id)
  await admin.storage.from("schadens-fotos").remove([path])

  // Report
  console.log("\n" + "=".repeat(70))
  const failed = results.filter(r => !r.ok).length
  console.log(`Tests: ${results.length} insgesamt`)
  console.log(`  ✅ erwartungsgemäß: ${results.length - failed}`)
  console.log(`  🔴 abweichend:      ${failed}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error("Pen-Test abgebrochen:", err)
  process.exit(2)
})
