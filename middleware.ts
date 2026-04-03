import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return response
  }

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          // Decode URL-encoded cookie values so Supabase SSR can parse the JSON session
          return request.cookies.getAll().map(cookie => ({
            name: cookie.name,
            value: decodeURIComponent(cookie.value),
          }))
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

  const { data: { user } } = await supabase.auth.getUser()

  // Helper: create redirect that preserves refreshed auth cookies
  function redirectWithCookies(targetUrl: URL) {
    const redirectResponse = NextResponse.redirect(targetUrl)
    response.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  // Protect all dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard-") && !user) {
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
