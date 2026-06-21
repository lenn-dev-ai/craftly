import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// GET /api/admin/activity
// Sprint AH — 24h-Aktivitäts-Snapshot (mit Delta zu vorigen 24h).
// Sprint AU Fix F22: RPC admin_activity_24h() existiert nicht in DB —
// direkte Supabase-Queries als Ersatz.

export async function GET(request: NextRequest) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: prof } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single<{ rolle: string }>()
  if (prof?.rolle !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  const now = new Date()
  const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const h48ago = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

  const [
    { count: ticketNow },  { count: ticketPrev },
    { count: vergebenNow },{ count: vergebenPrev },
    { count: erledigtNow },{ count: erledigtPrev },
    { count: hwNow },      { count: hwPrev },
  ] = await Promise.all([
    admin.from("tickets").select("*", { count: "exact", head: true }).gte("created_at", h24ago),
    admin.from("tickets").select("*", { count: "exact", head: true }).gte("created_at", h48ago).lt("created_at", h24ago),
    // tickets hat kein updated_at — als Vergabe-/Abschluss-Zeitstempel die
    // tatsächlich vorhandenen Spalten nutzen: direktvergabe_angefragt_am (vergeben)
    // bzw. hw_abschluss_am (erledigt). Näherung für den Admin-Snapshot.
    admin.from("tickets").select("*", { count: "exact", head: true }).eq("status", "in_bearbeitung").gte("direktvergabe_angefragt_am", h24ago),
    admin.from("tickets").select("*", { count: "exact", head: true }).eq("status", "in_bearbeitung").gte("direktvergabe_angefragt_am", h48ago).lt("direktvergabe_angefragt_am", h24ago),
    admin.from("tickets").select("*", { count: "exact", head: true }).eq("status", "erledigt").gte("hw_abschluss_am", h24ago),
    admin.from("tickets").select("*", { count: "exact", head: true }).eq("status", "erledigt").gte("hw_abschluss_am", h48ago).lt("hw_abschluss_am", h24ago),
    admin.from("profiles").select("*", { count: "exact", head: true }).eq("rolle", "handwerker").gte("created_at", h24ago),
    admin.from("profiles").select("*", { count: "exact", head: true }).eq("rolle", "handwerker").gte("created_at", h48ago).lt("created_at", h24ago),
  ])

  return NextResponse.json({
    neue_tickets: { jetzt: ticketNow  ?? 0, delta24h: (ticketNow  ?? 0) - (ticketPrev  ?? 0) },
    vergeben:     { jetzt: vergebenNow ?? 0, delta24h: (vergebenNow ?? 0) - (vergebenPrev ?? 0) },
    erledigt:     { jetzt: erledigtNow ?? 0, delta24h: (erledigtNow ?? 0) - (erledigtPrev ?? 0) },
    neue_hw:      { jetzt: hwNow      ?? 0, delta24h: (hwNow      ?? 0) - (hwPrev      ?? 0) },
  }, { headers: { "Cache-Control": "no-store" } })
}
