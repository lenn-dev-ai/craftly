import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { annehmenEinladung } from "@/lib/auction/einladung-aktionen"

// POST /api/einladungen/[id]/annehmen
// Body: { fruehester_termin?: string (YYYY-MM-DD), geschaetzte_dauer?: string, nachricht?: string }
//
// Dünner Wrapper: Auth (User-Session) + Delegation an die geteilte Logik in
// lib/auction/einladung-aktionen.ts (dieselbe Funktion nutzt der Voice-
// Assistent). Effekte/Race-Handling siehe dort.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { fruehester_termin?: string; geschaetzte_dauer?: string; nachricht?: string } = {}
  try {
    body = (await request.json().catch(() => ({}))) as typeof body
  } catch {
    body = {}
  }

  const r = await annehmenEinladung({
    hwId: user.id,
    einladungId: params.id,
    fruehesterTermin: body.fruehester_termin,
    geschaetzteDauer: body.geschaetzte_dauer,
    nachricht: body.nachricht,
    kanal: "web",
    request,
  })

  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true, ...r.data })
}
