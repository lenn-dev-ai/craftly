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
  // --- Beta-Zugangs-Gate (geschlossene Beta) ---
  // Ist BETA_PASSWORD gesetzt, ist die GANZE Seite nur per Basic-Auth
  // erreichbar (User: BETA_USER oder "reparo"). So ist die Seite nicht
  // öffentlich zugänglich (relevant fürs noch fehlende Impressum).
  // /api bleibt offen, damit Vapi-Webhook & Crons weiterlaufen. Ohne
  // gesetztes BETA_PASSWORD greift kein Gate (fail-open).
  const betaPw = process.env.BETA_PASSWORD
  if (betaPw && !request.nextUrl.pathname.startsWith("/api")) {
    const betaUser = process.env.BETA_USER || "reparo"
    const authHeader = request.headers.get("authorization")
    let erlaubt = false
    if (authHeader?.startsWith("Basic ")) {
      try {
        const dec = atob(authHeader.slice(6))
        const i = dec.indexOf(":")
        erlaubt = dec.slice(0, i) === betaUser && dec.slice(i + 1) === betaPw
      } catch {
        /* ungültiger Header → erlaubt bleibt false */
      }
    }
    if (!erlaubt) {
      return new NextResponse("Reparo – geschlossene Beta. Zugang nur mit Passwort.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Reparo Beta", charset="UTF-8"' },
      })
    }
  }

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

    if (!protectedAppPath) {
      // API-Routes etc. brauchen nur Cookie-Refresh, kein Redirect.
      await supabase.auth.getUser()
      return response
    }

    // Cookie-basierter Pre-Filter statt getUser()-Network-Roundtrip.
    // Hintergrund: signInWithPassword setzt sb-*-auth-token im Browser,
    // aber direkt danach kann getUser() in middleware noch null returnen
    // (Race zwischen Browser-Cookie-Persist und Server-Request) → Redirect
    // zu /login → Login-Loop.
    //
    // Lösung: wenn KEIN Auth-Cookie da ist (nicht eingeloggt), redirect.
    // Wenn Cookie da ist (auch frisch), durchlassen — RoleGuard im Layout
    // prüft clientside und redirected sauber bei ungültiger Session.
    const hasAuthCookie = request.cookies.getAll()
      .some(c => c.name.startsWith("sb-") && c.name.includes("auth-token"))

    if (!hasAuthCookie) {
      return loginRedirect(request)
    }

    // Best-Effort Cookie-Refresh, kein Block bei Failure.
    await supabase.auth.getUser()
    return response
  } catch {
    if (isProtectedAppPath(request.nextUrl.pathname)) {
      return loginRedirect(request)
    }
  }

  return response
}

export const config = {
  // Läuft auf allen Seiten (fürs Beta-Gate) + /api (Cookie-Refresh & Webhook-
  // Durchlass), außer Next-Internals und statischen Dateien (Pfad mit Punkt).
  matcher: ["/((?!_next/|.*\\..*).*)"],
}
