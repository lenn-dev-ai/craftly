import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// GET /api/admin/live
// Sprint AH — Admin-Mission-Control
// Liefert Echtzeit-Snapshot für Live-Status-Karte:
//   users_online (letzte 5 Min), aktive_auktionen, neue_tickets_letzte_stunde

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
  const seitEinerStunde = new Date(Date.now() - 3600_000).toISOString()

  const [{ data: onlineRpc }, aktiveAuktionen, neueTicketsLetzteStunde] = await Promise.all([
    admin.rpc("count_users_online_last_5min"),
    admin.from("tickets").select("id", { count: "exact", head: true }).eq("status", "auktion_offen"),
    admin.from("tickets").select("id", { count: "exact", head: true }).gte("created_at", seitEinerStunde),
  ])

  return NextResponse.json(
    {
      users_online: typeof onlineRpc === "number" ? onlineRpc : 0,
      aktive_auktionen: aktiveAuktionen.count ?? 0,
      neue_tickets_letzte_stunde: neueTicketsLetzteStunde.count ?? 0,
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
