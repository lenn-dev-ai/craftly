import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

// OAuth-Callback für Google (und künftige Provider).
//
// Ablauf:
//   1. Supabase redirected nach Google-Login hierher mit ?code=...
//   2. exchangeCodeForSession setzt sb-*-auth-token-Cookies serverseitig
//   3. Profile-Check: existiert eine profiles-Zeile für diese auth.user.id?
//      - Ja  → direkt aufs Rollen-Dashboard
//      - Nein → /onboarding (Rolle + Pflichtfelder erfassen)
//
// Edge-Cases:
//   - error/error_description-Query (z.B. User hat OAuth-Consent abgelehnt)
//     → zurück zum Login mit Fehler-Query
//   - Kein code → invalid request, redirect /login
//
// Sicher: Wir validieren NICHT die optionale ?next=-Query als allgemeine
// Redirect-Target — Open-Redirect-Risiko. Stattdessen nur Rolle-basierter
// Fallback. Wenn später eine Tiefen-Redirect-Funktion nötig wird, dann nur
// für same-origin-Pfade die mit "/" beginnen.

const roleDashboard: Record<string, string> = {
  admin: "/dashboard-admin",
  verwalter: "/dashboard-verwalter",
  handwerker: "/dashboard-handwerker",
  mieter: "/dashboard-mieter",
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const oauthError = url.searchParams.get("error")
  const oauthErrorDescription = url.searchParams.get("error_description")
  const origin = url.origin

  if (oauthError) {
    const back = new URL("/login", origin)
    back.searchParams.set(
      "oauth_error",
      oauthErrorDescription || oauthError,
    )
    return NextResponse.redirect(back)
  }

  if (!code) {
    const back = new URL("/login", origin)
    back.searchParams.set("oauth_error", "Kein Auth-Code erhalten.")
    return NextResponse.redirect(back)
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.session?.user) {
    const back = new URL("/login", origin)
    back.searchParams.set(
      "oauth_error",
      error?.message || "OAuth-Anmeldung fehlgeschlagen.",
    )
    return NextResponse.redirect(back)
  }

  const user = data.session.user
  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .maybeSingle<{ rolle: string }>()

  if (profile?.rolle && roleDashboard[profile.rolle]) {
    return NextResponse.redirect(new URL(roleDashboard[profile.rolle], origin))
  }

  return NextResponse.redirect(new URL("/onboarding", origin))
}
