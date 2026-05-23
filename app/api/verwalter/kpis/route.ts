import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// GET /api/verwalter/kpis (Sprint H)
// Liefert Dashboard-KPIs + 4-Wochen-Throughput für den eingeloggten
// Verwalter. Nur eigene tickets (verwalter_id = user.id), kein
// Aggregat über mehrere Verwaltungen.
//
// Approximation: tickets-Tabelle hat kein status_changed_at-Audit, also
// nutzen wir created_at als Aggregations-Basis. "Erledigt diese Woche"
// trifft damit auf Tickets zu, die diese Woche entstanden UND erledigt
// wurden — in der Beta-Phase mit kurzen Durchlaufzeiten ein
// akzeptables Proxy. Ein Audit-Trail wäre ein post-Beta-Sprint.

export const dynamic = "force-dynamic"

function startOfWeekIso(d: Date): string {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay() // 0=Sun .. 6=Sat
  const diff = (day === 0 ? -6 : 1 - day)
  date.setDate(date.getDate() + diff)
  return date.toISOString()
}

function isoNTageZurueck(tage: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - tage)
  return d.toISOString()
}

type TicketRow = { status: string; created_at: string }

export async function GET(request: NextRequest) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single<{ rolle: string }>()
  if (!profile || profile.rolle !== "verwalter") {
    return NextResponse.json({ error: "Nur Verwalter" }, { status: 403 })
  }

  const wochenStart = startOfWeekIso(new Date())
  const vierWochenZurueck = isoNTageZurueck(28)

  // Eine breite Query — alle Tickets der letzten 28 Tage + alle offenen
  // (status != 'erledigt') über alle Zeit hinweg. Aggregation passiert
  // server-side via JS, weil PostgREST keine elegante GROUP-BY-Woche-
  // Syntax hat und ein RPC den Scope dieser Phase sprengen würde.
  const [{ data: relevante, error: relErr }, { data: offeneAlle, error: offErr }] = await Promise.all([
    supabase
      .from("tickets")
      .select("status, created_at")
      .eq("verwalter_id", user.id)
      .gte("created_at", vierWochenZurueck)
      .returns<TicketRow[]>(),
    supabase
      .from("tickets")
      .select("status, created_at")
      .eq("verwalter_id", user.id)
      .neq("status", "erledigt")
      .returns<TicketRow[]>(),
  ])

  if (relErr || offErr) {
    return NextResponse.json({ error: relErr?.message || offErr?.message }, { status: 500 })
  }

  const rel = relevante ?? []
  const offen = offeneAlle ?? []

  const neuDieseWoche = rel.filter(t => t.created_at >= wochenStart).length
  const erledigtDieseWoche = rel.filter(
    t => t.status === "erledigt" && t.created_at >= wochenStart,
  ).length
  const inBearbeitung = offen.filter(t => t.status === "in_bearbeitung").length

  // 4-Wochen-Throughput: pro Woche zurück, neu + erledigt
  type WocheBucket = { woche: string; label: string; neu: number; erledigt: number }
  const buckets: WocheBucket[] = []
  for (let i = 3; i >= 0; i--) {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1) - i * 7)
    const ende = new Date(start)
    ende.setDate(start.getDate() + 7)
    const startIso = start.toISOString()
    const endeIso = ende.toISOString()
    const inFenster = rel.filter(t => t.created_at >= startIso && t.created_at < endeIso)
    buckets.push({
      woche: startIso.slice(0, 10),
      label: `KW${getKwNummer(start)}`,
      neu: inFenster.length,
      erledigt: inFenster.filter(t => t.status === "erledigt").length,
    })
  }

  return NextResponse.json({
    offene_tickets: offen.length,
    neu_diese_woche: neuDieseWoche,
    in_bearbeitung: inBearbeitung,
    erledigt_diese_woche: erledigtDieseWoche,
    throughput_4w: buckets,
  })
}

function getKwNummer(d: Date): number {
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
}
