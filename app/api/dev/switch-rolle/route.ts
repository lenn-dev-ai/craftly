import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

// Sprint AJ — Multi-Role-Switcher für Demo-Accounts.
//
// POST /api/dev/switch-rolle  body: { rolle: 'mieter'|'verwalter'|'handwerker' }
//
// Demo-User haben profile.demo_rollen = ['mieter','verwalter','handwerker'].
// Dieser Endpoint setzt profile.rolle (= aktive Rolle) auf den gewählten Wert,
// aber NUR wenn der Ziel-Wert in demo_rollen enthalten ist.
//
// Sicherheits-Design:
//   - Auth-Check via cookie/bearer (Standard-Pattern)
//   - Service-Role für UPDATE — kein RLS-Roundtrip, schnell + atomar
//   - Whitelist-Check: rolle muss in demo_rollen[] sein, sonst 403
//   - Kein Demo-Setup → keine demo_rollen → 403 (normale User kommen hier nicht durch)
//
// Nach Erfolg: Client macht window.location.href = '/dashboard-<rolle>'.
// RoleGuard lädt dann das frische Profil (mit neuer .rolle) und lässt rein.

const ERLAUBT = ["mieter", "verwalter", "handwerker"] as const
type Erlaubt = (typeof ERLAUBT)[number]

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { rolle?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const ziel = body.rolle
  if (!ziel || !ERLAUBT.includes(ziel as Erlaubt)) {
    return NextResponse.json(
      { error: `rolle muss eine von ${ERLAUBT.join(", ")} sein` },
      { status: 400 },
    )
  }

  const admin = createServiceRoleClient()

  // Lade demo_rollen + aktuelle Rolle. Verify dass User die Ziel-Rolle haben darf.
  const { data: profil, error: loadErr } = await admin
    .from("profiles")
    .select("rolle, demo_rollen")
    .eq("id", user.id)
    .maybeSingle<{ rolle: string; demo_rollen: string[] | null }>()
  if (loadErr || !profil) {
    return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 404 })
  }

  const erlaubteRollen = profil.demo_rollen ?? []
  if (!erlaubteRollen.includes(ziel)) {
    return NextResponse.json(
      { error: "Diese Rolle ist nicht in deinen demo_rollen freigegeben" },
      { status: 403 },
    )
  }

  if (profil.rolle === ziel) {
    return NextResponse.json({ ok: true, rolle: ziel, unchanged: true })
  }

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ rolle: ziel })
    .eq("id", user.id)
  if (updateErr) {
    return NextResponse.json(
      { error: `UPDATE fehlgeschlagen: ${updateErr.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, rolle: ziel })
}
