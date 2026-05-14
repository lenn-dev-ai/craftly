import { createClient } from "@supabase/supabase-js"

// Holt einen User-Access-Token via signInWithPassword. Wird im Test
// genutzt um API-Routes mit Bearer-Header zu authenticaten — ohne
// auf die fragilen SSR-Cookies angewiesen zu sein.

export async function userAccessToken(email: string, password: string): Promise<string> {
  const url = process.env.E2E_SUPABASE_URL
  const anon = process.env.E2E_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error("E2E_SUPABASE_URL/ANON_KEY müssen gesetzt sein")
  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) throw new Error(`Sign-in fehlgeschlagen für ${email}: ${error?.message}`)
  return data.session.access_token
}
