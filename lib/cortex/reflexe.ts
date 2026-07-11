import type { SupabaseClient } from "@supabase/supabase-js"
import { vergebeTicketAutomatisch } from "@/lib/auction/auto-vergabe"
import { eskaliereDirektvergabe } from "@/lib/auction/direktvergabe"
import { emitEreignis } from "@/lib/cortex/ereignis"
import { sendEmail } from "@/lib/email/send"

// Cortex-Reflexe — die erste handelnde Stufe des Gehirns.
//
// Reflexe sind DETERMINISTISCHE Auto-Reparaturen: eng definiert, einzeln
// dokumentiert (Playbook), jede Ausführung im Journal, gekappt pro Lauf.
// Leitplanken (Charta §2): nichts Unumkehrbares, kein Geld — Reflexe
// stoßen bestehende, selbst abgesicherte Mechanik an (Auto-Vergabe mit
// Budget-Gate/Sicherheitsnetz) oder erinnern Menschen per Mail.
// Kill-Switch: CORTEX_REFLEXE_OFF=1.

const MEMO_DEFAULT = "lenn-dev@proton.me"

export interface ReflexErgebnis {
  name: string
  befunde: number
  aktionen: string[]
}

// ---------------------------------------------------------------
// Reflex 1: vergabe-anstossen
// Tickets, die >48h offen sind, ohne HW und ohne laufende Vergabe-Kette —
// die Auto-Vergabe ist beim Anlegen offenbar nie gestartet oder
// fehlgeschlagen. Der Reflex stößt sie erneut an. Mieter-Tickets laufen
// mit Sicherheitsnetz (nur Notfälle sofort), Verwalter-Tickets direkt —
// alle weiteren Leitplanken (Master-Schalter, Budget) greifen in der
// Engine selbst.
async function reflexVergabeAnstossen(admin: SupabaseClient): Promise<ReflexErgebnis> {
  const grenze = new Date(Date.now() - 48 * 3600_000).toISOString()
  const { data: tickets } = await admin
    .from("tickets")
    .select("id, titel, eingetragen_von_verwalter, kein_schaden")
    .eq("status", "offen")
    .is("zugewiesener_hw", null)
    .is("direktvergabe_kandidaten", null)
    .lt("created_at", grenze)
    .limit(3)

  const aktionen: string[] = []
  for (const t of tickets ?? []) {
    if (t.kein_schaden === true) continue // Verwaltungsanliegen: nie vergeben
    const ergebnis = await vergebeTicketAutomatisch(t.id, {
      nurNotfallSofort: !t.eingetragen_von_verwalter,
    })
    const resultat = ergebnis.ok
      ? (ergebnis.modus === "uebersprungen" ? `übersprungen (${ergebnis.grund})` : `angestoßen → ${ergebnis.modus}`)
      : `fehlgeschlagen (${ergebnis.grund})`
    aktionen.push(`${t.id.slice(0, 8)} "${t.titel}": ${resultat}`)
    emitEreignis(admin, {
      typ: "reflex_vergabe_angestossen",
      entitaet: "tickets",
      entitaetId: t.id,
      payload: { resultat },
    })
  }
  return { name: "vergabe-anstossen", befunde: (tickets ?? []).length, aktionen }
}

// ---------------------------------------------------------------
// Reflex 2: angebote-nudge
// Tickets, die seit >3 Tagen in 'angebote_da' stehen — Angebote liegen
// vor, aber niemand entscheidet. EINE Sammel-Mail an den Betreiber
// (kein Spam: pro Ticket höchstens alle 7 Tage, Dedupe über den
// Ereignisstrom).
async function reflexAngeboteNudge(admin: SupabaseClient): Promise<ReflexErgebnis> {
  const grenze = new Date(Date.now() - 3 * 86400_000).toISOString()
  const dedupeSeit = new Date(Date.now() - 7 * 86400_000).toISOString()

  const [{ data: tickets }, { data: schonGenudged }] = await Promise.all([
    admin
      .from("tickets")
      .select("id, titel, created_at, einsatzort_adresse")
      .eq("status", "angebote_da")
      .lt("created_at", grenze)
      .order("created_at", { ascending: true })
      .limit(15),
    admin
      .from("cortex_ereignisse")
      .select("entitaet_id")
      .eq("typ", "nudge_gesendet")
      .gte("erstellt_at", dedupeSeit),
  ])

  const bereits = new Set((schonGenudged ?? []).map(e => e.entitaet_id))
  const faellig = (tickets ?? []).filter(t => !bereits.has(t.id))
  if (faellig.length === 0) {
    return { name: "angebote-nudge", befunde: 0, aktionen: [] }
  }

  const zeilen = faellig.map(t => {
    const tage = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400_000)
    return `<li><strong>${t.titel}</strong> (${t.id.slice(0, 8)}) — seit ${tage} Tagen mit Angeboten, unentschieden${t.einsatzort_adresse ? ` · ${t.einsatzort_adresse}` : ""}</li>`
  }).join("")
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#2A2622;">
      <h2 style="margin:0 0 8px;">🧠 Cortex-Reflex: Angebote warten auf Entscheidung</h2>
      <p style="margin:0 0 12px;line-height:1.6;">Bei ${faellig.length} Auftrag/Aufträgen liegen Angebote vor, aber es wurde nicht vergeben:</p>
      <ul style="line-height:1.8;">${zeilen}</ul>
      <p style="margin:16px 0 0;line-height:1.6;">Entscheiden unter: Aufträge → Filter „angebote_da" bzw. Ticket-Detail → Angebote.</p>
      <p style="margin:20px 0 0;color:#8C857B;font-size:12px;">Reparo Cortex · Reflex angebote-nudge · erinnert höchstens alle 7 Tage pro Ticket.</p>
    </div>`

  const empfaenger = (process.env.CORTEX_MEMO_EMPFAENGER || MEMO_DEFAULT)
    .split(",").map(s => s.trim()).filter(Boolean)
  let gesendet = false
  for (const to of empfaenger) {
    const res = await sendEmail({
      to,
      subject: `🧠 Cortex-Reflex: ${faellig.length} Auftrag/Aufträge warten auf Vergabe-Entscheidung`,
      html,
    })
    gesendet = gesendet || res.success
  }
  if (gesendet) {
    for (const t of faellig) {
      emitEreignis(admin, { typ: "nudge_gesendet", entitaet: "tickets", entitaetId: t.id, payload: {} })
    }
  }
  return {
    name: "angebote-nudge",
    befunde: faellig.length,
    aktionen: gesendet ? [`Sammel-Nudge für ${faellig.length} Ticket(s) gesendet`] : ["Mail-Versand fehlgeschlagen"],
  }
}

// ---------------------------------------------------------------
// Reflex 3: direktvergabe-nachholen
// Audit-Fund 11.07.: Direktvergaben standen tagelang bei "Frist
// abgelaufen", weil der 5-Minuten-Eskalations-Cron (Netlify Schedule)
// nicht feuerte. Dieser Reflex holt verpasste Eskalationen nach — er
// nutzt exakt dieselbe, race-sichere Engine (eskaliereDirektvergabe)
// wie der Cron und ist damit ein redundanter zweiter Auslöseweg.
async function reflexDirektvergabeNachholen(admin: SupabaseClient): Promise<ReflexErgebnis> {
  const { data: tickets } = await admin
    .from("tickets")
    .select("id, titel, direktvergabe_angefragt_am, direktvergabe_timeout_min")
    .eq("status", "offen")
    .is("zugewiesener_hw", null)
    .not("direktvergabe_kandidaten", "is", null)
    .not("direktvergabe_angefragt_am", "is", null)
    .not("direktvergabe_timeout_min", "is", null)
    .limit(20)

  const jetzt = Date.now()
  const faellig = (tickets ?? []).filter(t =>
    new Date(t.direktvergabe_angefragt_am).getTime() +
      t.direktvergabe_timeout_min * 60_000 < jetzt,
  ).slice(0, 10)

  // Parallel, sonst reißen Google-Kalender-Checks pro Kandidat das
  // 10s-Netlify-Fenster. Tickets sind unabhängig, die Engine race-sicher.
  const aktionen = await Promise.all(faellig.map(async t => {
    try {
      const result = await eskaliereDirektvergabe(t.id)
      emitEreignis(admin, {
        typ: "reflex_eskalation_nachgeholt",
        entitaet: "tickets",
        entitaetId: t.id,
        payload: { ergebnis: result.ergebnis },
      })
      return `${t.id.slice(0, 8)} "${t.titel}": ${result.ergebnis}`
    } catch (err) {
      return `${t.id.slice(0, 8)} "${t.titel}": Fehler ${String(err)}`
    }
  }))
  return { name: "direktvergabe-nachholen", befunde: faellig.length, aktionen }
}

// ---------------------------------------------------------------
// Reflex 4: wachhund
// Ein Automatik-Produkt braucht einen Wächter für die Automatik: prüft
// (a) Direktvergaben, deren Frist seit >24h abgelaufen ist und die trotz
//     Cron UND Nachhol-Reflex nicht weitergeschaltet wurden, und
// (b) Cron-Heartbeats, die länger als das Doppelte ihres Intervalls
//     ausbleiben (Tabelle cron_heartbeats, gepflegt von lib/cron/auth.ts).
// Befund → EINE Alarm-Mail an den Betreiber, höchstens alle 24h
// (Dedupe über wachhund_alarm-Ereignisse).
// Erwartung = großzügig das Doppelte des Netlify-Schedules (Puffer für
// Deploys/Kaltstarts): 5-Min-Crons → 1h, stündliche → 3h, tägliche → 26h.
const HEARTBEAT_ERWARTUNG_STD: Record<string, number> = {
  "direktvergabe-eskalation": 1,
  "check-expired-auctions": 1,
  "ki-health": 2,
  "auto-freigabe": 3,
  "termin-reminder": 3,
  "cortex-reflexe": 26,
  "cortex-schlaf": 26,
  "abwicklungsfrist": 26,
  "bewertungs-reminder": 26,
  "stille-hw-reaktivierung": 26,
  "sichtbarkeits-recompute": 26,
  "hw-morgen-briefing": 26,
  "keep-alive": 26,
}

async function reflexWachhund(admin: SupabaseClient): Promise<ReflexErgebnis> {
  const jetzt = Date.now()
  const befunde: string[] = []

  // (a) Vergaben, die >24h nach Fristablauf immer noch hängen
  const { data: tickets } = await admin
    .from("tickets")
    .select("id, titel, direktvergabe_angefragt_am, direktvergabe_timeout_min")
    .eq("status", "offen")
    .is("zugewiesener_hw", null)
    .not("direktvergabe_angefragt_am", "is", null)
    .not("direktvergabe_timeout_min", "is", null)
    .limit(50)
  const haengend = (tickets ?? []).filter(t =>
    new Date(t.direktvergabe_angefragt_am).getTime() +
      t.direktvergabe_timeout_min * 60_000 + 24 * 3600_000 < jetzt,
  )
  if (haengend.length > 0) {
    befunde.push(`${haengend.length} Vergabe(n) hängen >24h nach Fristablauf: ${haengend.slice(0, 5).map(t => `"${t.titel}" (${t.id.slice(0, 8)})`).join(", ")}`)
  }

  // (b) Ausbleibende Cron-Heartbeats (Tabelle existiert ggf. noch nicht —
  // dann still überspringen, der Reflex darf nie werfen)
  const { data: herzschlaege, error: hbErr } = await admin
    .from("cron_heartbeats")
    .select("name, letzter_lauf")
  if (!hbErr) {
    const gesehen = new Set((herzschlaege ?? []).map(h => h.name))
    for (const [name, stunden] of Object.entries(HEARTBEAT_ERWARTUNG_STD)) {
      const eintrag = (herzschlaege ?? []).find(h => h.name === name)
      if (!eintrag) {
        if (gesehen.size > 0) befunde.push(`Cron "${name}" hat noch nie einen Heartbeat gemeldet`)
        continue
      }
      const alterStd = (jetzt - new Date(eintrag.letzter_lauf).getTime()) / 3600_000
      if (alterStd > stunden) {
        befunde.push(`Cron "${name}" lief zuletzt vor ${Math.round(alterStd)}h (erwartet: alle ${stunden}h)`)
      }
    }
  }

  if (befunde.length === 0) {
    return { name: "wachhund", befunde: 0, aktionen: [] }
  }

  // Dedupe: höchstens ein Alarm pro 24h
  const seit = new Date(jetzt - 24 * 3600_000).toISOString()
  const { data: schonAlarmiert } = await admin
    .from("cortex_ereignisse")
    .select("id")
    .eq("typ", "wachhund_alarm")
    .gte("erstellt_at", seit)
    .limit(1)
  if ((schonAlarmiert ?? []).length > 0) {
    return { name: "wachhund", befunde: befunde.length, aktionen: ["Alarm unterdrückt (bereits in den letzten 24h alarmiert)"] }
  }

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#2A2622;">
      <h2 style="margin:0 0 8px;">🚨 Cortex-Wachhund: Die Automatik stockt</h2>
      <ul style="line-height:1.8;">${befunde.map(b => `<li>${b}</li>`).join("")}</ul>
      <p style="margin:16px 0 0;line-height:1.6;">Erste Anlaufstellen: Netlify → Functions (laufen die Schedules?), Cockpit → „Reflexe ausführen" (holt Eskalationen nach), Supabase → cron_heartbeats.</p>
      <p style="margin:20px 0 0;color:#8C857B;font-size:12px;">Reparo Cortex · Reflex wachhund · alarmiert höchstens einmal pro 24h.</p>
    </div>`
  const empfaenger = (process.env.CORTEX_MEMO_EMPFAENGER || MEMO_DEFAULT)
    .split(",").map(s => s.trim()).filter(Boolean)
  let gesendet = false
  for (const to of empfaenger) {
    const res = await sendEmail({ to, subject: `🚨 Reparo-Wachhund: ${befunde.length} Automatik-Problem(e)`, html })
    gesendet = gesendet || res.success
  }
  if (gesendet) {
    emitEreignis(admin, { typ: "wachhund_alarm", entitaet: "system", payload: { befunde } })
  }
  return {
    name: "wachhund",
    befunde: befunde.length,
    aktionen: gesendet ? [`Alarm-Mail gesendet: ${befunde.join(" · ")}`] : ["Mail-Versand fehlgeschlagen"],
  }
}

// ---------------------------------------------------------------
const PLAYBOOKS = [
  {
    name: "reflex-vergabe-anstossen",
    beschreibung: "Tickets >48h offen ohne HW und ohne Vergabe-Kette: Auto-Vergabe erneut anstoßen (Mieter-Tickets mit Sicherheitsnetz). Max. 3 pro Lauf.",
    schritte: ["Hängende offene Tickets finden (>48h, kein HW, keine Kette, kein Verwaltungsanliegen)", "vergebeTicketAutomatisch anstoßen (Engine-Leitplanken greifen)", "Ergebnis in Journal + Ereignisstrom"],
  },
  {
    name: "reflex-angebote-nudge",
    beschreibung: "Tickets >3 Tage in angebote_da: eine Sammel-Erinnerung an den Betreiber, höchstens alle 7 Tage pro Ticket.",
    schritte: ["Unentschiedene angebote_da-Tickets finden", "Gegen nudge_gesendet-Ereignisse deduplizieren", "Eine Sammel-Mail senden", "nudge_gesendet je Ticket emittieren"],
  },
  {
    name: "reflex-direktvergabe-nachholen",
    beschreibung: "Direktvergaben mit abgelaufener Frist: Eskalation nachholen (redundanter zweiter Auslöseweg zum 5-Minuten-Cron). Max. 10 pro Lauf.",
    schritte: ["Tickets mit abgelaufener Direktvergabe-Frist finden", "eskaliereDirektvergabe je Ticket (race-sicher)", "Ergebnis in Journal + Ereignisstrom"],
  },
  {
    name: "reflex-wachhund",
    beschreibung: "Wächter für die Automatik: hängende Vergaben >24h nach Fristablauf und ausbleibende Cron-Heartbeats → Alarm-Mail an den Betreiber (max. 1×/24h).",
    schritte: ["Vergaben >24h über Frist finden", "cron_heartbeats gegen erwartete Intervalle prüfen", "Gegen wachhund_alarm-Ereignisse deduplizieren", "Alarm-Mail senden"],
  },
]

export async function reflexeAusfuehren(admin: SupabaseClient): Promise<{
  ok: boolean
  uebersprungen?: string
  reflexe?: ReflexErgebnis[]
}> {
  if (process.env.CORTEX_REFLEXE_OFF === "1" || process.env.CORTEX_OFF === "1") {
    return { ok: true, uebersprungen: "CORTEX_REFLEXE_OFF/CORTEX_OFF" }
  }

  // Playbooks sichtbar halten (idempotent)
  for (const p of PLAYBOOKS) {
    await admin.from("cortex_playbooks").upsert(
      { name: p.name, beschreibung: p.beschreibung, schritte: p.schritte, aktiv: true },
      { onConflict: "name" },
    )
  }

  const reflexe: ReflexErgebnis[] = []
  const registry: Array<[string, (a: SupabaseClient) => Promise<ReflexErgebnis>]> = [
    ["direktvergabe-nachholen", reflexDirektvergabeNachholen],
    ["vergabe-anstossen", reflexVergabeAnstossen],
    ["angebote-nudge", reflexAngeboteNudge],
    ["wachhund", reflexWachhund],
  ]
  for (const [name, reflex] of registry) {
    try {
      reflexe.push(await reflex(admin))
    } catch (err) {
      reflexe.push({ name, befunde: -1, aktionen: [`Fehler: ${String(err)}`] })
    }
  }

  await admin.from("cortex_entscheidungen").insert({
    typ: "reflex",
    ausloeser: "cron",
    begruendung: reflexe.map(r =>
      `${r.name}: ${r.befunde} Befund(e)${r.aktionen.length ? ` — ${r.aktionen.join("; ")}` : ""}`,
    ).join("\n"),
    ergebnis: { reflexe },
  })

  return { ok: true, reflexe }
}
