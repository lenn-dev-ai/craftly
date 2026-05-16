// Reparo Pen-Test-Skript (defensiv, lokal-only).
//
// Zweck: Aktive Angriffsvektoren gegen die App testen — RLS-Bypass,
// IDOR, Mass-Assignment, fehlende Owner-Checks. Nutzt anon-Auth-Sessions
// echter Test-User (nicht Service-Role) — das spiegelt einen echten
// Angreifer mit gültigem Account wider.
//
// Lauf:
//   bash -c 'source tests/e2e/load-env.sh > /dev/null && npx tsx tests/security/pen-tests.ts'
//
// Grünes Ergebnis: Angriff blockiert (Policy/Server-Check greift).
// Rotes Ergebnis: Angriff erfolgreich → Vulnerability.

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { adminClient } from "../e2e/helpers/supabase-admin"
import { seedTestUsers, TEST_USERS } from "../e2e/helpers/seed"

interface PenTestResult {
  name: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  vulnerable: boolean
  evidence: string
}

const results: PenTestResult[] = []

function record(name: string, severity: PenTestResult["severity"], vulnerable: boolean, evidence: string) {
  results.push({ name, severity, vulnerable, evidence })
  const icon = vulnerable ? "🔴" : "✅"
  const label = vulnerable ? `VULN ${severity}` : "blocked"
  console.log(`  ${icon} [${label}] ${name}`)
  console.log(`     ${evidence}`)
}

async function asUser(email: string, password: string) {
  const url = process.env.E2E_SUPABASE_URL!
  const anon = process.env.E2E_SUPABASE_ANON_KEY!
  const sb = createSupabaseClient(url, anon, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw new Error(`Login fail ${email}: ${error?.message}`)
  return sb
}

async function main() {
  console.log("=".repeat(70))
  console.log("Reparo Pen-Tests — Angriffe gegen lokale Supabase")
  console.log("=".repeat(70))

  // Setup: Test-User + Mieter-Ticket vorbereiten
  console.log("\n[Setup] Seeding test users + base ticket...")
  const seed = await seedTestUsers()
  const admin = adminClient()

  const sbMieter = await asUser(seed.mieter.email, seed.mieter.password)
  const sbHwOwn = await asUser(seed.hwDiagnose.email, seed.hwDiagnose.password)
  const sbHwOther = await asUser(seed.hwKonkurrent.email, seed.hwKonkurrent.password)
  const sbVerwalter = await asUser(seed.verwalter.email, seed.verwalter.password)

  // Mieter erstellt ein Ticket, Verwalter wird als verwalter_id gesetzt
  // (über das Objekt). Dann zuweisen wir hwOwn als zugewiesener_hw via
  // service-role (simuliert Auktion-Close).
  const { data: ticket, error: tErr } = await admin
    .from("tickets")
    .insert({
      titel: "Pen-Test Ticket",
      beschreibung: "Wird von Pen-Tests manipuliert",
      gewerk: "sanitaer",
      erstellt_von: seed.mieter.id,
      verwalter_id: seed.verwalter.id,
      status: "in_bearbeitung",
      zugewiesener_hw: seed.hwDiagnose.id,
      kosten_final: 200,
      surge_faktor: 1.0,
    })
    .select("id, kosten_final, zugewiesener_hw")
    .single<{ id: string; kosten_final: number; zugewiesener_hw: string }>()
  if (tErr || !ticket) throw new Error("Setup-Ticket: " + tErr?.message)

  const { data: provBase } = await admin
    .from("provisionen")
    .insert({
      ticket_id: ticket.id,
      verwalter_id: seed.verwalter.id,
      handwerker_id: seed.hwDiagnose.id,
      auftragswert: 200,
      provision_rate: 0.05,
      provision_betrag: 10,
      gesamt: 210,
    })
    .select("id, auftragswert")
    .single<{ id: string; auftragswert: number }>()

  console.log(`Setup OK: ticket ${ticket.id}, kosten_final=${ticket.kosten_final}\n`)

  // ======================================================================
  // Test 1: Mieter versucht fremdes Profil zu lesen → erlaubt (public),
  //         aber Update muss blockiert sein
  // ======================================================================
  console.log("\n— Profile-Manipulation —")
  {
    const { error } = await sbMieter.from("profiles").update({ name: "HACKED" }).eq("id", seed.hwDiagnose.id)
    const { data: check } = await admin.from("profiles").select("name").eq("id", seed.hwDiagnose.id).single<{ name: string }>()
    const vulnerable = check?.name === "HACKED"
    record(
      "Mieter updated fremdes Profil (name)",
      "HIGH", vulnerable,
      vulnerable ? `Name jetzt '${check.name}' — Policy ignoriert!` : `Profil unverändert (${check?.name}), Policy greift`,
    )
  }

  // Mieter versucht sich selbst zum Admin zu machen
  {
    const { error } = await sbMieter.from("profiles").update({ rolle: "admin" }).eq("id", seed.mieter.id)
    const { data: check } = await admin.from("profiles").select("rolle").eq("id", seed.mieter.id).single<{ rolle: string }>()
    const vulnerable = check?.rolle === "admin"
    record(
      "Mieter eskaliert eigene Rolle auf 'admin'",
      "CRITICAL", vulnerable,
      vulnerable ? `🔥 ROLLE='${check.rolle}' — Privilege-Escalation!` : `Rolle bleibt '${check?.rolle}'`,
    )
  }

  // HW fakt eigenen Stripe-Onboarding-Status
  // (würde sonst Penalty-Buchung gegen nicht existentes Konto laufen lassen)
  {
    await sbHwOwn.from("profiles").update({
      stripe_account_id: "acct_FAKE",
      stripe_charges_enabled: true,
      stripe_payouts_enabled: true,
    }).eq("id", seed.hwDiagnose.id)
    const { data: check } = await admin.from("profiles")
      .select("stripe_account_id, stripe_charges_enabled")
      .eq("id", seed.hwDiagnose.id)
      .single<{ stripe_account_id: string | null; stripe_charges_enabled: boolean }>()
    const vulnerable = check?.stripe_account_id === "acct_FAKE" || check?.stripe_charges_enabled === true
    record(
      "HW fakt eigenen Stripe-Connect-Status",
      "HIGH", vulnerable,
      vulnerable
        ? `🔥 stripe_account_id='${check?.stripe_account_id}' charges=${check?.stripe_charges_enabled} — HW kann Penalty-Buchung umgehen!`
        : `stripe_account_id=${check?.stripe_account_id ?? "null"} (protect-Trigger greift)`,
    )
  }

  // ======================================================================
  // Test 2: HW (zugewiesen) versucht kosten_final zu manipulieren
  // ======================================================================
  console.log("\n— Ticket-Felder-Manipulation (RLS column-level) —")
  {
    const { error } = await sbHwOwn.from("tickets").update({ kosten_final: 99999 }).eq("id", ticket.id)
    const { data: check } = await admin.from("tickets").select("kosten_final").eq("id", ticket.id).single<{ kosten_final: number }>()
    const vulnerable = check?.kosten_final === 99999
    record(
      "Zugewiesener HW erhöht kosten_final auf 99999",
      "CRITICAL", vulnerable,
      vulnerable ? `🔥 kosten_final=${check.kosten_final} — HW kann Auftragswert beliebig setzen!` : `kosten_final=${check?.kosten_final} unverändert`,
    )
    // Zurücksetzen
    if (vulnerable) await admin.from("tickets").update({ kosten_final: 200 }).eq("id", ticket.id)
  }

  // HW manipuliert surge_faktor (würde Provision aufpumpen)
  {
    const { error } = await sbHwOwn.from("tickets").update({ surge_faktor: 99 }).eq("id", ticket.id)
    const { data: check } = await admin.from("tickets").select("surge_faktor").eq("id", ticket.id).single<{ surge_faktor: number }>()
    const vulnerable = check?.surge_faktor === 99
    record(
      "Zugewiesener HW pumpt surge_faktor auf 99",
      "HIGH", vulnerable,
      vulnerable ? `🔥 surge=${check.surge_faktor} — beeinflusst Provision/Score` : `surge=${check?.surge_faktor} unverändert`,
    )
    if (vulnerable) await admin.from("tickets").update({ surge_faktor: 1.0 }).eq("id", ticket.id)
  }

  // HW übergibt Ticket an Konkurrent (Sabotage)
  {
    const { error } = await sbHwOwn.from("tickets").update({ zugewiesener_hw: seed.hwKonkurrent.id }).eq("id", ticket.id)
    const { data: check } = await admin.from("tickets").select("zugewiesener_hw").eq("id", ticket.id).single<{ zugewiesener_hw: string }>()
    const vulnerable = check?.zugewiesener_hw === seed.hwKonkurrent.id
    record(
      "Zugewiesener HW gibt Ticket an Konkurrent weiter",
      "HIGH", vulnerable,
      vulnerable ? `🔥 Ticket jetzt bei ${check.zugewiesener_hw} — wegklau möglich!` : `zugewiesener_hw unverändert`,
    )
    if (vulnerable) await admin.from("tickets").update({ zugewiesener_hw: seed.hwDiagnose.id }).eq("id", ticket.id)
  }

  // HW setzt verwalter_id auf sich selbst → wäre er auch noch Verwalter?
  {
    const { error } = await sbHwOwn.from("tickets").update({ verwalter_id: seed.hwDiagnose.id }).eq("id", ticket.id)
    const { data: check } = await admin.from("tickets").select("verwalter_id").eq("id", ticket.id).single<{ verwalter_id: string }>()
    const vulnerable = check?.verwalter_id === seed.hwDiagnose.id
    record(
      "Zugewiesener HW kapert verwalter_id",
      "CRITICAL", vulnerable,
      vulnerable ? `🔥 verwalter_id=HW! Erhält Verwalter-Rechte am Ticket via Policy "verwalter_id = auth.uid()"` : `verwalter_id unverändert`,
    )
    if (vulnerable) await admin.from("tickets").update({ verwalter_id: seed.verwalter.id }).eq("id", ticket.id)
  }

  // Mieter (erstellt_von) versucht status=erledigt direkt zu setzen
  {
    const { error } = await sbMieter.from("tickets").update({ status: "erledigt" }).eq("id", ticket.id)
    const { data: check } = await admin.from("tickets").select("status").eq("id", ticket.id).single<{ status: string }>()
    const vulnerable = check?.status === "erledigt"
    record(
      "Mieter setzt eigenes Ticket direkt auf 'erledigt' (Workflow-Bypass)",
      "MEDIUM", vulnerable,
      vulnerable ? `🟠 status='${check.status}' — Mieter umgeht HW-Workflow` : `status='${check?.status}' unverändert`,
    )
    if (vulnerable) await admin.from("tickets").update({ status: "in_bearbeitung" }).eq("id", ticket.id)
  }

  // ======================================================================
  // Test 3: Provisionen-Manipulation
  // ======================================================================
  console.log("\n— Provisionen-Manipulation —")
  if (provBase) {
    // HW (handwerker_id) versucht eigenen Provisions-Rate zu senken
    const { error } = await sbHwOwn.from("provisionen").update({ provision_rate: 0, provision_betrag: 0, gesamt: 200 }).eq("id", provBase.id)
    const { data: check } = await admin.from("provisionen").select("provision_rate").eq("id", provBase.id).single<{ provision_rate: number }>()
    const vulnerable = check?.provision_rate === 0
    record(
      "HW senkt eigene provision_rate auf 0",
      "HIGH", vulnerable,
      vulnerable ? `🔥 rate=0 — Provision umgangen!` : `rate=${check?.provision_rate} unverändert`,
    )
    if (vulnerable) await admin.from("provisionen").update({ provision_rate: 0.05, provision_betrag: 10, gesamt: 210 }).eq("id", provBase.id)
  }

  // ======================================================================
  // Test 4: Cross-User-Reads (IDOR)
  // ======================================================================
  console.log("\n— Cross-User-Reads —")
  {
    // Anderer HW versucht Ticket zu lesen, das ihm nicht zugewiesen ist
    // und keine Auktion ist
    const { data, error } = await sbHwOther.from("tickets").select("id, titel").eq("id", ticket.id).maybeSingle()
    const vulnerable = !!data
    record(
      "Fremder HW liest in_bearbeitung-Ticket",
      "MEDIUM", vulnerable,
      vulnerable ? `🟠 sieht Ticket "${data.titel}"` : `RLS blockt — null/leer`,
    )
  }

  // ======================================================================
  // Test 5: Angebot-Insert mit fremder handwerker_id
  // ======================================================================
  console.log("\n— Angebote-Manipulation —")
  {
    // Auktions-Ticket vom Verwalter anlegen
    const { data: auTicket } = await admin
      .from("tickets")
      .insert({
        titel: "Pen-Auktion",
        gewerk: "sanitaer",
        erstellt_von: seed.verwalter.id,
        verwalter_id: seed.verwalter.id,
        status: "auktion",
        auktion_ende: new Date(Date.now() + 3600_000).toISOString(),
      })
      .select("id")
      .single<{ id: string }>()

    const { error } = await sbHwOther.from("angebote").insert({
      ticket_id: auTicket!.id,
      handwerker_id: seed.hwDiagnose.id, // FREMDER HW!
      preis: 100,
      status: "eingereicht",
    })
    const { data: check } = await admin.from("angebote").select("id, handwerker_id").eq("ticket_id", auTicket!.id)
    const fremdgebot = check?.find(c => c.handwerker_id === seed.hwDiagnose.id)
    const vulnerable = !!fremdgebot
    record(
      "HW reicht Angebot unter fremder handwerker_id ein",
      "HIGH", vulnerable,
      vulnerable ? `🔥 Sabotage-Angebot vom Konkurrent eingebucht` : `RLS blockt: ${error?.message?.slice(0, 60) ?? "no row"}`,
    )

    if (auTicket) await admin.from("angebote").delete().eq("ticket_id", auTicket.id)
    if (auTicket) await admin.from("tickets").delete().eq("id", auTicket.id)
  }

  // ======================================================================
  // Test 6: Bewertungen ohne Zustand
  // ======================================================================
  console.log("\n— Bewertungen-Manipulation —")
  {
    // Mieter bewertet sein Ticket (ist in_bearbeitung, nicht erledigt)
    const { error } = await sbMieter.from("bewertungen").insert({
      ticket_id: ticket.id,
      handwerker_id: seed.hwDiagnose.id,
      bewerter_id: seed.mieter.id,
      sterne: 5,
    })
    const { data: check } = await admin.from("bewertungen").select("id").eq("ticket_id", ticket.id).maybeSingle()
    const vulnerable = !!check
    record(
      "Mieter bewertet Ticket VOR 'erledigt'-Status",
      "MEDIUM", vulnerable,
      vulnerable ? `🟠 Bewertung trotz Status='in_bearbeitung'` : `geblockt (${error?.message?.slice(0, 60) ?? "no row"})`,
    )
    if (vulnerable) await admin.from("bewertungen").delete().eq("ticket_id", ticket.id)
  }

  // Mieter bewertet ein FREMDES Ticket
  {
    const { data: fremdesTicket } = await admin
      .from("tickets")
      .insert({
        titel: "Fremdes Ticket",
        erstellt_von: seed.verwalter.id,
        zugewiesener_hw: seed.hwDiagnose.id,
        status: "erledigt",
      })
      .select("id")
      .single<{ id: string }>()

    const { error } = await sbMieter.from("bewertungen").insert({
      ticket_id: fremdesTicket!.id,
      handwerker_id: seed.hwDiagnose.id,
      bewerter_id: seed.mieter.id,
      sterne: 1,
    })
    const { data: check } = await admin.from("bewertungen").select("id").eq("ticket_id", fremdesTicket!.id).maybeSingle()
    const vulnerable = !!check
    record(
      "Mieter sabotiert HW mit 1-Stern auf fremdem Ticket",
      "HIGH", vulnerable,
      vulnerable ? `🔥 Bewertungs-Bombing möglich!` : `geblockt (${error?.message?.slice(0, 60) ?? "no row"})`,
    )

    if (fremdesTicket) {
      await admin.from("bewertungen").delete().eq("ticket_id", fremdesTicket.id)
      await admin.from("tickets").delete().eq("id", fremdesTicket.id)
    }
  }

  // ======================================================================
  // Test 7: Anon (kein Login) Zugriff
  // ======================================================================
  console.log("\n— Anon-Zugriff —")
  {
    const url = process.env.E2E_SUPABASE_URL!
    const anon = process.env.E2E_SUPABASE_ANON_KEY!
    const sbAnon = createSupabaseClient(url, anon, { auth: { persistSession: false } })
    const { data, error } = await sbAnon.from("tickets").select("id, titel").limit(5)
    const vulnerable = !!data && data.length > 0
    record(
      "Anonymous (kein Login) liest tickets",
      "HIGH", vulnerable,
      vulnerable ? `🔥 ${data.length} Tickets sichtbar ohne Login!` : `geblockt (${error?.message?.slice(0, 60) ?? "no rows"})`,
    )
  }
  {
    const url = process.env.E2E_SUPABASE_URL!
    const anon = process.env.E2E_SUPABASE_ANON_KEY!
    const sbAnon = createSupabaseClient(url, anon, { auth: { persistSession: false } })
    const { data } = await sbAnon.from("profiles").select("id, email, rolle").limit(5)
    const vulnerable = !!data && data.length > 0
    record(
      "Anonymous liest profiles (Email-Harvesting)",
      "MEDIUM", vulnerable,
      vulnerable ? `🟠 ${data.length} Profile mit Email lesbar` : `geblockt`,
    )
  }

  // ======================================================================
  // Cleanup
  // ======================================================================
  await admin.from("provisionen").delete().eq("ticket_id", ticket.id)
  await admin.from("tickets").delete().eq("id", ticket.id)

  // ======================================================================
  // Report
  // ======================================================================
  console.log("\n" + "=".repeat(70))
  console.log("Zusammenfassung")
  console.log("=".repeat(70))
  const vulnCount = results.filter(r => r.vulnerable).length
  const blockedCount = results.length - vulnCount
  console.log(`Tests: ${results.length} insgesamt`)
  console.log(`  ✅ blockiert: ${blockedCount}`)
  console.log(`  🔴 vulnerable: ${vulnCount}`)
  if (vulnCount > 0) {
    console.log(`\nGefundene Schwachstellen:`)
    for (const r of results.filter(x => x.vulnerable)) {
      console.log(`  [${r.severity}] ${r.name}`)
    }
  }
  process.exit(vulnCount > 0 ? 1 : 0)
}

main().catch(err => {
  console.error("Pen-Test-Skript abgebrochen:", err)
  process.exit(2)
})
