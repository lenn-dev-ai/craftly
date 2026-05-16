import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getStripe, stripeConfigured } from "@/lib/stripe"
import type Stripe from "stripe"

// POST /api/stripe/webhook
//
// Verarbeitet Stripe-Events. Aktuell relevant:
//
//   account.updated — der HW hat sein Connect-Onboarding fortgeführt
//     oder Stripe hat charges_enabled/payouts_enabled neu bewertet.
//     Wir spiegeln das in profiles.
//
//   payment_intent.succeeded / payment_intent.payment_failed —
//     Wenn künftig echte Penalty-Buchungen laufen (Phase 2), würden
//     diese hier auf tickets.penalty_status gespiegelt. Aktuell Stub.
//
// Signatur-Validierung ist Pflicht — sonst kann jeder unautorisierte
// POSTs schicken und unsere DB beliebig manipulieren. STRIPE_WEBHOOK_
// SECRET wird beim Anlegen des Webhooks im Stripe-Dashboard generiert.

export async function POST(request: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 503 })
  }

  const sig = request.headers.get("stripe-signature")
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  const rawBody = await request.text()
  const stripe = getStripe()!
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "signature mismatch"
    return NextResponse.json({ error: "Invalid signature: " + msg }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account
      await admin
        .from("profiles")
        .update({
          stripe_charges_enabled: !!account.charges_enabled,
          stripe_payouts_enabled: !!account.payouts_enabled,
          stripe_onboarded_at: account.charges_enabled ? new Date().toISOString() : null,
        })
        .eq("stripe_account_id", account.id)
      break
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent
      const ticketId = pi.metadata?.reparo_ticket_id
      if (ticketId) {
        await admin
          .from("tickets")
          .update({ penalty_status: "paid", penalty_charge_id: pi.id })
          .eq("id", ticketId)
      }
      break
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent
      const ticketId = pi.metadata?.reparo_ticket_id
      if (ticketId) {
        await admin
          .from("tickets")
          .update({ penalty_status: "failed", penalty_charge_id: pi.id })
          .eq("id", ticketId)
      }
      break
    }
    default:
      // Unhandled event-type — Stripe schickt viele, wir ignorieren
      // alles was wir aktuell nicht brauchen statt 400 zu returnen
      // (sonst retried Stripe ewig).
      break
  }

  return NextResponse.json({ received: true })
}
