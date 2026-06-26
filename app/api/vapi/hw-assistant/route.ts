import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { verifyVapiSignature } from "@/lib/sms/verify-vapi-signature"
import {
  scoreEinladung,
  scoreZuSprache,
  type EinladungInput,
  type HwPreferences,
} from "@/lib/agent/score-einladung"
import { buildAssistantConfig } from "@/lib/vapi/assistant-config"
import { formatGewerk } from "@/types"

// POST /api/vapi/hw-assistant
// Sprint AW — Voice-AI Assistent für Handwerker.
//
// Vapi ruft diesen Endpoint in zwei Situationen auf:
//   1. assistant-request  → Wenn das Telefon klingelt, fragt Vapi nach dem
//      Assistenten-Config. Wir geben eine personalisierte Config zurück,
//      abgestimmt auf den anrufenden HW (via Caller-Phone-Lookup).
//   2. tool-calls         → Wenn der HW Fragen stellt ("Was hab ich heute?"),
//      ruft Vapi unsere Tools auf. Wir laden die Daten aus Supabase.
//
// Auth: HMAC via x-vapi-signature (VAPI_WEBHOOK_SECRET). Wenn ENV fehlt,
// wird in dev-Umgebung durchgelassen (Warnung im Log).
//
// Vapi-Docs: https://docs.vapi.ai/server-url

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

interface VapiCall {
  id: string
  customer?: { number?: string }
}

type VapiMessage =
  | { type: "assistant-request"; call: VapiCall }
  | { type: "tool-calls"; call: VapiCall; toolCallList: VapiToolCall[] }
  | { type: "end-of-call-report"; call: VapiCall; transcript?: string }
  | { type: "status-update"; call: VapiCall; status?: string }

interface VapiToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

interface HwProfile {
  id: string
  name: string | null
  telefon: string | null
  startort_adresse: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sucht einen HW in profiles anhand der Caller-Nummer (Suffix-Match). */
async function findHwByPhone(phone: string): Promise<HwProfile | null> {
  const admin = createServiceRoleClient()
  const suffix = phone.replace(/\D/g, "").slice(-10)
  if (!suffix) return null

  const { data } = await admin
    .from("profiles")
    .select("id, name, telefon, startort_adresse")
    .eq("rolle", "handwerker")
    .not("telefon", "is", null)
    .returns<HwProfile[]>()

  return (
    data?.find(p => (p.telefon ?? "").replace(/\D/g, "").slice(-10) === suffix) ?? null
  )
}

/** Lädt einen HW direkt per id (für Web-Calls, die keine Caller-Nummer haben). */
async function findHwById(hwId: string): Promise<HwProfile | null> {
  const admin = createServiceRoleClient()
  const { data } = await admin
    .from("profiles")
    .select("id, name, telefon, startort_adresse")
    .eq("id", hwId)
    .eq("rolle", "handwerker")
    .maybeSingle<HwProfile>()
  return data ?? null
}

/** Heutiges Briefing als gesprochener String (kompakt für TTS). */
async function getBriefingText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) // YYYY-MM-DD

  const { data: termine } = await admin
    .from("termine")
    .select("von, bis, titel, einsatzort_adresse")
    .eq("handwerker_id", hwId)
    .eq("datum", heute)
    .eq("status", "bestaetigt")
    .order("von")
    .returns<Array<{ von: string; bis: string; titel: string; einsatzort_adresse: string | null }>>()

  if (!termine || termine.length === 0) {
    return "Du hast heute keine bestätigten Termine. Schau in deine offenen Aufträge – vielleicht gibt es neue Anfragen."
  }

  const stopsText = termine
    .map((t, i) => {
      const von = t.von?.slice(0, 5) ?? "?"
      const titel = t.titel ?? "Termin"
      const ort = t.einsatzort_adresse
        ? ` in ${t.einsatzort_adresse.split(",")[0]}`  // Nur Straße, kein langer Adressblock
        : ""
      return `${i + 1}. Um ${von} Uhr: ${titel}${ort}.`
    })
    .join(" ")

  return `Du hast heute ${termine.length} Termin${termine.length === 1 ? "" : "e"}. ${stopsText}`
}

/** Sprint AX Phase 4 — Neue Anfragen mit Agent-Empfehlung (gesprochener String). */
async function getNeuAnfragenMitEmpfehlungText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()

  // HW-Präferenzen laden (brauchen wir für Score)
  const { data: hwData } = await admin
    .from("profiles")
    .select("handwerker_gewerke, gewerk, radius_km, agent_max_radius_km, agent_auto_accept, agent_min_auftragswert, startort_lat, startort_lng, mindest_stundensatz")
    .eq("id", hwId)
    .single()

  if (!hwData) return "Ich konnte deine Einstellungen nicht laden."

  const hwPrefs: HwPreferences = {
    handwerker_gewerke: (hwData as { handwerker_gewerke?: string[] | null }).handwerker_gewerke ?? null,
    gewerk: (hwData as { gewerk?: string | null }).gewerk ?? null,
    radius_km: (hwData as { radius_km?: number | null }).radius_km ?? null,
    agent_max_radius_km: (hwData as { agent_max_radius_km?: number | null }).agent_max_radius_km ?? null,
    agent_auto_accept: (hwData as { agent_auto_accept?: boolean }).agent_auto_accept ?? false,
    agent_min_auftragswert: (hwData as { agent_min_auftragswert?: number | null }).agent_min_auftragswert ?? null,
    startort_lat: (hwData as { startort_lat?: number | null }).startort_lat ?? null,
    startort_lng: (hwData as { startort_lng?: number | null }).startort_lng ?? null,
    mindest_stundensatz: (hwData as { mindest_stundensatz?: number | null }).mindest_stundensatz ?? null,
  }

  // Offene Einladungen laden (max 5 für Voice-Briefing)
  interface RawEinladung {
    id: string
    ticket_id: string
    tickets: {
      titel: string
      gewerk: string | null
      einsatzort_adresse: string | null
      einsatzort_lat: number | null
      einsatzort_lng: number | null
      kosten_final: number | null
      dringlichkeit: string | null
    } | null
  }

  const { data: einladungen } = await admin
    .from("einladungen")
    .select("id, ticket_id, tickets (titel, gewerk, einsatzort_adresse, einsatzort_lat, einsatzort_lng, kosten_final, dringlichkeit)")
    .eq("handwerker_id", hwId)
    .eq("status", "offen")
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<RawEinladung[]>()

  if (!einladungen || einladungen.length === 0) {
    return "Du hast aktuell keine neuen Anfragen. Alles erledigt!"
  }

  // Jede Anfrage bewerten
  const scored = einladungen.map(e => {
    const t = e.tickets
    const input: EinladungInput = {
      id: e.id,
      ticket_id: e.ticket_id,
      titel: t?.titel ?? "Auftrag",
      gewerk: t?.gewerk ?? null,
      einsatzort_adresse: t?.einsatzort_adresse ?? null,
      einsatzort_lat: t?.einsatzort_lat ?? null,
      einsatzort_lng: t?.einsatzort_lng ?? null,
      kosten_final: t?.kosten_final ?? null,
      dringlichkeit: t?.dringlichkeit ?? null,
    }
    return { input, score: scoreEinladung(input, hwPrefs) }
  })

  // Beste zuerst
  scored.sort((a, b) => b.score.score - a.score.score)

  const texte = scored.map(({ input, score }) => scoreZuSprache(input, score))
  const intro = `Du hast ${einladungen.length} neue Anfrage${einladungen.length === 1 ? "" : "n"}. `
  return intro + texte.join(" Als Nächstes: ") + " Schau in Reparo für Details."
}

/** Offene Einladungen/Anfragen als gesprochener String. */
async function getOffeneAnfragenText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()

  const { count: einladungen } = await admin
    .from("einladungen")
    .select("*", { count: "exact", head: true })
    .eq("handwerker_id", hwId)
    .eq("status", "offen")

  const { count: termine } = await admin
    .from("termine")
    .select("*", { count: "exact", head: true })
    .eq("handwerker_id", hwId)
    .eq("status", "vorgeschlagen")

  const parts: string[] = []
  if (einladungen && einladungen > 0) {
    parts.push(`${einladungen} offene Auftrag${einladungen === 1 ? "" : "sanfragen"}`)
  }
  if (termine && termine > 0) {
    parts.push(`${termine} Termin${termine === 1 ? "" : "vorschläge"} die auf Bestätigung warten`)
  }

  if (parts.length === 0) {
    return "Du hast aktuell keine offenen Anfragen. Alles erledigt!"
  }

  return `Du hast ${parts.join(" und ")}. Schau kurz in Reparo.`
}

/** Euro-Betrag deutsch formatiert (ganze Euro, für TTS). */
function euro(n: number): string {
  return Math.round(n).toLocaleString("de-DE")
}

/** Verdienst-/Einnahmen-Übersicht als gesprochener String.
 *  Logik gespiegelt von app/dashboard-handwerker/einnahmen: HW bekommt 100%
 *  des Auftragswerts (kosten_final) aus erledigten Tickets. */
async function getVerdienstText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()

  const { data: tickets } = await admin
    .from("tickets")
    .select("status, kosten_final, hw_abschluss_am, created_at")
    .eq("zugewiesener_hw", hwId)
    .in("status", ["in_bearbeitung", "fertiggestellt_hw", "erledigt"])
    .returns<Array<{ status: string; kosten_final: number | null; hw_abschluss_am: string | null; created_at: string }>>()

  if (!tickets || tickets.length === 0) {
    return "Du hast noch keine Aufträge über Reparo abgeschlossen, also bisher keinen Verdienst. Sobald du Aufträge erledigst, kannst du hier deine Einnahmen abfragen."
  }

  const erledigt = tickets.filter(t => t.status === "erledigt")
  const laufend = tickets.filter(t => t.status === "in_bearbeitung" || t.status === "fertiggestellt_hw")

  const jetzt = Date.now()
  const vor7Tagen = jetzt - 7 * 86400_000
  // Monatsanfang (Berlin) als ms-Schwelle.
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })
  const monatStartDate = new Date(`${heute.slice(0, 7)}-01T00:00:00Z`)
  const monatStart = monatStartDate.getTime()
  const vormonatStart = new Date(Date.UTC(monatStartDate.getUTCFullYear(), monatStartDate.getUTCMonth() - 1, 1)).getTime()

  const abschlussMs = (t: { hw_abschluss_am: string | null; created_at: string }) =>
    new Date(t.hw_abschluss_am ?? t.created_at).getTime()
  const summe = (arr: Array<{ kosten_final: number | null }>) =>
    arr.reduce((s, t) => s + (t.kosten_final ?? 0), 0)

  const woche = summe(erledigt.filter(t => abschlussMs(t) >= vor7Tagen))
  const monat = summe(erledigt.filter(t => abschlussMs(t) >= monatStart))
  const vormonat = summe(erledigt.filter(t => { const ms = abschlussMs(t); return ms >= vormonatStart && ms < monatStart }))
  const gesamt = summe(erledigt)
  const avg = erledigt.length > 0 ? gesamt / erledigt.length : 0

  if (erledigt.length === 0) {
    const lauf = laufend.length > 0
      ? ` Du hast aktuell ${laufend.length} ${laufend.length === 1 ? "Auftrag" : "Aufträge"} in Arbeit — sobald die abgeschlossen sind, zählt der Verdienst.`
      : ""
    return `Du hast bisher noch keinen abgeschlossenen Auftrag, also noch keinen Verdienst.${lauf}`
  }

  let txt = `Dein Verdienst über Reparo: diese Woche ${euro(woche)} Euro, diesen Monat ${euro(monat)} Euro, insgesamt ${euro(gesamt)} Euro aus ${erledigt.length} abgeschlossenen Aufträgen. Das sind im Schnitt ${euro(avg)} Euro pro Auftrag.`
  if (vormonat > 0) {
    const pct = Math.round(((monat - vormonat) / vormonat) * 100)
    txt += pct >= 0
      ? ` Das sind ${pct} Prozent mehr als im Vormonat, da waren es ${euro(vormonat)} Euro.`
      : ` Das sind ${Math.abs(pct)} Prozent weniger als im Vormonat, da waren es ${euro(vormonat)} Euro.`
  }
  if (laufend.length > 0) {
    txt += ` Aktuell sind noch ${laufend.length} ${laufend.length === 1 ? "Auftrag" : "Aufträge"} in Arbeit.`
  }
  txt += " Du bekommst immer den vollen Auftragswert, Reparo zieht dir nichts ab."
  return txt
}

/** Leistungs-Auswertung als gesprochener String: abgeschlossene Aufträge,
 *  wahrgenommene Termine (bestätigt & in der Vergangenheit) und Bewertung. */
async function getStatistikText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) // YYYY-MM-DD
  const monatStart = `${heute.slice(0, 7)}-01`

  const [profilRes, ticketsRes, termineRes] = await Promise.all([
    admin.from("profiles").select("bewertung_avg, auftraege_anzahl").eq("id", hwId).maybeSingle(),
    admin.from("tickets").select("hw_abschluss_am").eq("zugewiesener_hw", hwId).eq("status", "erledigt")
      .returns<Array<{ hw_abschluss_am: string | null }>>(),
    admin.from("termine").select("datum").eq("handwerker_id", hwId).eq("status", "bestaetigt").lte("datum", heute)
      .returns<Array<{ datum: string }>>(),
  ])

  const erledigt = ticketsRes.data ?? []
  const termine = termineRes.data ?? []
  const profil = profilRes.data as { bewertung_avg: number | null; auftraege_anzahl: number | null } | null

  const erledigtMonat = erledigt.filter(t => (t.hw_abschluss_am ?? "") >= monatStart).length
  const termineMonat = termine.filter(t => t.datum >= monatStart).length

  const parts: string[] = []
  parts.push(
    `Du hast insgesamt ${erledigt.length} ${erledigt.length === 1 ? "Auftrag" : "Aufträge"} über Reparo abgeschlossen` +
      (erledigtMonat > 0 ? `, davon ${erledigtMonat} diesen Monat.` : "."),
  )
  parts.push(
    `Wahrgenommene Termine: ${termine.length} insgesamt` +
      (termineMonat > 0 ? `, ${termineMonat} davon diesen Monat.` : "."),
  )
  const avgB = profil?.bewertung_avg
  if (avgB && avgB > 0) {
    const sterne = Number(avgB).toFixed(1).replace(".", ",")
    parts.push(`Deine Durchschnittsbewertung liegt bei ${sterne} von 5 Sternen.`)
  } else {
    parts.push("Eine Durchschnittsbewertung hast du noch nicht.")
  }
  return parts.join(" ")
}

/** YYYY-MM-DD → "Montag, 7. Juli" (Berlin). */
function datumDeutsch(datum: string): string {
  return new Date(`${datum}T12:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin",
  })
}

/** Termin-Ausblick: nächster Termin + morgen + nächste 7 Tage. */
async function getTerminausblickText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })
  const morgen = new Date(Date.now() + 86400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })
  const in7 = new Date(Date.now() + 7 * 86400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })

  const { data: termine } = await admin
    .from("termine")
    .select("datum, von, titel, einsatzort_adresse")
    .eq("handwerker_id", hwId)
    .eq("status", "bestaetigt")
    .gte("datum", heute)
    .order("datum")
    .order("von")
    .returns<Array<{ datum: string; von: string; titel: string; einsatzort_adresse: string | null }>>()

  if (!termine || termine.length === 0) {
    return "Du hast aktuell keine anstehenden bestätigten Termine."
  }

  const next = termine[0]
  const ort = next.einsatzort_adresse ? ` in ${next.einsatzort_adresse.split(",")[0]}` : ""
  const wann = next.datum === heute ? "heute" : next.datum === morgen ? "morgen" : `am ${datumDeutsch(next.datum)}`
  const vonZeit = next.von?.slice(0, 5) ?? "?"
  const morgenCount = termine.filter(t => t.datum === morgen).length
  const wocheCount = termine.filter(t => t.datum <= in7).length

  let txt = `Dein nächster Termin ist ${wann} um ${vonZeit} Uhr: ${next.titel}${ort}.`
  txt += ` In den nächsten sieben Tagen hast du ${wocheCount} Termin${wocheCount === 1 ? "" : "e"}`
  txt += morgenCount > 0 ? `, davon ${morgenCount} morgen.` : "."
  return txt
}

/** Laufende Aufträge: in Arbeit + auf Abnahme wartend. */
async function getLaufendeAuftraegeText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()
  const { data: tickets } = await admin
    .from("tickets")
    .select("titel, status, kosten_final, einsatzort_adresse")
    .eq("zugewiesener_hw", hwId)
    .in("status", ["in_bearbeitung", "fertiggestellt_hw"])
    .order("created_at", { ascending: false })
    .returns<Array<{ titel: string; status: string; kosten_final: number | null; einsatzort_adresse: string | null }>>()

  if (!tickets || tickets.length === 0) {
    return "Du hast aktuell keine laufenden Aufträge."
  }
  const inArbeit = tickets.filter(t => t.status === "in_bearbeitung")
  const abnahme = tickets.filter(t => t.status === "fertiggestellt_hw")

  const parts: string[] = []
  if (inArbeit.length > 0) {
    const liste = inArbeit.slice(0, 3).map(t => {
      const ort = t.einsatzort_adresse ? ` in ${t.einsatzort_adresse.split(",")[0]}` : ""
      const betrag = t.kosten_final ? ` für ${euro(t.kosten_final)} Euro` : ""
      return `${t.titel}${ort}${betrag}`
    }).join("; ")
    parts.push(`Du hast ${inArbeit.length} ${inArbeit.length === 1 ? "Auftrag" : "Aufträge"} in Arbeit: ${liste}.`)
  }
  if (abnahme.length > 0) {
    parts.push(`${abnahme.length} ${abnahme.length === 1 ? "Auftrag wartet" : "Aufträge warten"} auf die Abnahme durch den Verwalter.`)
  }
  return parts.join(" ")
}

const PARTNER_TITEL: Record<string, string> = {
  gold: "Premium-Partner", silber: "Top-Partner", bronze: "Vertrauter Partner",
}

/** Partner-Status: Stufe, Score, Antwort-Rate, Bewertung + Weg zur nächsten Stufe.
 *  Logik gespiegelt von components/handwerker/SichtbarkeitsBadge. */
async function getPartnerStatusText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()
  const { data: p } = await admin
    .from("profiles")
    .select("sichtbarkeit_stufe, verfuegbarkeit_score, angebotstreue, bewertung_avg, auftraege_anzahl")
    .eq("id", hwId)
    .maybeSingle<{
      sichtbarkeit_stufe: string | null; verfuegbarkeit_score: number | null
      angebotstreue: number | null; bewertung_avg: number | null; auftraege_anzahl: number | null
    }>()
  if (!p) return "Ich konnte deinen Partner-Status nicht laden."

  const stufe = p.sichtbarkeit_stufe ?? "bronze"
  const titel = PARTNER_TITEL[stufe] ?? "Vertrauter Partner"
  const score = Number(p.verfuegbarkeit_score ?? 0)
  const treue = Number(p.angebotstreue ?? 100)

  let txt = `Du bist aktuell ${titel} mit ${score.toFixed(0)} von 100 Punkten. Deine Antwort-Rate liegt bei ${treue.toFixed(0)} Prozent.`
  if (p.bewertung_avg && p.bewertung_avg > 0) {
    txt += ` Deine Durchschnittsbewertung ist ${Number(p.bewertung_avg).toFixed(1).replace(".", ",")} Sterne${p.auftraege_anzahl ? ` aus ${p.auftraege_anzahl} Aufträgen` : ""}.`
  }
  const naechste = stufe === "bronze" ? { name: "Top-Partner", schwelle: 50 }
                 : stufe === "silber" ? { name: "Premium-Partner", schwelle: 75 }
                 : null
  if (naechste) {
    const fehlend = Math.max(0, naechste.schwelle - score)
    txt += fehlend > 0
      ? ` Dir fehlen noch ${fehlend.toFixed(0)} Punkte bis zum ${naechste.name}. Tipp: schnell auf Einladungen antworten und gute Bewertungen sammeln.`
      : ` Du hast die Schwelle zum ${naechste.name} erreicht.`
  } else {
    txt += " Du hast die höchste Partner-Stufe erreicht — bleib aktiv, um sie zu halten."
  }
  return txt
}

/** Aktuelle Einstellungen: Gewerke, Radius, Auto-Annahme, Stundensatz, Kalender. */
async function getEinstellungenText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()
  const { data: p } = await admin
    .from("profiles")
    .select("handwerker_gewerke, gewerk, radius_km, agent_max_radius_km, agent_auto_accept, agent_min_auftragswert, mindest_stundensatz, startort_adresse, google_calendar_connected")
    .eq("id", hwId)
    .maybeSingle()
  if (!p) return "Ich konnte deine Einstellungen nicht laden."

  const pp = p as Record<string, unknown>
  const gewerke = (pp.handwerker_gewerke as string[] | null) ?? (pp.gewerk ? [pp.gewerk as string] : [])
  const gewerkeText = gewerke.length > 0 ? gewerke.map(g => formatGewerk(g)).join(", ") : "keine hinterlegt"
  const radius = (pp.agent_max_radius_km as number | null) ?? (pp.radius_km as number | null)
  const auto = pp.agent_auto_accept === true
  const minWert = pp.agent_min_auftragswert as number | null
  const stundensatz = pp.mindest_stundensatz as number | null
  const startort = pp.startort_adresse as string | null
  const kalender = pp.google_calendar_connected === true

  const parts: string[] = [`Deine Gewerke: ${gewerkeText}.`]
  if (radius) parts.push(`Dein Aktionsradius ist ${radius} Kilometer.`)
  parts.push(auto
    ? `Die automatische Auftragsannahme ist aktiv${minWert ? ` ab ${euro(minWert)} Euro Auftragswert` : ""}.`
    : "Die automatische Auftragsannahme ist aus — du bestätigst Anfragen selbst.")
  if (stundensatz) parts.push(`Dein Mindest-Stundensatz ist ${euro(stundensatz)} Euro.`)
  if (startort) parts.push(`Dein Startort ist ${startort.split(",")[0]}.`)
  parts.push(kalender ? "Dein Google-Kalender ist verbunden." : "Dein Google-Kalender ist nicht verbunden.")
  return parts.join(" ")
}

/** Ansprechpartner/Adresse für den nächsten anstehenden Einsatz (Verwalter). */
async function getKontaktText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })

  const { data: termine } = await admin
    .from("termine")
    .select("titel, einsatzort_adresse, ticket_id")
    .eq("handwerker_id", hwId)
    .eq("status", "bestaetigt")
    .gte("datum", heute)
    .order("datum")
    .order("von")
    .limit(1)
    .returns<Array<{ titel: string; einsatzort_adresse: string | null; ticket_id: string | null }>>()

  if (!termine || termine.length === 0) {
    return "Du hast aktuell keinen anstehenden Termin, zu dem ich dir einen Ansprechpartner nennen kann."
  }

  const t = termine[0]
  const adresse = t.einsatzort_adresse ?? "Adresse nicht hinterlegt"
  let kontaktSatz = ""
  if (t.ticket_id) {
    const { data: ticket } = await admin
      .from("tickets").select("verwalter_id").eq("id", t.ticket_id)
      .maybeSingle<{ verwalter_id: string | null }>()
    if (ticket?.verwalter_id) {
      const { data: vw } = await admin
        .from("profiles").select("name, firma, telefon").eq("id", ticket.verwalter_id)
        .maybeSingle<{ name: string | null; firma: string | null; telefon: string | null }>()
      if (vw) {
        const wer = vw.name ?? vw.firma ?? "dein Ansprechpartner"
        const firma = vw.firma && vw.name ? ` von ${vw.firma}` : ""
        const tel = vw.telefon ? `, erreichbar unter ${vw.telefon}` : ""
        kontaktSatz = ` Ansprechpartner ist ${wer}${firma}${tel}.`
      }
    }
  }
  return `Dein nächster Einsatz ist ${t.titel} in ${adresse}.${kontaktSatz}`
}

/** Top-Segmente: stärkstes Gewerk + ertragreichste Gegend (erledigte Aufträge). */
async function getTopSegmenteText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()
  const { data: tickets } = await admin
    .from("tickets")
    .select("gewerk, kosten_final, einsatzort_adresse")
    .eq("zugewiesener_hw", hwId)
    .eq("status", "erledigt")
    .returns<Array<{ gewerk: string | null; kosten_final: number | null; einsatzort_adresse: string | null }>>()

  if (!tickets || tickets.length === 0) {
    return "Du hast noch keine abgeschlossenen Aufträge, daher kann ich noch keine stärksten Bereiche auswerten."
  }

  const top = (keyFn: (t: { gewerk: string | null; einsatzort_adresse: string | null }) => string) => {
    const m = new Map<string, { sum: number; count: number }>()
    for (const t of tickets) {
      const k = keyFn(t)
      if (!k) continue
      const e = m.get(k) ?? { sum: 0, count: 0 }
      e.sum += t.kosten_final ?? 0
      e.count += 1
      m.set(k, e)
    }
    return Array.from(m.entries()).sort((a, b) => b[1].sum - a[1].sum)[0]
  }

  const topG = top(t => t.gewerk ?? "")
  const ortKey = (t: { einsatzort_adresse: string | null }) => {
    if (!t.einsatzort_adresse) return ""
    const last = t.einsatzort_adresse.split(",").pop()?.trim() ?? ""
    return last.replace(/^\d{4,5}\s*/, "").trim() || last
  }
  const topO = top(ortKey)

  const parts: string[] = []
  if (topG) {
    parts.push(`Dein stärkstes Gewerk ist ${formatGewerk(topG[0])} mit ${euro(topG[1].sum)} Euro aus ${topG[1].count} ${topG[1].count === 1 ? "Auftrag" : "Aufträgen"}.`)
  }
  if (topO && topO[0]) {
    parts.push(`Die meisten Einnahmen kommen aus ${topO[0]} mit ${euro(topO[1].sum)} Euro.`)
  }
  return parts.join(" ") || "Ich konnte keine eindeutigen Top-Bereiche ermitteln."
}

/** Verlauf: Verdienst & Aufträge der letzten 3 Monate + Annahmequote. */
async function getVerlaufText(hwId: string): Promise<string> {
  const admin = createServiceRoleClient()
  const [ticketsRes, einlRes] = await Promise.all([
    admin.from("tickets").select("kosten_final, hw_abschluss_am, created_at")
      .eq("zugewiesener_hw", hwId).eq("status", "erledigt")
      .returns<Array<{ kosten_final: number | null; hw_abschluss_am: string | null; created_at: string }>>(),
    admin.from("einladungen").select("status").eq("handwerker_id", hwId)
      .returns<Array<{ status: string }>>(),
  ])
  const tickets = ticketsRes.data ?? []
  const einl = einlRes.data ?? []

  // Letzte 3 Monatsschlüssel (YYYY-MM, Berlin-bezogen).
  const heuteYM = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 7)
  const [y, m] = heuteYM.split("-").map(Number)
  const keys: string[] = []
  for (let i = 2; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`)
  }
  const label = (key: string) =>
    new Date(`${key}-01T12:00:00Z`).toLocaleDateString("de-DE", { month: "long", timeZone: "Europe/Berlin" })

  const monatsText = keys.map(key => {
    const rel = tickets.filter(t => (t.hw_abschluss_am ?? t.created_at).slice(0, 7) === key)
    const sum = rel.reduce((s, t) => s + (t.kosten_final ?? 0), 0)
    return rel.length === 0
      ? `im ${label(key)} nichts`
      : `im ${label(key)} ${euro(sum)} Euro aus ${rel.length} ${rel.length === 1 ? "Auftrag" : "Aufträgen"}`
  })

  let txt = `Dein Verlauf: ${monatsText.join(", ")}.`

  const angenommen = einl.filter(e => e.status === "angebot").length
  const abgelehnt = einl.filter(e => e.status === "abgelehnt").length
  const entschieden = angenommen + abgelehnt
  if (entschieden > 0) {
    const quote = Math.round((angenommen / entschieden) * 100)
    txt += ` Deine Annahmequote liegt bei ${quote} Prozent — du hast ${angenommen} von ${entschieden} beantworteten Anfragen angenommen.`
  }
  return txt
}

// ---------------------------------------------------------------------------
// Route-Handler
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Signatur-Prüfung. Ohne VAPI_WEBHOOK_SECRET im ENV nur warnen (dev-Modus).
  const secret = process.env.VAPI_WEBHOOK_SECRET
  const sig = request.headers.get("x-vapi-signature")
  if (secret) {
    if (!verifyVapiSignature(rawBody, sig, secret)) {
      console.warn("[vapi/hw-assistant] Ungültige Signatur abgelehnt")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  } else {
    console.warn("[vapi/hw-assistant] VAPI_WEBHOOK_SECRET nicht gesetzt — Signatur-Check übersprungen")
  }

  let payload: { message?: VapiMessage }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const msg = payload.message
  if (!msg) {
    // Vapi sendet manchmal leere Pings → 200 zurück
    return NextResponse.json({ ok: true })
  }

  // ---- 1. assistant-request — Assistent-Config zurückgeben ----
  if (msg.type === "assistant-request") {
    const callerPhone = msg.call.customer?.number ?? ""
    const hw = callerPhone ? await findHwByPhone(callerPhone) : null
    if (!hw) {
      console.log(`[vapi/hw-assistant] Unbekannte Nummer: ${callerPhone}`)
    }
    return NextResponse.json({ assistant: buildAssistantConfig(hw) })
  }

  // ---- 2. tool-calls — Daten aus Supabase liefern ----
  if (msg.type === "tool-calls") {
    // HW-Identifikation: bei Web-Calls (kein Telefon) über den hwId-Query-Param
    // der Tool-Server-URL; bei Telefon-Calls über die Caller-Nummer.
    const hwIdParam = request.nextUrl.searchParams.get("hwId")
    const callerPhone = msg.call.customer?.number ?? ""
    const hw = hwIdParam
      ? await findHwById(hwIdParam)
      : callerPhone
        ? await findHwByPhone(callerPhone)
        : null

    const results = await Promise.all(
      msg.toolCallList.map(async (tc) => {
        if (!hw) {
          return { toolCallId: tc.id, result: "Fehler: Kein Handwerker-Profil gefunden." }
        }

        let result = "Diese Funktion ist momentan nicht verfügbar."

        if (tc.function.name === "get_heutiges_briefing") {
          result = await getBriefingText(hw.id)
        } else if (tc.function.name === "get_offene_anfragen") {
          result = await getOffeneAnfragenText(hw.id)
        } else if (tc.function.name === "get_neue_anfragen_mit_empfehlung") {
          result = await getNeuAnfragenMitEmpfehlungText(hw.id)
        } else if (tc.function.name === "get_verdienst") {
          result = await getVerdienstText(hw.id)
        } else if (tc.function.name === "get_statistik") {
          result = await getStatistikText(hw.id)
        } else if (tc.function.name === "get_terminausblick") {
          result = await getTerminausblickText(hw.id)
        } else if (tc.function.name === "get_laufende_auftraege") {
          result = await getLaufendeAuftraegeText(hw.id)
        } else if (tc.function.name === "get_partner_status") {
          result = await getPartnerStatusText(hw.id)
        } else if (tc.function.name === "get_einstellungen") {
          result = await getEinstellungenText(hw.id)
        } else if (tc.function.name === "get_kontakt") {
          result = await getKontaktText(hw.id)
        } else if (tc.function.name === "get_top_segmente") {
          result = await getTopSegmenteText(hw.id)
        } else if (tc.function.name === "get_verlauf") {
          result = await getVerlaufText(hw.id)
        }

        return { toolCallId: tc.id, result }
      })
    )

    return NextResponse.json({ results })
  }

  // ---- 3. Alles andere (status-update, end-of-call-report) ----
  return NextResponse.json({ ok: true })
}
