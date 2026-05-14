import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Admin-Client für Tests — service-role-key umgeht RLS. Wird NUR von
// Seed/Cleanup-Scripts und Assertion-Helpern in E2E-Tests benutzt,
// niemals von App-Code.

let cached: SupabaseClient | null = null

function decodeJwtRole(token: string): string | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8"),
    ) as { role?: string }
    return payload.role ?? null
  } catch {
    return null
  }
}

export function adminClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.E2E_SUPABASE_URL
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "E2E_SUPABASE_URL und E2E_SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.\n" +
      "Für lokales Supabase nach `supabase status` aus dem Output kopieren:\n" +
      "  export E2E_SUPABASE_URL=http://127.0.0.1:54321\n" +
      "  export E2E_SUPABASE_SERVICE_ROLE_KEY=<service_role key>",
    )
  }

  // Pre-flight: Stelle sicher dass der Key tatsächlich service_role ist,
  // nicht versehentlich der anon-Key (häufiger Copy-Paste-Fehler).
  const role = decodeJwtRole(key)
  if (role && role !== "service_role") {
    throw new Error(
      `E2E_SUPABASE_SERVICE_ROLE_KEY enthält einen Key mit role='${role}', ` +
      `erwartet 'service_role'. Du hast vermutlich den anon-Key kopiert.\n` +
      `Hole den service_role-Key mit: supabase status`,
    )
  }

  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
