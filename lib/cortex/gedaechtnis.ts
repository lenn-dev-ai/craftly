import type { SupabaseClient } from "@supabase/supabase-js"

// Cortex-Gedächtnis — merken & erinnern.
//
// Embeddings kommen aus der Supabase-Edge-Function `cortex-embed`
// (gte-small, 384-dim, kostenlos in der Edge-Runtime). Fällt sie aus,
// wird ohne Embedding gespeichert und die Erinnerung läuft über die
// deutsche Volltextsuche (tsvector) — das Gedächtnis ist nie blockiert.

export type GedaechtnisTyp = "episodisch" | "semantisch" | "prozedural"

export interface Erinnerung {
  id: string
  typ: string
  inhalt: string
  wichtigkeit: number
}

async function embedde(text: string): Promise<number[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  try {
    const res = await fetch(`${url}/functions/v1/cortex-embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json() as { embedding?: number[] }
    return Array.isArray(data.embedding) && data.embedding.length === 384
      ? data.embedding
      : null
  } catch {
    return null
  }
}

export async function merken(
  admin: SupabaseClient,
  eintrag: {
    typ: GedaechtnisTyp
    inhalt: string
    kontext?: Record<string, unknown>
    wichtigkeit?: number
    quelle?: string
  },
): Promise<void> {
  const embedding = await embedde(eintrag.inhalt)
  const { error } = await admin.from("cortex_gedaechtnis").insert({
    typ: eintrag.typ,
    inhalt: eintrag.inhalt,
    kontext: eintrag.kontext ?? {},
    wichtigkeit: eintrag.wichtigkeit ?? 3,
    quelle: eintrag.quelle ?? null,
    embedding,
  })
  if (error) console.warn("[cortex] merken fehlgeschlagen:", error.message)
}

export async function erinnern(
  admin: SupabaseClient,
  frage: string,
  limit = 6,
): Promise<Erinnerung[]> {
  // 1. Semantisch (wenn Embedding verfügbar)
  const embedding = await embedde(frage)
  if (embedding) {
    const { data, error } = await admin.rpc("cortex_erinnern", {
      p_embedding: embedding,
      p_limit: limit,
    })
    if (!error && Array.isArray(data) && data.length > 0) {
      return data as Erinnerung[]
    }
  }
  // 2. Fallback: deutsche Volltextsuche
  const { data } = await admin
    .from("cortex_gedaechtnis")
    .select("id, typ, inhalt, wichtigkeit")
    .textSearch("such", frage, { type: "websearch", config: "german" })
    .order("wichtigkeit", { ascending: false })
    .limit(limit)
  return (data ?? []) as Erinnerung[]
}
