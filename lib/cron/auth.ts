import crypto from "crypto"
import type { NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { createServiceRoleClient } from "@/lib/supabase-server"

// Konsolidierung (Audit 11.07.): EIN Auth-Pfad für alle Cron-Routen.
//
// Regeln:
// - Cron-Pfad (x-cron-secret-Header vorhanden): fail-closed. Ohne
//   konfiguriertes CRON_SECRET wird NIE durchgelassen (503), der Vergleich
//   ist timing-safe (kein Byte-für-Byte-Abbruch wie bei !==).
// - Admin-Pfad (kein Header): eingeloggter Admin darf jeden Cron manuell
//   auslösen (Cockpit / Debugging).

export type CronAuthErgebnis =
  | { ok: true; via: "secret" | "admin" }
  | { ok: false; status: number; error: string }

function sicherGleich(a: string, b: string): boolean {
  // Über SHA-256 normalisieren: timingSafeEqual verlangt gleiche Länge,
  // und der Hash verrät nichts über die Länge des echten Secrets.
  const ha = crypto.createHash("sha256").update(a).digest()
  const hb = crypto.createHash("sha256").update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

export async function pruefeCronAuth(request: NextRequest): Promise<CronAuthErgebnis> {
  const geliefert = request.headers.get("x-cron-secret")

  if (geliefert !== null) {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      return { ok: false, status: 503, error: "CRON_SECRET nicht konfiguriert" }
    }
    if (sicherGleich(geliefert, secret)) return { ok: true, via: "secret" }
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return { ok: false, status: 401, error: "Unauthorized" }
  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single()
  if (profile?.rolle !== "admin") {
    return { ok: false, status: 403, error: "Forbidden" }
  }
  return { ok: true, via: "admin" }
}

// Heartbeat: eine Zeile pro Cron, bei jedem Lauf geupsertet. Damit ist
// "Scheduler tot" (Audit-Fund: Netlify-Schedules feuerten tagelang nicht)
// per SQL/Cortex sichtbar: letzter_lauf älter als das Intervall = Alarm.
// Fire-and-forget + fehlerschluckend — ein fehlender Table (Migration
// noch nicht angewandt) darf den Cron nie blockieren.
export function meldeCronHeartbeat(name: string, via: "secret" | "admin"): void {
  try {
    const admin = createServiceRoleClient()
    void admin
      .from("cron_heartbeats")
      .upsert(
        { name, letzter_lauf: new Date().toISOString(), via },
        { onConflict: "name" },
      )
      .then(({ error }) => {
        if (error) console.warn("[cron] Heartbeat fehlgeschlagen:", name, error.message)
      })
  } catch (err) {
    console.warn("[cron] Heartbeat fehlgeschlagen:", name, err)
  }
}

// Begrenzte Parallelität für Cron-Schleifen (Audit-Fund: sequenzielle
// Verarbeitung sprengt das Netlify-10s-Limit ab ~10 Elementen).
// Verarbeitet alle Elemente, sammelt Fehler statt zu werfen.
export async function mitParallelitaet<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<Array<{ item: T; ok: true; wert: R } | { item: T; ok: false; fehler: string }>> {
  const ergebnisse: Array<{ item: T; ok: true; wert: R } | { item: T; ok: false; fehler: string }> = []
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      const item = items[index]
      try {
        const wert = await fn(item, index)
        ergebnisse[index] = { item, ok: true, wert }
      } catch (err) {
        ergebnisse[index] = { item, ok: false, fehler: err instanceof Error ? err.message : String(err) }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return ergebnisse
}
