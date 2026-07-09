// Cortex-Embedding — Supabase Edge Function (Deno).
// Erzeugt 384-dim gte-small-Embeddings für das Cortex-Gedächtnis.
// Läuft kostenlos in der Supabase-Edge-Runtime (Supabase.ai), kein
// externer API-Call. Aufruf server-seitig mit Service-Role-Key.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — Deno-Runtime, wird nicht vom Next-tsc geprüft.
const session = new Supabase.ai.Session("gte-small")

Deno.serve(async (req: Request) => {
  try {
    const { text } = await req.json()
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text erforderlich" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }
    const embedding = await session.run(text.slice(0, 4000), {
      mean_pool: true,
      normalize: true,
    })
    return new Response(JSON.stringify({ embedding }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
