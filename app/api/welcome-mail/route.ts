import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { sendEmail } from "@/lib/email/send"
import { welcomeEmail } from "@/lib/email/templates"

// POST /api/welcome-mail
//
// Vom Client nach erfolgreichem Profil-Insert (Registrierung oder
// OAuth-Onboarding) aufgerufen. Sendet die Welcome-Mail an die
// E-Mail aus dem Profil. Idempotent ist die Route NICHT — bei
// Doppel-Klick gibt's zwei Mails. Akzeptabel für Beta. Wenn das
// stört: profiles.welcome_sent_at als Lockflag ergänzen.
//
// Auth-Pflicht: nur der eigene Profil wird beschickt — verhindert
// Phishing-Versuche an fremde User.

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, rolle, email")
    .eq("id", user.id)
    .maybeSingle<{ name: string | null; rolle: string | null; email: string | null }>()

  const toAddress = profile?.email || user.email
  if (!toAddress) {
    return NextResponse.json({ error: "Keine E-Mail-Adresse hinterlegt." }, { status: 400 })
  }
  const rolle = (profile?.rolle ?? "mieter") as "verwalter" | "handwerker" | "mieter" | "admin"
  const name = profile?.name ?? toAddress.split("@")[0] ?? ""

  const tpl = welcomeEmail({ name, rolle })
  const result = await sendEmail({ to: toAddress, subject: tpl.subject, html: tpl.html })

  // Skip ist ok (z. B. RESEND_API_KEY fehlt) — nicht als Fehler returnen,
  // damit die UI nicht stört. Erfolg messen wir am 'sent'-Status.
  return NextResponse.json({
    ok: true,
    sent: result.success,
    skipped: result.skipped ?? null,
  })
}
