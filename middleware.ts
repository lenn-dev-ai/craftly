import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

// Auth-Middleware für geschützte App-Routen.
//
// Wichtig: Client-side Guards in Layouts sind weiterhin sinnvoll für UX
// und Rollenwechsel, dürfen aber nicht der erste Schutzwall sein. Ohne
// serverseitige Prüfung würden geschützte Seiten ihr initiales HTML schon
// an nicht angemeldete Besucher ausliefern und erst danach redirecten.

interface CookieToSet { name: string; value: string; options?: CookieOptions }

const roleDashboard: Record<string, string> = {
  admin: "/dashboard-admin",
  verwalter: "/dashboard-verwalter",
  handwerker: "/dashboard-handwerker",
  mieter: "/dashboard-mieter",
}

const routeRoles = [
  { prefix: "/admin", role: "admin" },
  { prefix: "/dashboard-admin", role: "admin" },
  { prefix: "/dashboard-verwalter", role: "verwalter" },
  { prefix: "/dashboard-handwerker", role: "handwerker" },
  { prefix: "/dashboard-mieter", role: "mieter" },
] as const

function loginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone()
  const redirectTo = `${request.nextUrl.pathname}${request.nextUrl.search}`
  url.pathname = "/login"
  url.search = ""
  url.searchParams.set("redirectTo", redirectTo)
  return NextResponse.redirect(url)
}

function dashboardForRole(role: string | null | undefined) {
  return role ? roleDashboard[role] : undefined
}

function isProtectedAppPath(pathname: string) {
  return (
    pathname === "/ticket" ||
    pathname.startsWith("/ticket/") ||
    routeRoles.some(({ prefix }) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  )
}

function requiredRoleForPath(pathname: string) {
  return routeRoles.find(({ prefix }) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  )?.role
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            )
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            )
          },
        },
      },
    )

    const pathname = request.nextUrl.pathname
    const protectedAppPath = isProtectedAppPath(pathname)

    const { data: { user }, error } = await supabase.auth.getUser()

    // API-Routes nutzen die Middleware nur zum Cookie-Refresh. Sie sollen
    // JSON-Statuscodes selbst entscheiden statt HTML-Redirects zu bekommen.
    if (!protectedAppPath) return response

    if (error || !user) return loginRedirect(request)

    const requiredRole = requiredRoleForPath(pathname)
    if (!requiredRole) return response

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("rolle")
      .eq("id", user.id)
      .single()

    if (profileError || !profile?.rolle) return loginRedirect(request)

    if (profile.rolle === "admin" || profile.rolle === requiredRole) {
      return response
    }

    const fallback = dashboardForRole(profile.rolle)
    if (fallback) {
      const url = request.nextUrl.clone()
      url.pathname = fallback
      url.search = ""
      return NextResponse.redirect(url)
    }

    return loginRedirect(request)
  } catch {
    if (isProtectedAppPath(request.nextUrl.pathname)) {
      return loginRedirect(request)
    }
  }

  return response
}

export const config = {
  matcher: [
    "/admin",
    "/dashboard-:path*",
    "/admin/:path*",
    "/ticket/:path*",
    "/api/:path*",
  ],
}
