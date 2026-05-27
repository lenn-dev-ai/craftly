import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { exchangeCodeForTokens } from "@/lib/google-cal/oauth"

// GET /api/auth/google/callback?code=...&state=...
// Sprint AE-Fix 26.05.: User aus state-Cookie (HttpOnly+Secure) statt aus
// Session-Cookies — vermeidet @supabase/ssr Cookie-Race in Route-Handlern.

const ERR_PROFIL = "/dashboard-handwerker/profil?google=error&reason="
const OK_PROFIL  = "/dashboard-handwerker/profil?google=connected"

export async function GET(request: NextRequest) {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const error = url.searchParams.get("error")

  if (error) {
        console.warn("[google-cal-callback] OAuth-Provider-Fehler:", error)
        return NextResponse.redirect(new URL(ERR_PROFIL + encodeURIComponent(error), url.origin))
  }
    if (!code || !state) {
          console.warn("[google-cal-callback] missing_params", { hasCode: !!code, hasState: !!state })
          return NextResponse.redirect(new URL(ERR_PROFIL + "missing_params", url.origin))
    }

  const cookieState = request.cookies.get("g_oauth_state")?.value
    if (!cookieState || cookieState !== state) {
          console.warn("[google-cal-callback] state_mismatch", { hasCookie: !!cookieState })
          return NextResponse.redirect(new URL(ERR_PROFIL + "state_mismatch", url.origin))
    }

  const userIdAusState = state.split(":")[0]
    if (!userIdAusState || userIdAusState.length < 32) {
          console.error("[google-cal-callback] state-format ungueltig:", state)
          return NextResponse.redirect(new URL(ERR_PROFIL + "state_format", url.origin))
    }

  try {
        const { user: sessionUser } = await getUserFromRequest(request)
        if (sessionUser && sessionUser.id !== userIdAusState) {
                console.error("[google-cal-callback] session-user-mismatch", { stateUserId: userIdAusState, sessionUserId: sessionUser.id })
                return NextResponse.redirect(new URL(ERR_PROFIL + "user_mismatch", url.origin))
        }
  } catch (sessErr) {
        console.warn("[google-cal-callback] session-check skipped:", sessErr)
  }

  try {
        const tokens = await exchangeCodeForTokens(code)
        const expiresAt = new Date(Date.now() + (tokens.expires_in - 30) * 1000).toISOString()

      const admin = createServiceRoleClient()
        const { error: upsertErr } = await admin.from("hw_google_oauth").upsert(
          {
                    user_id: userIdAusState,
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
              console.error("[google-cal-callback] hw_google_oauth upsert failed:", upsertErr)
              return NextResponse.redirect(new URL(ERR_PROFIL + "db_" + encodeURIComponent(upsertErr.message), url.origin))
      }

      console.log("[google-cal-callback] OK -- connected user", userIdAusState)
        const res = NextResponse.redirect(new URL(OK_PROFIL, url.origin))
        res.cookies.delete("g_oauth_state")
        return res
  } catch (err) {
        console.error("[google-cal-callback] token-exchange/upsert exception:", err)
        return NextResponse.redirect(new URL(ERR_PROFIL + encodeURIComponent(err instanceof Error ? err.message : "exchange_failed"), url.origin))
  }
}

// retrigger build
