import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"

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

  // Sprint AE Phase 2: bei Google-Login mit Calendar-Scopes wird der
  // provider_token (Google access_token) in der Session geliefert. Wenn
  // vorhanden + User ist Handwerker oder Admin (für Test) → direkt in
  // hw_google_oauth speichern. So muss HW nach Login NICHT nochmal "Mit
  // Google verbinden" klicken — Calendar-Sync ist sofort aktiv.
  const providerToken = data.session.provider_token
  const providerRefreshToken = data.session.provider_refresh_token
  if (providerToken && providerRefreshToken) {
    try {
      const admin = createServiceRoleClient()
      const expiresAt = new Date(Date.now() + 3500 * 1000).toISOString()
      await admin.from("hw_google_oauth").upsert(
        {
          user_id: user.id,
          access_token: providerToken,
          refresh_token: providerRefreshToken,
          expires_at: expiresAt,
          scope: "https://www.googleapis.com/auth/calendar.readonly",
          connected_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: "user_id" },
      )
    } catch (err) {
      // Best-Effort — Login-Flow soll nicht failen wenn Cal-Sync nicht klappt
      console.warn("[auth-callback] hw_google_oauth upsert failed", err)
    }
  }

  if (profile?.rolle && roleDashboard[profile.rolle]) {
    return NextResponse.redirect(new URL(roleDashboard[profile.rolle], origin))
  }

  return NextResponse.redirect(new URL("/onboarding", origin))
}
