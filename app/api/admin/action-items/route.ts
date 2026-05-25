import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// GET /api/admin/action-items
// Sprint AH — gibt aktionable Probleme zurück (Verwalter/HW/Auktion stehen
// fest, Mieter-Feedback fehlt). Quelle: View admin_action_items (Server-Migration).

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
  const { data, error } = await admin.rpc("admin_get_action_items", { p_limit: 50 })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { items: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  )
}
