import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

interface CookieToSet { name: string; value: string; options?: CookieOptions }

// Middleware: holt bei jedem Request den User aus dem Supabase-Cookie und
// erneuert den Token. Wichtig für Netlify-Serverless-Functions — ohne
// diesen Refresh sind die sb-*-auth-Cookies in API-Routes nicht lesbar
// und createServerSupabaseClient().auth.getUser() liefert null.
//
// Matcher umfasst alle geschützten Routes UND /api/* — letzteres dient
// nur dem Token-Refresh, der HTTP-Status der API-Route bleibt unverändert
// (kein Redirect, kein 401-Override).

const PROTECTED_PREFIXES = ["/dashboard-", "/admin", "/ticket/"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next({ request })

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

  // WICHTIG: getUser() vor jeder Auth-Prüfung aufrufen — sonst werden
  // Token-Refresh-Cookies nicht in response.cookies geschrieben.
  const { data: { user } } = await supabase.auth.getUser()

  // Dashboard/Admin/Ticket nur für eingeloggte Nutzer
  const istGeschuetzt = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  if (istGeschuetzt && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(url)
  }

  // API-Routes: kein Redirect, nur Token-Refresh. Die Route selbst
  // entscheidet via createServerSupabaseClient ob 401 zurückkommt.
  return response
}

export const config = {
  matcher: [
    "/dashboard-:path*",
    "/admin/:path*",
    "/ticket/:path*",
    "/api/:path*",
  ],
}
