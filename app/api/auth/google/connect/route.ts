import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { buildAuthUrl } from "@/lib/google-cal/oauth"

// GET /api/auth/google/connect
// Sprint AE — startet den OAuth-Flow für den eingeloggten Handwerker.
//
// Aufruf via fetch() + Bearer-Token (Reparo-Auth-Pattern). Server gibt
// die Google-OAuth-URL als JSON zurück; der Client macht dann selbst
// window.location.href = data.redirectUrl. Grund: das alte Pattern mit
// direkter Server-Redirect schickte keinen Bearer-Token mit (top-level
// nav statt fetch), getUserFromRequest gab dann 401.

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Sprint AV Phase 2: ?write=true → calendar.events Scope (Schreib-Sync)
  const wantsWrite = new URL(request.url).searchParams.get("write") === "true"

  try {
    const nonce = crypto.randomUUID()
    const state = `${user.id}:${nonce}`
    const redirectUrl = buildAuthUrl(state, wantsWrite)
    const res = NextResponse.json({ redirectUrl })
    res.cookies.set("g_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    })
    return res
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "config error" },
      { status: 500 },
    )
  }
}
