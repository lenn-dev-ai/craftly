import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { vergebeTicketAutomatisch } from "@/lib/auction/auto-vergabe"

// POST /api/cron/auto-freigabe (Sprint BD)
//
// Auto-Freigabe für Mieter-Tickets, die das "Sicherheitsnetz" zurückhält.
// Mieter-Meldungen mit Dringlichkeit zeitnah/planbar starten nicht sofort,
// sondern warten auf die Verwalter-Freigabe. Setzt der Verwalter in seinen
// Präferenzen auto_freigabe_stunden, übernimmt dieser Cron die Freigabe
// nach Ablauf der Frist automatisch — der Verwalter bleibt passiv.
//
// Läuft regelmäßig (netlify/functions/auto-freigabe.mts): findet je
// Verwalter mit gesetztem auto_freigabe_stunden dessen offene,
// unzugewiesene Tickets ohne laufende Vergabe, die älter als die Frist
// sind, und ruft vergebeTicketAutomatisch() ohne Sicherheitsnetz auf.
// Budget-Grenze + Master-Schalter werden dort weiterhin respektiert.

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authViaSecret =
    !!cronSecret && request.headers.get("x-cron-secret") === cronSecret

  if (!authViaSecret) {
    const { supabase, user } = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("rolle").eq("id", user.id).single()
    if (profile?.rolle !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createServiceRoleClient()

  // Verwalter mit aktivierter Auto-Freigabe (Frist gesetzt + Master an).
  const { data: verwalter, error: vErr } = await admin
    .from("profiles")
    .select("id, auto_freigabe_stunden, auto_vergabe_aktiv")
    .eq("rolle", "verwalter")
    .not("auto_freigabe_stunden", "is", null)
    .returns<Array<{ id: string; auto_freigabe_stunden: number | null; auto_vergabe_aktiv: boolean | null }>>()

  if (vErr) return NextResponse.json({ error: "Query verwalter: " + vErr.message }, { status: 500 })

  const jetzt = Date.now()
  let geprueft = 0
  let freigegeben = 0
  const ergebnisse: Array<{ ticketId: string; modus: string; grund?: string }> = []

  for (const v of verwalter ?? []) {
    if (v.auto_vergabe_aktiv === false) continue
    const stunden = v.auto_freigabe_stunden
    if (stunden == null || stunden < 0) continue
    const grenze = new Date(jetzt - stunden * 3_600_000).toISOString()

    // Wartende Tickets dieses Verwalters: offen, unzugewiesen, keine
    // Vergabe-Kette aktiv, älter als die Freigabe-Frist.
    const { data: tickets } = await admin
      .from("tickets")
      .select("id")
      .eq("verwalter_id", v.id)
      .eq("status", "offen")
      .is("zugewiesener_hw", null)
      .is("direktvergabe_kandidaten", null)
      .lte("created_at", grenze)
      .returns<Array<{ id: string }>>()

    for (const t of tickets ?? []) {
      geprueft++
      try {
        const res = await vergebeTicketAutomatisch(t.id)
        ergebnisse.push({ ticketId: t.id, modus: res.ok ? res.modus : "fehler", grund: res.grund })
        if (res.ok && res.modus !== "uebersprungen") freigegeben++
      } catch (err) {
        console.error("[Cron] auto-freigabe fehlgeschlagen für Ticket", t.id, err)
        ergebnisse.push({ ticketId: t.id, modus: "error" })
      }
    }
  }

  return NextResponse.json({ ok: true, geprueft, freigegeben, ergebnisse })
}
