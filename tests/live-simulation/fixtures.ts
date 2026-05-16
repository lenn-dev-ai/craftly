import { adminClient } from "../e2e/helpers/supabase-admin"
import type { Persona } from "./personas"
import type { SimulationAccountResult } from "./accounts"

export interface LiveSimulationFixtures {
  sharedAuctionTicketId: string
  sharedReviewTicketIds: Record<string, string>
  verwalterAuctionTicketIds: Record<string, string>
  verwalterNachtragTicketIds: Record<string, string>
  diagnoseClaimTicketIds: Record<string, string>
  diagnoseBefundTicketIds: Record<string, string>
  diagnoseAuctionTicketIds: Record<string, string>
  nachtragTicketIds: Record<string, string>
}

type SeededAccountMap = Map<string, SimulationAccountResult>

const SIM_TITLE_PREFIX = "[SIM]"

export async function ensureSimulationFixtures(
  personas: Persona[],
  seededAccounts: SimulationAccountResult[],
): Promise<LiveSimulationFixtures> {
  const admin = adminClient()
  const accountByEmail: SeededAccountMap = new Map(seededAccounts.map(acc => [acc.email, acc]))
  const mieterPersonas = personas.filter(p => p.rolle === "mieter")
  const verwalterPersonas = personas.filter(p => p.rolle === "verwalter")
  const handwerkerPersonas = personas.filter(p => p.rolle === "handwerker")
  const firstMieter = accountByEmail.get(mieterPersonas[0]?.email || "")
  const firstVerwalter = accountByEmail.get(verwalterPersonas[0]?.email || "")
  const firstHandwerker = accountByEmail.get(handwerkerPersonas[0]?.email || "")
  if (!firstMieter || !firstVerwalter || !firstHandwerker) {
    throw new Error("Simulation-Fixtures benötigen mindestens je einen Mieter, Verwalter und Handwerker")
  }

  const sharedAuctionTicketId = await upsertTicket(admin, {
    title: `${SIM_TITLE_PREFIX} Shared Auction Ticket`,
    payload: ticketPayload({
      titel: `${SIM_TITLE_PREFIX} Shared Auction Ticket`,
      beschreibung: "Geteilter Auktions-Testfall für Handwerker-Angebote.",
      erstellt_von: firstMieter.id,
      verwalter_id: firstVerwalter.id,
      ticket_typ: "standard",
      status: "auktion",
      prioritaet: "zeitnah",
      gewerk: "allgemein",
      vergabemodus: "auktion",
      einsatzort_adresse: "Alexanderplatz 1, 10178 Berlin",
      einsatzort_lat: 52.5219,
      einsatzort_lng: 13.4132,
      auktion_ende: futureDate(3),
      dringlichkeit: "zeitnah",
    }),
  })
  await clearChildren(admin, sharedAuctionTicketId)

  const sharedReviewTicketIds: Record<string, string> = {}
  for (let i = 0; i < mieterPersonas.length; i++) {
    const persona = mieterPersonas[i]
    const account = accountByEmail.get(persona.email)
    if (!account) continue
    const reviewTicketId = await upsertTicket(admin, {
      title: `${SIM_TITLE_PREFIX} Review Ticket ${persona.id}`,
      payload: ticketPayload({
        titel: `${SIM_TITLE_PREFIX} Review Ticket ${persona.id}`,
        beschreibung: "Abgeschlossener Reparaturfall für die Bewertungs-UI.",
        erstellt_von: account.id,
        verwalter_id: firstVerwalter.id,
        ticket_typ: "projekt",
        status: "erledigt",
        prioritaet: "planbar",
        gewerk: "sanitaer",
        vergabemodus: "auktion",
        zugewiesener_hw: firstHandwerker.id,
        kosten_final: 420,
        diagnosegebuehr_angerechnet: false,
        befund_text: "Abschluss des Testsfalls.",
        befund_fotos: [],
        befund_aufwand_stunden: 2.0,
        projekt_angebot: 420,
        leistungsumfang: ["Abschluss und Reinigung"],
        einsatzort_adresse: "Torstraße 1, 10119 Berlin",
        einsatzort_lat: 52.5254,
        einsatzort_lng: 13.4095,
      }),
    })
    await clearChildren(admin, reviewTicketId)
    sharedReviewTicketIds[persona.id] = reviewTicketId
  }

  const verwalterAuctionTicketIds: Record<string, string> = {}
  const verwalterNachtragTicketIds: Record<string, string> = {}
  for (let i = 0; i < verwalterPersonas.length; i++) {
    const persona = verwalterPersonas[i]
    const account = accountByEmail.get(persona.email)
    if (!account) continue
    const baseAddress = berlinAddressForIndex(i + 40)

    const auctionId = await upsertTicket(admin, {
      title: `${SIM_TITLE_PREFIX} Verwalter Auction ${persona.id}`,
      payload: ticketPayload({
        titel: `${SIM_TITLE_PREFIX} Verwalter Auction ${persona.id}`,
        beschreibung: "Diagnose-Ticket, das vom Verwalter in eine Auktion überführt werden kann.",
        erstellt_von: firstMieter.id,
        verwalter_id: account.id,
        ticket_typ: "diagnose",
        status: "in_bearbeitung",
        prioritaet: "zeitnah",
        gewerk: "schreiner",
        vergabemodus: "auktion",
        zugewiesener_hw: firstHandwerker.id,
        befund_text: "Diagnose abgeschlossen, Auktion möglich.",
        befund_fotos: [],
        befund_aufwand_stunden: 1.5,
        projekt_angebot: 250,
        leistungsumfang: ["Auktion starten", "Angebot vergleichen"],
        preiskorridor_min: 200,
        preiskorridor_max: 350,
        einsatzort_adresse: baseAddress.adresse,
        einsatzort_lat: baseAddress.lat,
        einsatzort_lng: baseAddress.lng,
      }),
    })
    await clearChildren(admin, auctionId)
    verwalterAuctionTicketIds[persona.id] = auctionId

    const nachtragId = await upsertTicket(admin, {
      title: `${SIM_TITLE_PREFIX} Verwalter Nachtrag ${persona.id}`,
      payload: ticketPayload({
        titel: `${SIM_TITLE_PREFIX} Verwalter Nachtrag ${persona.id}`,
        beschreibung: "Projekt-Ticket mit offenem Nachtrag für Verwalter-Entscheidung.",
        erstellt_von: firstMieter.id,
        verwalter_id: account.id,
        ticket_typ: "projekt",
        status: "in_bearbeitung",
        prioritaet: "zeitnah",
        gewerk: "sanitaer",
        vergabemodus: "auktion",
        zugewiesener_hw: firstHandwerker.id,
        kosten_final: 420,
        diagnosegebuehr_angerechnet: false,
        befund_text: "Befund liegt vor, Nachtrag soll bewertet werden.",
        befund_fotos: [],
        befund_aufwand_stunden: 2.0,
        projekt_angebot: 420,
        leistungsumfang: ["Grundposition", "Zusatzposition"],
        preiskorridor_min: 350,
        preiskorridor_max: 480,
        einsatzort_adresse: baseAddress.adresse,
        einsatzort_lat: baseAddress.lat,
        einsatzort_lng: baseAddress.lng,
      }),
    })
    await clearChildren(admin, nachtragId)
    await seedOpenNachtrag(admin, nachtragId, firstHandwerker.id, 80)
    verwalterNachtragTicketIds[persona.id] = nachtragId
  }

  const diagnoseClaimTicketIds: Record<string, string> = {}
  const diagnoseBefundTicketIds: Record<string, string> = {}
  const diagnoseAuctionTicketIds: Record<string, string> = {}
  const nachtragTicketIds: Record<string, string> = {}

  for (let i = 0; i < handwerkerPersonas.length; i++) {
    const persona = handwerkerPersonas[i]
    const account = accountByEmail.get(persona.email)
    if (!account) continue
    const gewerk = persona.gewerk || "sanitaer"
    const baseAddress = berlinAddressForIndex(i)

    const claimId = await upsertTicket(admin, {
      title: `${SIM_TITLE_PREFIX} Diagnose Claim ${persona.id}`,
      payload: ticketPayload({
        titel: `${SIM_TITLE_PREFIX} Diagnose Claim ${persona.id}`,
        beschreibung: "Diagnose-Ticket zur atomaren Übernahme.",
        erstellt_von: firstMieter.id,
        verwalter_id: firstVerwalter.id,
        ticket_typ: "diagnose",
        status: "auktion",
        prioritaet: "zeitnah",
        gewerk,
        vergabemodus: "auktion",
        einsatzort_adresse: baseAddress.adresse,
        einsatzort_lat: baseAddress.lat,
        einsatzort_lng: baseAddress.lng,
      }),
    })
    await clearChildren(admin, claimId)
    diagnoseClaimTicketIds[persona.id] = claimId

    const befundId = await upsertTicket(admin, {
      title: `${SIM_TITLE_PREFIX} Diagnose Befund ${persona.id}`,
      payload: ticketPayload({
        titel: `${SIM_TITLE_PREFIX} Diagnose Befund ${persona.id}`,
        beschreibung: "Bereits übernommene Diagnose, bereit für Befund und Festpreis.",
        erstellt_von: firstMieter.id,
        verwalter_id: firstVerwalter.id,
        ticket_typ: "diagnose",
        status: "in_bearbeitung",
        prioritaet: "zeitnah",
        gewerk,
        vergabemodus: "auktion",
        zugewiesener_hw: account.id,
        einsatzort_adresse: baseAddress.adresse,
        einsatzort_lat: baseAddress.lat,
        einsatzort_lng: baseAddress.lng,
      }),
    })
    await clearChildren(admin, befundId)
    diagnoseBefundTicketIds[persona.id] = befundId

    const auctionId = await upsertTicket(admin, {
      title: `${SIM_TITLE_PREFIX} Diagnose Auction ${persona.id}`,
      payload: ticketPayload({
        titel: `${SIM_TITLE_PREFIX} Diagnose Auction ${persona.id}`,
        beschreibung: "Diagnose-Ticket mit Befund, das in eine Auktion überführt werden kann.",
        erstellt_von: firstMieter.id,
        verwalter_id: firstVerwalter.id,
        ticket_typ: "diagnose",
        status: "in_bearbeitung",
        prioritaet: "zeitnah",
        gewerk,
        vergabemodus: "auktion",
        zugewiesener_hw: account.id,
        befund_text: "Defekt dokumentiert, Projekt kann ausgeschrieben werden.",
        befund_fotos: [],
        befund_aufwand_stunden: 2.5,
        projekt_angebot: 390,
        leistungsumfang: ["Material prüfen", "Austausch vor Ort", "Funktionsprüfung"],
        preiskorridor_min: 320,
        preiskorridor_max: 460,
        einsatzort_adresse: baseAddress.adresse,
        einsatzort_lat: baseAddress.lat,
        einsatzort_lng: baseAddress.lng,
      }),
    })
    await clearChildren(admin, auctionId)
    diagnoseAuctionTicketIds[persona.id] = auctionId

    const nachtragId = await upsertTicket(admin, {
      title: `${SIM_TITLE_PREFIX} Nachtrag Ticket ${persona.id}`,
      payload: ticketPayload({
        titel: `${SIM_TITLE_PREFIX} Nachtrag Ticket ${persona.id}`,
        beschreibung: "Projekt-Ticket mit offenem Nachtrag für Verwalter-Entscheidung.",
        erstellt_von: firstMieter.id,
        verwalter_id: firstVerwalter.id,
        ticket_typ: "projekt",
        status: "in_bearbeitung",
        prioritaet: "zeitnah",
        gewerk,
        vergabemodus: "auktion",
        zugewiesener_hw: account.id,
        kosten_final: 420,
        diagnosegebuehr_angerechnet: false,
        befund_text: "Befund liegt vor, Nachtrag soll bewertet werden.",
        befund_fotos: [],
        befund_aufwand_stunden: 2.0,
        projekt_angebot: 420,
        leistungsumfang: ["Grundposition", "Zusatzposition"],
        preiskorridor_min: 350,
        preiskorridor_max: 480,
        einsatzort_adresse: baseAddress.adresse,
        einsatzort_lat: baseAddress.lat,
        einsatzort_lng: baseAddress.lng,
      }),
    })
    await clearChildren(admin, nachtragId)
    await seedOpenNachtrag(admin, nachtragId, account.id, 80)
    nachtragTicketIds[persona.id] = nachtragId
  }

  const sharedBidHandwerkerIds = handwerkerPersonas.slice(0, 4)
  for (let i = 0; i < sharedBidHandwerkerIds.length; i++) {
    const persona = sharedBidHandwerkerIds[i]
    const account = accountByEmail.get(persona.email)
    if (!account) continue
    await upsertBid(admin, sharedAuctionTicketId, account.id, 340 + i * 15)
  }

  return {
    sharedAuctionTicketId,
    sharedReviewTicketIds,
    verwalterAuctionTicketIds,
    verwalterNachtragTicketIds,
    diagnoseClaimTicketIds,
    diagnoseBefundTicketIds,
    diagnoseAuctionTicketIds,
    nachtragTicketIds,
  }
}

function ticketPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    ...payload,
    // ensures compat with historic rows if a column is absent in a preview DB
  }
}

async function upsertTicket(
  admin: ReturnType<typeof adminClient>,
  params: { title: string; payload: Record<string, unknown> },
): Promise<string> {
  const existing = await admin
    .from("tickets")
    .select("id")
    .eq("titel", params.title)
    .maybeSingle<{ id: string }>()

  if (existing.data?.id) {
    const { error } = await admin.from("tickets").update(params.payload).eq("id", existing.data.id)
    if (error) throw new Error(`Ticket-Update fehlgeschlagen (${params.title}): ${error.message}`)
    return existing.data.id
  }

  const { data, error } = await admin
    .from("tickets")
    .insert(params.payload)
    .select("id")
    .single<{ id: string }>()
  if (error || !data) {
    throw new Error(`Ticket-Insert fehlgeschlagen (${params.title}): ${error?.message}`)
  }
  return data.id
}

async function clearChildren(admin: ReturnType<typeof adminClient>, ticketId: string): Promise<void> {
  await admin.from("angebote").delete().eq("ticket_id", ticketId)
  await admin.from("nachtraege").delete().eq("ticket_id", ticketId)
  await admin.from("bewertungen").delete().eq("ticket_id", ticketId)
}

async function upsertBid(
  admin: ReturnType<typeof adminClient>,
  ticketId: string,
  handwerkerId: string,
  preis: number,
): Promise<void> {
  const { error } = await admin.from("angebote").upsert(
    {
      ticket_id: ticketId,
      handwerker_id: handwerkerId,
      preis,
      fruehester_termin: futureDate(7),
      geschaetzte_dauer: "2",
      nachricht: "Seed-Angebot für den Live-Test",
      status: "eingereicht",
    },
    { onConflict: "ticket_id,handwerker_id" },
  )
  if (error) throw new Error(`Bid-Upsert fehlgeschlagen: ${error.message}`)
}

async function seedOpenNachtrag(
  admin: ReturnType<typeof adminClient>,
  ticketId: string,
  handwerkerId: string,
  betrag: number,
): Promise<void> {
  const { error } = await admin.from("nachtraege").insert({
    ticket_id: ticketId,
    handwerker_id: handwerkerId,
    ursprungspreis: 400,
    nachtrag_betrag: betrag,
    begruendung: "Zusatzleistung im Live-Test",
    status: "offen",
  })
  if (error) throw new Error(`Nachtrag-Insert fehlgeschlagen: ${error.message}`)
}

function futureDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function berlinAddressForIndex(index: number): { adresse: string; lat: number; lng: number } {
  const addresses = [
    { adresse: "Torstraße 1, 10119 Berlin", lat: 52.5254, lng: 13.4095 },
    { adresse: "Kottbusser Damm 12, 10967 Berlin", lat: 52.4929, lng: 13.4215 },
    { adresse: "Pappelallee 3, 10437 Berlin", lat: 52.5434, lng: 13.4187 },
    { adresse: "Wilmersdorfer Str. 45, 10627 Berlin", lat: 52.5046, lng: 13.3026 },
    { adresse: "Schloßstraße 28, 12163 Berlin", lat: 52.4534, lng: 13.3265 },
    { adresse: "Frankfurter Allee 77, 10247 Berlin", lat: 52.5144, lng: 13.4597 },
  ]
  return addresses[index % addresses.length]
}
