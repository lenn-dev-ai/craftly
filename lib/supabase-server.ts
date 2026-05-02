import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"

// Server-side Supabase-Client für API-Routes und Server-Components.
// Liest Auth-Cookies, sodass `supabase.auth.getUser()` den eingeloggten
// Nutzer kennt. Schreiben (`set/remove`) in Cookies funktioniert nur in
// Route-Handlers und Server-Actions, nicht in Server-Components.
export function createServerSupabaseClient() {
  const cookieStore = cookies()

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
    },
  )
}
