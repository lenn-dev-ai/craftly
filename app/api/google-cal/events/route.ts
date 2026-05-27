import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { listEventsForUser } from "@/lib/google-cal/events"

// GET /api/google-cal/events?from=2026-05-25&to=2026-05-31
// Sprint AE Phase 3 — Reparo's Kalender-Page ruft diese Route auf, um
// Google-Events des eingeloggten HW in der angefragten Woche zu holen.
// Wenn HW nicht verbunden ist (kein hw_google_oauth-Eintrag) → leeres Array.

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const fromParam = url.searchParams.get("from")
  const toParam = url.searchParams.get("to")
  if (!fromParam || !toParam) {
    return NextResponse.json(
      { error: "from + to (ISO-Datum) required" },
      { status: 400 },
    )
  }

  // from = Wochenstart 00:00, to = Wochenende 23:59:59
  const from = new Date(fromParam + "T00:00:00")
  const to = new Date(toParam + "T23:59:59")
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "ungültiges Datumsformat" }, { status: 400 })
  }

  const events = await listEventsForUser(user.id, from, to)
  return NextResponse.json({ events })
}
