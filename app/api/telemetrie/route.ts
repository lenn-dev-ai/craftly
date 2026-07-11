import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { emitEreignis } from "@/lib/cortex/ereignis"

// POST /api/telemetrie — Nutzungs-Telemetrie (Audit 11.07.2026)
//
// Zweck: die Streichen-oder-Vertiefen-Frage für aufwendige Features
// (Karte, Diagnose, Voice) mit Daten beantworten statt mit Bauchgefühl.
// Events landen als typ='feature_<name>' im Cortex-Ereignisstrom —
// damit tauchen die Zähler automatisch im nächtlichen Schlaf-Zyklus auf
// und sind per SQL auswertbar (siehe CORTEX.md, Abschnitt Telemetrie).
//
// Bewusst schlank: nur eingeloggte Nutzer, Feature-Whitelist, keine
// freien Strings in typ (kein Kardinalitäts-Spam), Payload minimal.

const schema = z.object({
  feature: z.enum(["karte", "voice", "diagnose", "frag_reparo"]),
  detail: z.string().max(80).optional(),
})

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Telemetrie-Daten" }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single()

  emitEreignis(createServiceRoleClient(), {
    typ: `feature_${parsed.data.feature}`,
    entitaet: "telemetrie",
    entitaetId: user.id,
    payload: {
      rolle: profile?.rolle ?? "unbekannt",
      ...(parsed.data.detail ? { detail: parsed.data.detail } : {}),
    },
  })

  return NextResponse.json({ ok: true })
}
