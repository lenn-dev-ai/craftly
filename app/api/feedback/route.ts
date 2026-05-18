import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { sendEmailFireAndForget } from "@/lib/email/send"

// POST /api/feedback
//
// Eingeloggter User schickt freies Feedback. Wir speichern in der DB
// (RLS = insert mit user_id=self) UND lösen fire-and-forget eine
// Mail an REPARO_FEEDBACK_EMAIL aus. Bewusst minimal — kein File-
// Upload, kein Threading, das ist ein Beta-Tool.
//
// Validierung:
//   - message: nicht leer, max 5000 Zeichen
//   - kontext_url: max 500 Zeichen (verhindert URL-stuffing)
//
// Anti-Spam-Floor: zwei aktive Schichten würden später Sinn machen
// (Rate-Limit pro User, captcha bei mehr als N pro Tag). Aktuell
// nur die DB-Constraints und Auth-Pflicht.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()

  // B1.1: supabase.auth.getUser() ohne Argument liest die SSR-Cookies —
  // die im App-Router-Route-Handler-Kontext mit @supabase/ssr v0.3
  // unzuverlässig gelesen werden (führte zu Dauer-401 bei /api/feedback).
  // Der Client sendet zusätzlich Authorization: Bearer <jwt>; wenn der
  // Header da ist, validieren wir explizit gegen GoTrue per JWT.
  const authHeader = request.headers.get("authorization") || ""
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "")
  const { data: { user } } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { message?: unknown; kontext_url?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (!message) {
    return NextResponse.json({ error: "Nachricht ist leer." }, { status: 400 })
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Nachricht zu lang (max 5000 Zeichen)." }, { status: 400 })
  }

  const kontextRaw = typeof body.kontext_url === "string" ? body.kontext_url.slice(0, 500) : null

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle, name, email")
    .eq("id", user.id)
    .maybeSingle<{ rolle: string | null; name: string | null; email: string | null }>()

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    rolle: profile?.rolle ?? null,
    kontext_url: kontextRaw,
    message,
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Mail an Reparo-Admin. Wenn kein FEEDBACK_EMAIL gesetzt: skip
  // (User-Insert blieb erhalten, Admin-Page sieht es trotzdem).
  const recipient = process.env.REPARO_FEEDBACK_EMAIL
  if (recipient) {
    const subject = `Neues Feedback (${profile?.rolle ?? "?"}) — ${message.slice(0, 60)}`
    const html = `
      <p>Neues Feedback ist eingegangen:</p>
      <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;margin:12px 0;">
        <tr><td style="color:#6B665E;padding:4px 12px 4px 0;">Von</td><td>${escape(profile?.name ?? "?")} (${escape(profile?.email ?? user.email ?? "")})</td></tr>
        <tr><td style="color:#6B665E;padding:4px 12px 4px 0;">Rolle</td><td>${escape(profile?.rolle ?? "—")}</td></tr>
        ${kontextRaw ? `<tr><td style="color:#6B665E;padding:4px 12px 4px 0;">Kontext</td><td><a href="${escape(kontextRaw)}">${escape(kontextRaw)}</a></td></tr>` : ""}
      </table>
      <div style="background:#FAF8F5;border:1px solid #EDE8E1;border-radius:8px;padding:16px;white-space:pre-wrap;font-family:sans-serif;font-size:14px;">${escape(message)}</div>
      <p style="margin-top:16px;font-size:12px;color:#6B665E;">
        Inbox: <a href="${SITE_URL}/dashboard-admin/feedback">${SITE_URL}/dashboard-admin/feedback</a>
      </p>
    `
    sendEmailFireAndForget({ to: recipient, subject, html, replyTo: profile?.email ?? undefined })
  }

  return NextResponse.json({ ok: true })
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
