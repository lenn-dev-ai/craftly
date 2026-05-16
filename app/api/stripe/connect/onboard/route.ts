import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { getStripe, stripeConfigured } from "@/lib/stripe"

// POST /api/stripe/connect/onboard
//
// Startet den Stripe-Connect-Onboarding-Flow für den eingeloggten HW.
//   1. Auth-Check: muss HW sein.
//   2. Wenn noch kein stripe_account_id: stripe.accounts.create() →
//      ID via Service-Role in profile speichern (Trigger-Bypass).
//   3. stripe.accountLinks.create() für hosted Onboarding-UI.
//   4. Return { url } → Browser navigiert dorthin.
//
// Bei Stripe nicht konfiguriert (lokal/dev): klare 503-Response,
// kein Crash.

export async function POST(request: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe ist auf dieser Instanz nicht konfiguriert." },
      { status: 503 },
    )
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle, stripe_account_id, email, gewerk")
    .eq("id", user.id)
    .single<{
      rolle: string
      stripe_account_id: string | null
      email: string | null
      gewerk: string | null
    }>()
  if (profile?.rolle !== "handwerker") {
    return NextResponse.json(
      { error: "Nur Handwerker können Stripe verbinden." },
      { status: 403 },
    )
  }

  const stripe = getStripe()!
  const origin = request.nextUrl.origin
  const admin = createServiceRoleClient()

  let accountId = profile.stripe_account_id
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "DE",
      email: profile.email || user.email || undefined,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_type: "individual",
      business_profile: {
        product_description: `Handwerksdienstleistungen über Reparo (${profile.gewerk ?? "Allgemein"})`,
      },
      metadata: { reparo_user_id: user.id },
    })
    accountId = account.id

    // Service-Role nötig — protect_profile_fields-Trigger blockt sonst.
    const { error: updErr } = await admin
      .from("profiles")
      .update({ stripe_account_id: accountId })
      .eq("id", user.id)
    if (updErr) {
      return NextResponse.json(
        { error: "Account-ID-Speichern fehlgeschlagen: " + updErr.message },
        { status: 500 },
      )
    }
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/api/stripe/connect/onboard?refresh=1`,
    return_url: `${origin}/api/stripe/connect/return?account=${accountId}`,
    type: "account_onboarding",
  })

  return NextResponse.json({ url: link.url })
}

// GET-Alias, falls refresh_url getroffen wird (Stripe redirected per GET).
export async function GET(request: NextRequest) {
  return POST(request)
}
