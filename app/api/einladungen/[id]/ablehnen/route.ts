import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { ablehnenEinladung } from "@/lib/auction/einladung-aktionen"

// POST /api/einladungen/[id]/ablehnen
// Body: { grund?: string } (optional, nur Audit-Log)
//
// Dünner Wrapper: Auth (User-Session) + Delegation an die geteilte Logik in
// lib/auction/einladung-aktionen.ts. Lehnt ab und eskaliert sofort zum
// nächsten Kandidaten/Mass-Invite-Fallback (siehe dort).

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { grund?: string } = {}
  try {
    body = (await request.json().catch(() => ({}))) as typeof body
  } catch {
    body = {}
  }

  const r = await ablehnenEinladung({
    hwId: user.id,
    einladungId: params.id,
    grund: body.grund,
    kanal: "web",
    request,
  })

  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ ok: true, ...r.data })
}
