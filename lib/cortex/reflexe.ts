import type { SupabaseClient } from "@supabase/supabase-js"
import { vergebeTicketAutomatisch } from "@/lib/auction/auto-vergabe"
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
  for (const reflex of [reflexVergabeAnstossen, reflexAngeboteNudge]) {
    try {
      reflexe.push(await reflex(admin))
    } catch (err) {
      reflexe.push({ name: reflex.name, befunde: -1, aktionen: [`Fehler: ${String(err)}`] })
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
