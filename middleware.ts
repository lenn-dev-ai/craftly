import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

// Passive Token-Refresh-Middleware.
//
// Die Auth-Gates für Dashboard-Routes laufen client-side in den
// Layouts (siehe components/layout/RoleGuard.tsx + dashboard-admin/layout.tsx).
// Diese Middleware redirected NICHT — sie versucht nur, sb-*-auth-Cookies
// zu erneuern, damit Server-Components und API-Routes den User finden.
//
// Hintergrund: Auf Netlify Edge konnte supabase.auth.getUser() in der
// Middleware keinen User auflösen (Network/Cookie-Quirk), wodurch ein
// Redirect-Loop entstand (Middleware → /login → Client erkennt Session
// → Dashboard → Middleware → …). Lösung: kein Middleware-Redirect mehr,
// nur Best-Effort-Refresh. Schlägt der Refresh fehl, ist es ein No-op.

interface CookieToSet { name: string; value: string; options?: CookieOptions }

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

    // Best-Effort Refresh. Failure ist OK — der Client refresht ohnehin
    // selbst über supabase-js, und client-side Guards greifen sowieso.
    await supabase.auth.getUser()
  } catch {
    // Edge-Runtime-Quirk auf Netlify: ignorieren, response passthrough
  }

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
