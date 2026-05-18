import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// POST /api/admin/penalties/[ticketId]/mark-paid
//
// Admin markiert eine outside-Stripe verrechnete Penalty als 'paid'.
// Nur Admin darf das — sonst könnte jeder HW seine eigenen Penalties
// als bezahlt markieren und das System untergraben.
//
// Service-Role-Client umgeht den protect_ticket_fields-Trigger, der
// penalty_*-Felder normalerweise vor Mutation schützt.

export async function POST(
  request: NextRequest,
  { params }: { params: { ticketId: string } },
) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single<{ rolle: string }>()
  if (profile?.rolle !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  const { error, data } = await admin
    .from("tickets")
    .update({
      penalty_status: "paid",
      penalty_charge_id: `manual:${user.id}:${new Date().toISOString()}`,
    })
    .eq("id", params.ticketId)
    .eq("penalty_status", "manual_pending")
    .select("id")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json(
      { error: "Ticket nicht gefunden oder Penalty nicht im 'manual_pending'-Status" },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true })
}
