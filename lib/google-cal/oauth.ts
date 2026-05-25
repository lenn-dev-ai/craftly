import { createServiceRoleClient } from "@/lib/supabase-server"

// Sprint AE — Google-Calendar OAuth-Helper
//
// Voraussetzung: Lennart hat in der Google-Cloud-Console einen OAuth-
// Client angelegt und folgende ENVs in Netlify gesetzt:
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET   (secret)
//   NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI
//
// Setup-Schritte: PROMPTS/google-oauth-setup-anleitung.md.

const AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
].join(" ")

export function getClientId(): string {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!id) throw new Error("GOOGLE_OAUTH_CLIENT_ID missing")
  return id
}
export function getClientSecret(): string {
  const s = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!s) throw new Error("GOOGLE_OAUTH_CLIENT_SECRET missing")
  return s
}
export function getRedirectUri(): string {
  const uri = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI
  if (!uri) throw new Error("NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI missing")
  return uri
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

export interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  })
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<GoogleTokenResponse>
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    grant_type: "refresh_token",
  })
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<GoogleTokenResponse>
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const admin = createServiceRoleClient()
  const { data } = await admin
    .from("hw_google_oauth")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle<{ access_token: string; refresh_token: string; expires_at: string }>()
  if (!data) return null

  const expires = new Date(data.expires_at).getTime()
  // 60s Puffer
  if (expires > Date.now() + 60_000) return data.access_token

  try {
    const fresh = await refreshAccessToken(data.refresh_token)
    const newExp = new Date(Date.now() + (fresh.expires_in - 30) * 1000).toISOString()
    await admin.from("hw_google_oauth").update({
      access_token: fresh.access_token,
      expires_at: newExp,
      last_error: null,
    }).eq("user_id", userId)
    return fresh.access_token
  } catch (err) {
    await admin.from("hw_google_oauth").update({
      last_error: err instanceof Error ? err.message : String(err),
    }).eq("user_id", userId)
    return null
  }
}
