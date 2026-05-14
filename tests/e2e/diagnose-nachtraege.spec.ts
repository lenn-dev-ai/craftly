import { test, expect } from "@playwright/test"
import { seedTestUsers, TEST_USERS } from "./helpers/seed"
import { userAccessToken } from "./helpers/api-auth"
import {
  expectClose,
  getAngebotstreue,
  getProvision,
  getTicket,
  legeProjektTicketDirekt,
} from "./helpers/db-assertions"

// ============================================================
// Nachträge — 3 Stufen-Varianten
// ============================================================
// Schema: Aufpreis-Prozent als GENERATED-Column auf tickets.projekt_angebot
//   ≤ 10 %  → bagatell    → auto-genehmigt
//   ≤ 25 %  → wesentlich  → Verwalter-Approval
//   > 25 %  → erheblich   → Verwalter-Approval
//
// Trigger handle_nachtrag_genehmigt synchronisiert bei status='genehmigt':
//   - tickets.kosten_final += nachtrag_betrag
//   - provisionen.{auftragswert,betrag,gesamt} mit fester Rate
//   - profiles.angebotstreue neu (100 − 5×wesentlich − 15×erheblich)
//
// Jeder Test legt ein eigenes Projekt-Ticket an — keine Test-Abhängigkeiten.
// ============================================================

const PROJEKT_ANGEBOT = 380
const KOSTEN_FINAL_BASIS = 291  // 380 − 89 Diagnose-Sanitär

test.describe.serial("Nachträge", () => {
  test("Bagatell ≤ 10 %: auto-genehmigt, Trigger updated alles, angebotstreue unverändert", async ({ request }) => {
    const seed = await seedTestUsers()
    const projektId = await legeProjektTicketDirekt({
      erstelltVon: seed.verwalter.id,
      zugewiesenerHw: seed.hwDiagnose.id,
      titel: "E2E Bagatell-Nachtrag",
      projektAngebot: PROJEKT_ANGEBOT,
      kostenFinal: KOSTEN_FINAL_BASIS,
    })

    const hwToken = await userAccessToken(TEST_USERS.hw_diagnose.email, TEST_USERS.hw_diagnose.password)
    const res = await request.post("/api/nachtraege/einreichen", {
      headers: { Authorization: `Bearer ${hwToken}` },
      data: {
        ticket_id: projektId,
        nachtrag_betrag: 20,  // 20/380 = 5.3 % → bagatell
        begruendung: "Zusätzliche Dichtung musste erneuert werden — kein Mehraufwand.",
      },
    })
    if (!res.ok()) throw new Error(`Einreichen failed (${res.status()}): ${await res.text()}`)
    const json = await res.json()
    expect(json.stufe).toBe("bagatell")
    expect(json.autoGenehmigt).toBe(true)

    // Trigger-Effekte verifizieren
    const ticket = await getTicket(projektId)
    expectClose(Number(ticket.kosten_final), KOSTEN_FINAL_BASIS + 20, "kosten_final = Basis + 20")

    const prov = await getProvision(projektId)
    expectClose(Number(prov.auftragswert), KOSTEN_FINAL_BASIS + 20, "provisionen.auftragswert synchron")
    expectClose(Number(prov.provision_betrag), (KOSTEN_FINAL_BASIS + 20) * 0.05, "Provision 5 %")

    // Bagatell zählt NICHT für Score
    const score = await getAngebotstreue(seed.hwDiagnose.id)
    expect(score).toBe(100)
  })

  test("Wesentlich ≤ 25 %: offen → Verwalter genehmigt → kosten_final + Score −5", async ({ request }) => {
    const seed = await seedTestUsers()
    const projektId = await legeProjektTicketDirekt({
      erstelltVon: seed.verwalter.id,
      zugewiesenerHw: seed.hwDiagnose.id,
      titel: "E2E Wesentlich-Nachtrag",
      projektAngebot: PROJEKT_ANGEBOT,
      kostenFinal: KOSTEN_FINAL_BASIS,
    })

    // HW reicht 70 € ein = 18.4 % von 380 → wesentlich
    const hwToken = await userAccessToken(TEST_USERS.hw_diagnose.email, TEST_USERS.hw_diagnose.password)
    const einreichenRes = await request.post("/api/nachtraege/einreichen", {
      headers: { Authorization: `Bearer ${hwToken}` },
      data: {
        ticket_id: projektId,
        nachtrag_betrag: 70,
        begruendung: "Anschlussrohr war stark korrodiert, kompletter Austausch notwendig.",
      },
    })
    if (!einreichenRes.ok()) throw new Error(`Einreichen failed: ${await einreichenRes.text()}`)
    const einreichenJson = await einreichenRes.json()
    expect(einreichenJson.stufe).toBe("wesentlich")
    expect(einreichenJson.autoGenehmigt).toBe(false)
    const nachtragId = einreichenJson.nachtragId

    // Vor Genehmigung: kosten_final unverändert
    let ticket = await getTicket(projektId)
    expectClose(Number(ticket.kosten_final), KOSTEN_FINAL_BASIS, "vor Genehmigung unverändert")

    // Verwalter genehmigt
    const verwalterToken = await userAccessToken(TEST_USERS.verwalter.email, TEST_USERS.verwalter.password)
    const genehmigenRes = await request.post("/api/nachtraege/genehmigen", {
      headers: { Authorization: `Bearer ${verwalterToken}` },
      data: { nachtrag_id: nachtragId, entscheidung: "genehmigt" },
    })
    if (!genehmigenRes.ok()) throw new Error(`Genehmigen failed: ${await genehmigenRes.text()}`)

    // Trigger-Effekte
    ticket = await getTicket(projektId)
    expectClose(Number(ticket.kosten_final), KOSTEN_FINAL_BASIS + 70, "kosten_final + 70")

    const prov = await getProvision(projektId)
    expectClose(Number(prov.auftragswert), KOSTEN_FINAL_BASIS + 70, "provisionen synchron")

    // Wesentlich-Nachtrag senkt Score um 5
    const score = await getAngebotstreue(seed.hwDiagnose.id)
    expect(score).toBe(95)
  })

  test("Erheblich > 25 %: Verwalter lehnt ab → kein Effekt, Score bleibt", async ({ request }) => {
    const seed = await seedTestUsers()
    const projektId = await legeProjektTicketDirekt({
      erstelltVon: seed.verwalter.id,
      zugewiesenerHw: seed.hwDiagnose.id,
      titel: "E2E Erheblich-Nachtrag-Abgelehnt",
      projektAngebot: PROJEKT_ANGEBOT,
      kostenFinal: KOSTEN_FINAL_BASIS,
    })

    // 120 € = 31.5 % von 380 → erheblich
    const hwToken = await userAccessToken(TEST_USERS.hw_diagnose.email, TEST_USERS.hw_diagnose.password)
    const einreichenRes = await request.post("/api/nachtraege/einreichen", {
      headers: { Authorization: `Bearer ${hwToken}` },
      data: {
        ticket_id: projektId,
        nachtrag_betrag: 120,
        begruendung: "Komplette Wand war durchfeuchtet, deutlich mehr Aufwand als geplant.",
      },
    })
    if (!einreichenRes.ok()) throw new Error(`Einreichen failed: ${await einreichenRes.text()}`)
    const einreichenJson = await einreichenRes.json()
    expect(einreichenJson.stufe).toBe("erheblich")
    expect(einreichenJson.autoGenehmigt).toBe(false)
    const nachtragId = einreichenJson.nachtragId

    // Verwalter lehnt ab
    const verwalterToken = await userAccessToken(TEST_USERS.verwalter.email, TEST_USERS.verwalter.password)
    const ablehnenRes = await request.post("/api/nachtraege/genehmigen", {
      headers: { Authorization: `Bearer ${verwalterToken}` },
      data: { nachtrag_id: nachtragId, entscheidung: "abgelehnt" },
    })
    if (!ablehnenRes.ok()) throw new Error(`Ablehnen failed: ${await ablehnenRes.text()}`)

    // Trigger feuert NICHT bei abgelehnt
    const ticket = await getTicket(projektId)
    expectClose(Number(ticket.kosten_final), KOSTEN_FINAL_BASIS, "kosten_final unverändert")

    const prov = await getProvision(projektId)
    expectClose(Number(prov.auftragswert), KOSTEN_FINAL_BASIS, "provisionen unverändert")

    // Score bleibt 100 — nur genehmigte Nachträge zählen
    const score = await getAngebotstreue(seed.hwDiagnose.id)
    expect(score).toBe(100)
  })
})
