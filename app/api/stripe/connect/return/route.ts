import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { getStripe, stripeConfigured } from "@/lib/stripe"

// GET /api/stripe/connect/return?account=acct_xxx
//
// Wird nach erfolgreichem (oder abgebrochenem) Stripe-Onboarding-Flow
// vom Browser des HW aufgerufen. Wir holen den aktuellen Account-Status
// und spiegeln charges_enabled + payouts_enabled in profiles.
//
// Wichtig: charges_enabled=true bedeutet NICHT zwingend dass Onboarding
// vollständig ist (Stripe verlangt evtl. später noch Dokumente). Der
// Webhook account.updated muss daher die Wahrheit pflegen — dieser
// Endpoint ist nur ein optimistisches Update für UX.

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const successRedirect = (status: string) =>
    NextResponse.redirect(
      `${origin}/dashboard-handwerker/verdienst?stripe=${status}`,
    )

  if (!stripeConfigured()) {
    return successRedirect("not_configured")
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login?redirectTo=/dashboard-handwerker/verdienst`)
  }

  const accountId = request.nextUrl.searchParams.get("account")
  if (!accountId) {
    return successRedirect("missing_account")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", user.id)
    .single<{ stripe_account_id: string | null }>()

  // Bestätigung: der returnte Account muss dem im Profil hinterlegten
  // entsprechen — sonst hat jemand mit fremder ?account=-Query gefummelt.
  if (profile?.stripe_account_id !== accountId) {
    return successRedirect("account_mismatch")
  }

  const stripe = getStripe()!
  let account
  try {
    account = await stripe.accounts.retrieve(accountId)
  } catch {
    return successRedirect("retrieve_failed")
  }

  const admin = createServiceRoleClient()
  const ist_charges = !!account.charges_enabled
  const ist_payouts = !!account.payouts_enabled
  await admin
    .from("profiles")
    .update({
      stripe_charges_enabled: ist_charges,
      stripe_payouts_enabled: ist_payouts,
      stripe_onboarded_at: ist_charges ? new Date().toISOString() : null,
    })
    .eq("id", user.id)

  return successRedirect(ist_charges ? "onboarded" : "incomplete")
}
