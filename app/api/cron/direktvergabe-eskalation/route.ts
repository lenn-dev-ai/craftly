import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { eskaliereDirektvergabe } from "@/lib/auction/direktvergabe"

// POST /api/cron/direktvergabe-eskalation
//
// Sprint AM Phase 2e — Timeout-Eskalation für die sequenzielle
// Direktvergabe (siehe lib/auction/direktvergabe.ts, eskaliereDirektvergabe).
//
// Alle 5 Minuten (netlify/functions/direktvergabe-eskalation.mts):
// findet offene Tickets mit einer laufenden Direktvergabe-Anfrage
// (direktvergabe_kandidaten gesetzt, zugewiesener_hw noch leer), bei denen
// direktvergabe_angefragt_am + direktvergabe_timeout_min überschritten ist,
// und ruft für jedes eskaliereDirektvergabe(ticketId) auf — das markiert
// die aktuelle Anfrage als 'abgelaufen', fragt den nächsten Kandidaten an
// oder eröffnet nach MAX_ESKALATIONEN den Mass-Invite-Fallback.
//
// Race-Conditions mit /api/einladungen/[id]/annehmen|ablehnen sind in
// eskaliereDirektvergabe() selbst abgedeckt (status-Checks +
// .eq('status','offen')-Locks) — der Cron kann also bedenkenlos auch dann
// laufen, wenn der HW "gleichzeitig" reagiert.

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authViaSecret =
    !!cronSecret && request.headers.get("x-cron-secret") === cronSecret

  if (!authViaSecret) {
    const { supabase, user } = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("rolle").eq("id", user.id).single()
    if (profile?.rolle !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createServiceRoleClient()

  const { data: tickets, error } = await admin
    .from("tickets")
    .select("id, direktvergabe_angefragt_am, direktvergabe_timeout_min")
    .eq("status", "offen")
    .is("zugewiesener_hw", null)
    .not("direktvergabe_kandidaten", "is", null)
    .not("direktvergabe_angefragt_am", "is", null)
    .not("direktvergabe_timeout_min", "is", null)
    .returns<Array<{
      id: string
      direktvergabe_angefragt_am: string | null
      direktvergabe_timeout_min: number | null
    }>>()

  if (error) return NextResponse.json({ error: "Query: " + error.message }, { status: 500 })

  const jetzt = Date.now()
  let geprueft = 0
  let eskaliert = 0
  let nochNichtAbgelaufen = 0
  let keineAktion = 0
  const ergebnisse: Array<{ ticketId: string; ergebnis: string }> = []

  for (const ticket of tickets ?? []) {
    geprueft++
    if (!ticket.direktvergabe_angefragt_am || !ticket.direktvergabe_timeout_min) {
      nochNichtAbgelaufen++
      continue
    }
    const deadline = new Date(ticket.direktvergabe_angefragt_am).getTime() + ticket.direktvergabe_timeout_min * 60_000
    if (deadline > jetzt) {
      nochNichtAbgelaufen++
      continue
    }

    try {
      const result = await eskaliereDirektvergabe(ticket.id)
      ergebnisse.push({ ticketId: ticket.id, ergebnis: result.ergebnis })
      if (result.ergebnis === "keine_aktion") {
        keineAktion++
      } else {
        eskaliert++
      }
    } catch (err) {
      console.error("[Cron] direktvergabe-eskalation fehlgeschlagen für Ticket", ticket.id, err)
      ergebnisse.push({ ticketId: ticket.id, ergebnis: "error" })
    }
  }

  return NextResponse.json({
    ok: true,
    geprueft,
    eskaliert,
    nochNichtAbgelaufen,
    keineAktion,
    ergebnisse,
  })
}
