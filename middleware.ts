import { type NextRequest, NextResponse } from "next/server"

// Lightweight Auth-Check via Cookie-Präsenz.
// Voller Token-Refresh passiert weiterhin clientseitig in den Layouts —
// die Middleware verhindert nur, dass nicht-eingeloggte Nutzer überhaupt
// das Dashboard rendern (kein Flackern, keine doppelte Roundtrip).

const PROTECTED_PREFIXES = [
  "/dashboard-",
  "/admin",
  "/ticket/",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const istGeschuetzt = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))

  if (!istGeschuetzt) return NextResponse.next()

  const hatAuthCookie = request.cookies.getAll().some(
    c => c.name.startsWith("sb-") && c.name.includes("auth-token")
  )

  if (!hatAuthCookie) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard-:path*",
    "/admin/:path*",
    "/ticket/:path*",
  ],
}
