import { type NextRequest, NextResponse } from "next/server"

export function middleware(request: NextRequest) {
    // Check for Supabase auth cookie (any cookie starting with sb- and containing auth-token)
  const hasAuthCookie = request.cookies.getAll().some(
        c => c.name.startsWith("sb-") && c.name.includes("auth-token")
      )

  // Protect dashboard routes - redirect to login if no auth cookie
  if (request.nextUrl.pathname.startsWith("/dashboard-") && !hasAuthCookie) {
        return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
    matcher: ["/dashboard-:path*"],
}
