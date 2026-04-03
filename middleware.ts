import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect all dashboard routes
  if (request.nextUrl.pathname.startsWith("/dashboard-") && !user) {
    return NextResponse.redirect(new URL("/login", request.url))
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

    return NextResponse.redirect(new URL(dashMap[rolle] || "/dashboard-mieter", request.url))
  }

  return response
}

export const config = {
  matcher: ["/dashboard-:path*", "/login"],
}
