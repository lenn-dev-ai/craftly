import type { NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"

// B1.1 / H1: zentraler Server-Auth-Helper für API-Routen.
//
// Hintergrund: @supabase/ssr v0.3 hat in App-Router-Route-Handlern Cookie-
// Race-Bugs — supabase.auth.getUser() ohne Argument liest manchmal aus den
// SSR-Cookies und resolved zu null, obwohl der User eingeloggt ist. Folge:
// 401 (siehe B1 bei /api/feedback, H1 bei /api/auction/bid).
//
// Fix-Pattern (Commit 1fd30db): den Authorization-Bearer-Header explizit
// parsen und an auth.getUser(token) reichen. GoTrue validiert das JWT
// direkt, kein Cookie-Pfad nötig.
//
// Verwendung:
//   const { supabase, user } = await getUserFromRequest(request)
//   if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
//
// Client-Code muss den Bearer-Header mitsenden — lib/auth/clientFetch.ts
// kapselt das.

export interface AuthedRequest {
  supabase: SupabaseClient
  user: User | null
}

export async function getUserFromRequest(request: NextRequest): Promise<AuthedRequest> {
  const supabase = createServerSupabaseClient()
  const authHeader = request.headers.get("authorization") || ""
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "")
  const { data: { user } } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser()
  return { supabase, user }
}
