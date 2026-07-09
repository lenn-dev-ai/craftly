import type { SupabaseClient } from "@supabase/supabase-js"

// App-seitige Ereignis-Emission in den Cortex-Ereignisstrom.
//
// Ergänzt (bzw. überbrückt bis zur Freigabe) die DB-Trigger aus
// Migration 20260709000010 Teil B: Server-Code meldet Geschehnisse
// mit quelle='app'. Best-effort und fire-and-forget — ein Fehler im
// Gehirn darf das Geschäft nie blockieren (Charta §1).

export function emitEreignis(
  admin: SupabaseClient,
  ereignis: {
    typ: string
    entitaet?: string
    entitaetId?: string
    payload?: Record<string, unknown>
  },
): void {
  void admin
    .from("cortex_ereignisse")
    .insert({
      quelle: "app",
      typ: ereignis.typ,
      entitaet: ereignis.entitaet ?? null,
      entitaet_id: ereignis.entitaetId ?? null,
      payload: ereignis.payload ?? {},
    })
    .then(({ error }) => {
      if (error) console.warn("[cortex] emit fehlgeschlagen:", error.message)
    })
}
