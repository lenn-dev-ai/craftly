import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { buildAuthUrl } from "@/lib/google-cal/oauth"

// GET /api/auth/google/connect
// Sprint AE — startet den OAuth-Flow für den eingeloggten Handwerker.

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // state = user.id signiert (für MVP einfach: random + cookie)
    const nonce = crypto.randomUUID()
    const state = `${user.id}:${nonce}`
    const url = buildAuthUrl(state)
    const res = NextResponse.redirect(url)
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
