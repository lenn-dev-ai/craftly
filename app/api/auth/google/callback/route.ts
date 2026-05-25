import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { exchangeCodeForTokens } from "@/lib/google-cal/oauth"

// GET /api/auth/google/callback?code=...&state=...
// Sprint AE — Google leitet hierher zurück. Wir tauschen den Code gegen
// Tokens, speichern in hw_google_oauth, redirecten zum HW-Profil.

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard-handwerker/profil?google=error&reason=${encodeURIComponent(error)}`, url.origin))
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/dashboard-handwerker/profil?google=error&reason=missing_params", url.origin))
  }

  const cookieState = request.cookies.get("g_oauth_state")?.value
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(new URL("/dashboard-handwerker/profil?google=error&reason=state_mismatch", url.origin))
  }

  const { user } = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/dashboard-handwerker/profil", url.origin))
  }
  const expectedUserId = state.split(":")[0]
  if (expectedUserId !== user.id) {
    return NextResponse.redirect(new URL("/dashboard-handwerker/profil?google=error&reason=user_mismatch", url.origin))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 30) * 1000).toISOString()

    const admin = createServiceRoleClient()
    const { error: upsertErr } = await admin.from("hw_google_oauth").upsert(
      {
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? "",
        expires_at: expiresAt,
        scope: tokens.scope,
        connected_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "user_id" },
    )

    if (upsertErr) {
      return NextResponse.redirect(new URL(`/dashboard-handwerker/profil?google=error&reason=db_${encodeURIComponent(upsertErr.message)}`, url.origin))
    }

    const res = NextResponse.redirect(new URL("/dashboard-handwerker/profil?google=connected", url.origin))
    res.cookies.delete("g_oauth_state")
    return res
  } catch (err) {
    return NextResponse.redirect(new URL(`/dashboard-handwerker/profil?google=error&reason=${encodeURIComponent(err instanceof Error ? err.message : "exchange_failed")}`, url.origin))
  }
}
