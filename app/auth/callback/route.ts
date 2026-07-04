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
  // Review-Fix 03.07.: Der Supabase-Client wirft bei DB-Fehlern nicht — er
  // gibt { error } zurück. Vorher fing das try/catch nur Exceptions und der
  // Upsert-Fehler ging komplett unter: HW glaubt "Kalender verbunden",
  // Token wurde aber nie gespeichert. Jetzt: Fehler prüfen und per
  // ?cal_fehler=1 ans Ziel-Dashboard melden (Banner dort). Login-Flow
  // selbst darf weiterhin nicht an Cal-Sync scheitern.
  let calFehler = false
  if (providerToken && providerRefreshToken) {
    try {
      const admin = createServiceRoleClient()
      const expiresAt = new Date(Date.now() + 3500 * 1000).toISOString()
      const { error: upsertErr } = await admin.from("hw_google_oauth").upsert(
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
      if (upsertErr) {
        console.error("[auth-callback] hw_google_oauth upsert failed", {
          userId: user.id,
          error: upsertErr.message,
        })
        calFehler = true
      }
    } catch (err) {
      console.error("[auth-callback] hw_google_oauth upsert exception", {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      })
      calFehler = true
    }
  }

  const ziel = profile?.rolle && roleDashboard[profile.rolle]
    ? new URL(roleDashboard[profile.rolle], origin)
    : new URL("/onboarding", origin)
  if (calFehler) ziel.searchParams.set("cal_fehler", "1")
  return NextResponse.redirect(ziel)
}
