import Anthropic from "@anthropic-ai/sdk"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CORTEX_CHARTA } from "@/lib/cortex/charta"
import { erinnern, merken } from "@/lib/cortex/gedaechtnis"
import { sendEmail } from "@/lib/email/send"

// Cortex-Deliberation — der Schlaf-Zyklus.
//
// Sammelt die Signale der letzten 24h (Ereignisstrom, hängende Vergaben,
// offenes Feedback, KPIs), ruft relevante Erinnerungen ab, denkt einmal
// gründlich nach (Claude) und hinterlässt: Erkenntnisse im Gedächtnis,
// einen Journal-Eintrag mit Begründung + Token-Kosten, und ein Memo per
// Mail an den Betreiber.
//
// Leitplanken (Charta §2/§5): führt selbst NICHTS aus — nur beobachten,
// merken, melden. Ventile: CORTEX_OFF=1 (Kill-Switch), CORTEX_MODEL,
// CORTEX_MEMO_EMPFAENGER (Komma-Liste; Default lenn-dev@proton.me).

const DEFAULT_MODEL = "claude-haiku-4-5"
const MEMO_DEFAULT = "lenn-dev@proton.me"

interface SchlafErgebnis {
  ok: boolean
  uebersprungen?: string
  memoGesendet?: boolean
  erkenntnisse?: number
  ereignisseVerarbeitet?: number
  fehler?: string
}

interface KiAusgabe {
  memo: string
  erkenntnisse: Array<{
    typ: "episodisch" | "semantisch" | "prozedural"
    inhalt: string
    wichtigkeit: number
  }>
  handlungsbedarf: Array<{ prioritaet: "hoch" | "mittel" | "niedrig"; text: string }>
}

async function sammleKontext(admin: SupabaseClient) {
  const seit = new Date(Date.now() - 24 * 3600_000).toISOString()

  const [ereignisse, feedback, haengend, kpis, reflexJournal] = await Promise.all([
    admin
      .from("cortex_ereignisse")
      .select("id, typ, entitaet_id, payload, erstellt_at")
      .eq("verarbeitet", false)
      .order("erstellt_at", { ascending: true })
      .limit(200),
    admin
      .from("feedback")
      .select("id, rolle, text, kontext_url, created_at")
      .gte("created_at", seit)
      .limit(20),
    admin
      .from("tickets")
      .select("id, titel, status, prioritaet, created_at, direktvergabe_angefragt_am, direktvergabe_timeout_min")
      .in("status", ["offen", "auktion", "angebote_da"])
      .is("zugewiesener_hw", null)
      .order("created_at", { ascending: true })
      .limit(40),
    admin.rpc("admin_get_action_items", { p_limit: 20 }).then(
      r => r,
      () => ({ data: null, error: null }),
    ),
    admin
      .from("cortex_entscheidungen")
      .select("begruendung, erstellt_at")
      .eq("typ", "reflex")
      .gte("erstellt_at", seit)
      .order("erstellt_at", { ascending: false })
      .limit(3),
  ])

  // Ereignisse kompakt aggregieren (Typ → Anzahl) + die letzten 30 im Detail
  const alle = ereignisse.data ?? []
  const proTyp: Record<string, number> = {}
  for (const e of alle) proTyp[e.typ] = (proTyp[e.typ] ?? 0) + 1
  const detail = alle.slice(-30).map(e =>
    `${String(e.erstellt_at).slice(5, 16)} ${e.typ}: ${JSON.stringify(e.payload).slice(0, 140)}`,
  )

  // Hängende Vergaben: Direktvergabe-Frist überschritten oder >48h offen
  const jetzt = Date.now()
  const haengende = (haengend.data ?? []).filter(t => {
    if (t.direktvergabe_angefragt_am && t.direktvergabe_timeout_min) {
      return jetzt - new Date(t.direktvergabe_angefragt_am).getTime() >
        t.direktvergabe_timeout_min * 60_000
    }
    return jetzt - new Date(t.created_at).getTime() > 48 * 3600_000
  })

  return {
    ereignisIds: alle.map(e => e.id),
    kontextText: [
      `EREIGNISSE (unverarbeitet, ${alle.length} gesamt): ${JSON.stringify(proTyp)}`,
      detail.length ? `LETZTE EREIGNISSE:\n${detail.join("\n")}` : "",
      haengende.length
        ? `HÄNGENDE VERGABEN (${haengende.length}):\n${haengende.map(t => `- ${t.id.slice(0, 8)} "${t.titel}" (${t.status}, seit ${String(t.created_at).slice(0, 10)})`).join("\n")}`
        : "HÄNGENDE VERGABEN: keine",
      (feedback.data ?? []).length
        ? `NEUES FEEDBACK:\n${(feedback.data ?? []).map(f => `- [${f.rolle}] ${String(f.text).slice(0, 200)}`).join("\n")}`
        : "NEUES FEEDBACK: keins",
      Array.isArray(kpis.data) && kpis.data.length
        ? `OFFENE ACTION-ITEMS (Mission Control): ${JSON.stringify(kpis.data).slice(0, 800)}`
        : "",
      (reflexJournal.data ?? []).length
        ? `DEINE REFLEXE (letzte 24h — bereits ausgeführte Auto-Reparaturen):\n${(reflexJournal.data ?? []).map(r => String(r.begruendung).slice(0, 300)).join("\n")}`
        : "",
    ].filter(Boolean).join("\n\n"),
  }
}

export async function schlafZyklus(admin: SupabaseClient): Promise<SchlafErgebnis> {
  if (process.env.CORTEX_OFF === "1") {
    return { ok: true, uebersprungen: "CORTEX_OFF=1" }
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, fehler: "ANTHROPIC_API_KEY fehlt" }
  }

  const modell = process.env.CORTEX_MODEL || DEFAULT_MODEL
  const { ereignisIds, kontextText } = await sammleKontext(admin)

  // Erinnerungen zum Tagesgeschehen abrufen (Kontext fürs Denken)
  const erinnerungen = await erinnern(admin, kontextText.slice(0, 1500), 6)
  const erinnerungsText = erinnerungen.length
    ? `DEINE ERINNERUNGEN (frühere Erkenntnisse):\n${erinnerungen.map(e => `- [${e.typ}, W${e.wichtigkeit}] ${e.inhalt}`).join("\n")}`
    : "DEINE ERINNERUNGEN: noch keine."

  const anthropic = new Anthropic()
  let ausgabe: KiAusgabe
  let tokensIn = 0
  let tokensOut = 0
  try {
    const msg = await anthropic.messages.create({
      model: modell,
      max_tokens: 1500,
      system: CORTEX_CHARTA,
      messages: [{
        role: "user",
        content: `Schlaf-Zyklus ${new Date().toISOString().slice(0, 10)}. Konsolidiere den Tag.

${kontextText.slice(0, 9000)}

${erinnerungsText}

Antworte AUSSCHLIESSLICH als valides JSON (kein Markdown-Codeblock):
{
  "memo": "Kurzes Betreiber-Memo in Markdown: Lage in 2-4 Sätzen, dann max. 5 Bullet-Points mit dem Wichtigsten (Zahlen, IDs) und je einem nächsten Schritt.",
  "erkenntnisse": [{ "typ": "episodisch|semantisch|prozedural", "inhalt": "eine gelernte, evidenzgedeckte Erkenntnis (1-2 Sätze, mit Zahl/ID)", "wichtigkeit": 1-5 }],
  "handlungsbedarf": [{ "prioritaet": "hoch|mittel|niedrig", "text": "konkrete Empfehlung" }]
}
Max. 3 Erkenntnisse — nur was wirklich zukünftig nützt. Leere Arrays sind erlaubt.`,
      }],
    })
    tokensIn = msg.usage.input_tokens
    tokensOut = msg.usage.output_tokens
    const text = msg.content.find(c => c.type === "text")
    if (!text || text.type !== "text") throw new Error("keine Text-Antwort")
    const raw = text.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim()
    ausgabe = JSON.parse(raw) as KiAusgabe
  } catch (err) {
    await admin.from("cortex_entscheidungen").insert({
      typ: "schlaf",
      ausloeser: "cron",
      begruendung: "Deliberation fehlgeschlagen",
      ergebnis: { fehler: String(err) },
      modell,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
    })
    return { ok: false, fehler: String(err) }
  }

  // Erkenntnisse ins Gedächtnis (Charta §3: sparsam)
  const erkenntnisse = (ausgabe.erkenntnisse ?? []).slice(0, 3)
  for (const e of erkenntnisse) {
    await merken(admin, {
      typ: e.typ,
      inhalt: e.inhalt,
      wichtigkeit: Math.min(5, Math.max(1, e.wichtigkeit ?? 3)),
      quelle: "schlaf-zyklus",
    })
  }

  // Memo an den Betreiber. Modell-Ausgaben HTML-escapen — sie sind
  // vertrauenswürdig, aber ein zufälliges "<" darf das Layout nicht brechen.
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const empfaenger = (process.env.CORTEX_MEMO_EMPFAENGER || MEMO_DEFAULT)
    .split(",").map(s => s.trim()).filter(Boolean)
  const handlungsHtml = (ausgabe.handlungsbedarf ?? []).map(h =>
    `<li><strong>[${esc(h.prioritaet)}]</strong> ${esc(h.text)}</li>`,
  ).join("")
  const memoHtml = `
    <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#2A2622;">
      <h2 style="margin:0 0 4px;">🧠 Cortex-Memo</h2>
      <p style="margin:0 0 16px;color:#8C857B;font-size:13px;">${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })} · Modell ${modell} · ${tokensIn}/${tokensOut} Tokens</p>
      <div style="white-space:pre-wrap;line-height:1.6;">${esc(ausgabe.memo)}</div>
      ${handlungsHtml ? `<h3 style="margin:20px 0 8px;">Handlungsbedarf</h3><ul style="line-height:1.7;">${handlungsHtml}</ul>` : ""}
      <p style="margin:24px 0 0;color:#8C857B;font-size:12px;">Reparo Cortex · Schlaf-Zyklus · beobachtet, merkt, meldet — führt nichts selbst aus.</p>
    </div>`
  let memoGesendet = false
  for (const to of empfaenger) {
    const res = await sendEmail({
      to,
      subject: `🧠 Cortex-Memo ${new Date().toISOString().slice(0, 10)}`,
      html: memoHtml,
    })
    memoGesendet = memoGesendet || res.success
  }

  // Journal + Ereignisse als verarbeitet markieren
  await admin.from("cortex_entscheidungen").insert({
    typ: "schlaf",
    ausloeser: "cron",
    begruendung: ausgabe.memo.slice(0, 2000),
    ergebnis: {
      erkenntnisse,
      handlungsbedarf: ausgabe.handlungsbedarf ?? [],
      memo_gesendet: memoGesendet,
      empfaenger,
      ereignisse: ereignisIds.length,
    },
    modell,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
  })
  if (ereignisIds.length > 0) {
    await admin
      .from("cortex_ereignisse")
      .update({ verarbeitet: true })
      .in("id", ereignisIds)
  }

  return {
    ok: true,
    memoGesendet,
    erkenntnisse: erkenntnisse.length,
    ereignisseVerarbeitet: ereignisIds.length,
  }
}
