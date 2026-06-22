import type { createServiceRoleClient } from "@/lib/supabase-server"

// KI-Health-Monitoring (Strategie-Schritt: "nie wieder ein stiller KI-Ausfall")
//
// Prüft die KI-/Automatik-Pfade, die erfahrungsgemäß LAUTLOS sterben:
//   - vapi      → nehmen die Telefon-Anrufe wirklich einen Assistenten an?
//                 (heute: nova-2-phonecall+de → Vapi lehnt Config still ab →
//                  Anruf ohne Assistent, leeres Transcript, Kosten 0)
//   - anthropic → ist der LLM-Key überhaupt gesetzt? (Foto-Prescan,
//                 Schadenserkennung, HW-Empfehlung, Voice hängen daran)
//   - dispatch  → bleibt die Vergabe-Engine hängen? (Auktionen über Ende
//                 hinaus offen, Direktvergaben jenseits ihres Timeouts)
//
// Defensiv gebaut: jede Prüfung fängt eigene Fehler ab und meldet sie als
// "nicht ok" mit Grund — nie ein throw, der den Aufrufer (Cron/Health-API)
// abbrechen würde.

export interface KiCheck {
  ok: boolean
  /** Menschenlesbarer Grund bei Problem (oder Status-Hinweis). */
  reason?: string
  /** Optionale Roh-Kennzahlen fürs Debugging. */
  detail?: Record<string, unknown>
}

export interface KiHealthReport {
  ok: boolean
  vapi: KiCheck
  anthropic: KiCheck
  dispatch: KiCheck
  /** Nur die roten Befunde, fertig für Log/Mail-Alert. */
  probleme: string[]
  timestamp: string
}

type AdminClient = ReturnType<typeof createServiceRoleClient>

const VAPI_BASE = "https://api.vapi.ai"

interface VapiCallLite {
  type?: string
  status?: string
  createdAt?: string
  endedReason?: string
  cost?: number
  transcript?: string
}

/**
 * Vapi-Check: holt die letzten Anrufe und erkennt "stille Ablehnungen" —
 * eingehende, beendete Anrufe ohne Transcript UND mit Kosten 0 = es hat nie
 * ein Assistent gesprochen (genau das heutige Symptom).
 */
async function checkVapi(): Promise<KiCheck> {
  const key = process.env.VAPI_API_KEY
  if (!key) return { ok: false, reason: "VAPI_API_KEY nicht gesetzt" }

  try {
    const res = await fetch(`${VAPI_BASE}/call?limit=20`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) {
      return { ok: false, reason: `Vapi-API HTTP ${res.status}` }
    }
    const json = (await res.json()) as VapiCallLite[] | { results?: VapiCallLite[] }
    const calls = Array.isArray(json) ? json : json.results ?? []

    const seit = Date.now() - 24 * 3_600_000
    const letzte = calls.filter(
      c => c.type === "inboundPhoneCall" && c.createdAt && new Date(c.createdAt).getTime() >= seit,
    )
    if (letzte.length === 0) {
      return { ok: true, reason: "Keine eingehenden Anrufe in den letzten 24 h", detail: { inbound24h: 0 } }
    }

    // "still gescheitert": beendet, leeres Transcript, keine Kosten.
    const stillGescheitert = letzte.filter(
      c => c.status === "ended" && !c.transcript && (c.cost ?? 0) === 0,
    )
    const quote = stillGescheitert.length / letzte.length
    const detail = {
      inbound24h: letzte.length,
      stillGescheitert: stillGescheitert.length,
      letzterGrund: letzte[0]?.endedReason,
    }

    // Wenn die Mehrheit der jüngsten Anrufe lautlos floppt → Alarm.
    if (quote >= 0.5) {
      return {
        ok: false,
        reason: `${stillGescheitert.length}/${letzte.length} Anrufe ohne Assistent (stille Vapi-Ablehnung?)`,
        detail,
      }
    }
    return { ok: true, detail }
  } catch (err) {
    return { ok: false, reason: `Vapi-API nicht erreichbar: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/** Anthropic-Check: Key gesetzt? (Reachability-Ping würde pro Lauf Tokens kosten.) */
function checkAnthropic(): KiCheck {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "ANTHROPIC_API_KEY nicht gesetzt — Foto-Prescan/Schadenserkennung/Voice fallen aus" }
  }
  return { ok: true }
}

/**
 * Dispatch-Check: hängt die Vergabe-Engine? Zwei Stall-Signale:
 *   1. Auktionen, deren Ende > 1 h zurückliegt, aber noch im Status "auktion"
 *      (der check-expired-auctions-Cron hätte sie schließen müssen).
 *   2. Direktvergaben, die > 26 h angefragt sind, aber nie zugewiesen wurden
 *      (Eskalations-Cron hängt — 26 h > längster Timeout planbar 24 h + Puffer).
 */
async function checkDispatch(admin: AdminClient): Promise<KiCheck> {
  try {
    const jetzt = Date.now()
    const vor1h = new Date(jetzt - 3_600_000).toISOString()
    const vor26h = new Date(jetzt - 26 * 3_600_000).toISOString()

    const { count: haengendeAuktionen } = await admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "auktion")
      .lt("auktion_ende", vor1h)

    const { count: haengendeDirektvergaben } = await admin
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .not("direktvergabe_angefragt_am", "is", null)
      .lt("direktvergabe_angefragt_am", vor26h)
      .is("zugewiesener_hw", null)
      .in("status", ["offen", "auktion"])

    const a = haengendeAuktionen ?? 0
    const d = haengendeDirektvergaben ?? 0
    const detail = { haengendeAuktionen: a, haengendeDirektvergaben: d }

    if (a + d > 0) {
      const teile: string[] = []
      if (a > 0) teile.push(`${a} überfällige Auktion${a === 1 ? "" : "en"}`)
      if (d > 0) teile.push(`${d} hängende Direktvergabe${d === 1 ? "" : "n"}`)
      return { ok: false, reason: teile.join(", "), detail }
    }
    return { ok: true, detail }
  } catch (err) {
    // Fehlende Spalten o.ä. → kein harter Fehler, nur Hinweis.
    return { ok: true, reason: `Dispatch-Check übersprungen: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/** Führt alle KI-Health-Checks aus und fasst sie zu einem Report zusammen. */
export async function pruefeKiGesundheit(admin: AdminClient): Promise<KiHealthReport> {
  const [vapi, dispatch] = await Promise.all([checkVapi(), checkDispatch(admin)])
  const anthropic = checkAnthropic()

  const probleme: string[] = []
  if (!vapi.ok) probleme.push(`Voice/Vapi: ${vapi.reason ?? "Problem"}`)
  if (!anthropic.ok) probleme.push(`LLM/Anthropic: ${anthropic.reason ?? "Problem"}`)
  if (!dispatch.ok) probleme.push(`Vergabe: ${dispatch.reason ?? "Problem"}`)

  return {
    ok: probleme.length === 0,
    vapi,
    anthropic,
    dispatch,
    probleme,
    timestamp: new Date().toISOString(),
  }
}
