import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Debug: log env vars and cookies
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const allCookies = request.cookies.getAll()
  console.log("[middleware] path:", request.nextUrl.pathname)
  console.log("[middleware] env URL exists:", !!url, "key exists:", !!key)
  console.log("[middleware] cookies count:", allCookies.length, "names:", allCookies.map(c => c.name).join(", "))

  if (!url || !key) {
    console.log("[middleware] MISSING ENV VARS - skipping auth check")
    return response
  }

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  console.log("[middleware] user:", user?.id || "null", "error:", error?.message || "none")

  // Helper: create redirect that preserves refreshed auth cookies
  function redirectWithCookies(url: URL) {
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  // Protect all dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard-") && !user) {
    console.log("[middleware] BLOCKING dashboard access - no user")
    return redirectWithCookies(new URL("/login", request.url))
  }

  // Redirect logged-in users away from login page
  if (request.nextUrl.pathname === "/login" && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("rolle")
      .eq("id", user.id)
      .single()

    const rolle = profile?.rolle || "mieter"
    console.log("[middleware] redirecting logged-in user, rolle:", rolle)
    const dashMap: Record<string, string> = {
      verwalter: "/dashboard-verwalter",
      handwerker: "/dashboard-handwerker",
      mieter: "/dashboard-mieter",
      admin: "/dashboard-admin",
    }
    return redirectWithCookies(new URL(dashMap[rolle] || "/dashboard-mieter", request.url))
  }

  return response
}

export const config = {
  matcher: ["/dashboard-:path*", "/login"],
}
