import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies, headers } from "next/headers"

// Server-side Supabase-Client für API-Routes und Server-Components.
//
// Auth-Resolution-Reihenfolge:
//   1. Authorization: Bearer <jwt>  (Header — für API-Konsumenten ohne Cookies)
//   2. sb-*-auth-token-Cookies      (Browser-Default)
//
// Bearer-Fallback ist wichtig für:
//   - E2E-Tests (Playwright kämpft mit chunked SSR-Cookies)
//   - Mobile-Apps / externe API-Konsumenten in Zukunft
//   - Netlify-Edge-Quirks die SSR-Cookies nicht zuverlässig durchreichen
//
// Wenn Bearer-Header gesetzt ist, wird er als Authorization an Supabase
// weitergereicht — supabase.auth.getUser() validiert dann gegen GoTrue.

export function createServerSupabaseClient() {
  const cookieStore = cookies()
  const headerList = headers()
  const authHeader = headerList.get("authorization") || ""

  const globalOpts = authHeader
    ? { global: { headers: { Authorization: authHeader } } }
    : {}

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Read-only Kontext (Server-Component) — ignorieren
          }
        },
      },
      ...globalOpts,
    },
  )
}
