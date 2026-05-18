import { createClient } from "@/lib/supabase"

// B1.1 / H1: zentraler Client-Helper für authentifizierte API-Calls.
//
// Hängt automatisch `Authorization: Bearer <access_token>` an, wenn eine
// aktive Supabase-Session existiert. Der Server-Helper (lib/auth/
// getUserFromRequest.ts) bevorzugt diesen Header vor den SSR-Cookies und
// umgeht damit den @supabase/ssr v0.3 Cookie-Race-Bug.
//
// Verwendung (statt nativem fetch):
//   const res = await authFetch("/api/auction/bid", { method: "POST", body: ... })
//
// Falls keine Session vorliegt (z.B. anonyme Routes wie /api/welcome-mail
// vor Login-Abschluss), wird der Header weggelassen — der Server reagiert
// genauso wie bisher.

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${session.access_token}`)
  }
  return fetch(input, { ...init, headers })
}
