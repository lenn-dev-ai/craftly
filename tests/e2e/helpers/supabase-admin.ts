import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Admin-Client für Tests — service-role-key umgeht RLS. Wird NUR von
// Seed/Cleanup-Scripts und Assertion-Helpern in E2E-Tests benutzt,
// niemals von App-Code.

let cached: SupabaseClient | null = null

export function adminClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.E2E_SUPABASE_URL
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "E2E_SUPABASE_URL und E2E_SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.\n" +
      "Für lokales Supabase nach `supabase start` aus dem Output kopieren:\n" +
      "  export E2E_SUPABASE_URL=http://127.0.0.1:54321\n" +
      "  export E2E_SUPABASE_SERVICE_ROLE_KEY=<service_role key>",
    )
  }
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
