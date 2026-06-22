import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { buildAssistantConfig } from "@/lib/vapi/assistant-config"

// GET /api/vapi/web-call-config
//
// Liefert dem eingeloggten Handwerker seine personalisierte Vapi-Assistant-
// Config für einen Web-Voice-Call (Browser-Mikro statt Telefon → keine
// Telefonie-Minuten). Der Client startet damit `vapi.start(assistant)`.
//
// Dieselbe Config wie beim Telefon (lib/vapi/assistant-config), aber die
// Tools tragen den hwId in der Server-URL — beim Web-Call gibt es keine
// Caller-Nummer, über die der HW sonst identifiziert würde.

export async function GET(request: NextRequest) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, rolle")
    .eq("id", user.id)
    .single<{ id: string; name: string | null; rolle: string }>()

  if (!profile || profile.rolle !== "handwerker") {
    return NextResponse.json({ error: "Nur für Handwerker" }, { status: 403 })
  }

  const assistant = buildAssistantConfig({ id: profile.id, name: profile.name })
  return NextResponse.json(
    { assistant },
    { headers: { "Cache-Control": "no-store" } },
  )
}
