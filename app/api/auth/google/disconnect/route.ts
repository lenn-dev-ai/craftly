import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// POST /api/auth/google/disconnect
// Sprint AE — trennt die Google-Cal-Verbindung. Tokens werden gelöscht;
// Bestands-Events im Google-Cal bleiben (Reparo löscht keine User-Daten).

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createServiceRoleClient()
  const { error } = await admin.from("hw_google_oauth").delete().eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
