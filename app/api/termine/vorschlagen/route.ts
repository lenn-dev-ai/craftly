import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { sendEmailFireAndForget } from "@/lib/email/send"

// K1.3a: HW schickt 2-3 Termin-Vorschläge an den Mieter.
//
// Body: { ticket_id: uuid, slots: [{ datum, von, bis }, ...] }
//
// Effekte:
//   1. Insert 2-3 termine-Rows mit gemeinsamer vorschlag_gruppe_id und
//      status='vorgeschlagen'. Service-Role, weil der HW-Insert über
//      die RLS-Policy zwar grundsätzlich klappt — aber wir wollen
//      atomisch Insert + Email machen und können das hier zentral.
//   2. Email an den Mieter (Ticket-Ersteller) fire-and-forget.
//
// Auth: Bearer-Token oder Cookie. Nur der eingeladene HW oder bereits
// zugewiesener_hw des Tickets darf vorschlagen.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"

interface SlotInput {
  datum?: unknown
  von?: unknown
  bis?: unknown
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const authHeader = request.headers.get("authorization") || ""
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "")
  const { data: { user } } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { ticket_id?: unknown; slots?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const ticketId = typeof body.ticket_id === "string" ? body.ticket_id : ""
  const slotsRaw = Array.isArray(body.slots) ? body.slots as SlotInput[] : []
  if (!ticketId) return NextResponse.json({ error: "ticket_id erforderlich" }, { status: 400 })

  const slots = slotsRaw
    .filter(s => typeof s.datum === "string" && typeof s.von === "string" && typeof s.bis === "string")
    .map(s => ({
      datum: s.datum as string,
      von: s.von as string,
      bis: s.bis as string,
    }))
  if (slots.length < 2) {
    return NextResponse.json({ error: "Mindestens 2 Termine vorschlagen." }, { status: 400 })
  }
  if (slots.length > 3) {
    return NextResponse.json({ error: "Maximal 3 Termine pro Vorschlag." }, { status: 400 })
  }
  for (const s of slots) {
    const [vh, vm] = s.von.split(":").map(Number)
    const [bh, bm] = s.bis.split(":").map(Number)
    if (!isFinite(vh) || !isFinite(vm) || !isFinite(bh) || !isFinite(bm)) {
      return NextResponse.json({ error: "Ungültiges Zeitformat" }, { status: 400 })
    }
    if (bh * 60 + bm <= vh * 60 + vm) {
      return NextResponse.json({ error: "Bis muss nach Von liegen" }, { status: 400 })
    }
  }

  const admin = createServiceRoleClient()
  const { data: ticket, error: tErr } = await admin
    .from("tickets")
    .select("id, titel, erstellt_von, zugewiesener_hw, einsatzort_adresse, einsatzort_lat, einsatzort_lng")
    .eq("id", ticketId)
    .single<{
      id: string; titel: string; erstellt_von: string; zugewiesener_hw: string | null
      einsatzort_adresse: string | null; einsatzort_lat: number | null; einsatzort_lng: number | null
    }>()
  if (tErr || !ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })

  // HW-Berechtigung: zugewiesener_hw oder eingeladen
  if (ticket.zugewiesener_hw !== user.id) {
    const { data: einl } = await admin
      .from("einladungen")
      .select("id")
      .eq("ticket_id", ticketId)
      .eq("handwerker_id", user.id)
      .maybeSingle()
    if (!einl) {
      return NextResponse.json({ error: "Du bist nicht für dieses Ticket eingeladen." }, { status: 403 })
    }
  }

  const gruppeId = crypto.randomUUID()
  const titel = `Termin-Vorschlag: ${ticket.titel}`.slice(0, 200)

  const rows = slots.map(s => ({
    handwerker_id: user.id,
    ticket_id: ticketId,
    titel,
    datum: s.datum,
    von: s.von,
    bis: s.bis,
    status: "vorgeschlagen",
    vorschlag_gruppe_id: gruppeId,
    einsatzort_adresse: ticket.einsatzort_adresse,
    einsatzort_lat: ticket.einsatzort_lat,
    einsatzort_lng: ticket.einsatzort_lng,
  }))
  const { error: insErr } = await admin.from("termine").insert(rows)
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Email an Mieter (fire-and-forget) — Ticket-Ersteller
  const { data: mieter } = await admin
    .from("profiles")
    .select("email, name")
    .eq("id", ticket.erstellt_von)
    .maybeSingle<{ email: string | null; name: string | null }>()
  const { data: hw } = await admin
    .from("profiles")
    .select("firma, name")
    .eq("id", user.id)
    .maybeSingle<{ firma: string | null; name: string | null }>()

  if (mieter?.email) {
    const hwName = hw?.firma || hw?.name || "Dein Handwerker"
    const slotListe = slots.map(s => {
      const wt = new Date(s.datum).toLocaleDateString("de", { weekday: "long", day: "2-digit", month: "short" })
      return `<li>${escape(wt)} · ${escape(s.von.slice(0, 5))}–${escape(s.bis.slice(0, 5))} Uhr</li>`
    }).join("")
    const ticketUrl = `${SITE_URL}/dashboard-mieter/ticket/${ticketId}`
    sendEmailFireAndForget({
      to: mieter.email,
      subject: `${hwName} hat ${slots.length} Termine vorgeschlagen`,
      html: `
        <p>Hallo${mieter.name ? " " + escape(mieter.name) : ""},</p>
        <p><strong>${escape(hwName)}</strong> schlägt für deinen Auftrag &bdquo;${escape(ticket.titel)}&ldquo; folgende Termine vor:</p>
        <ul style="font-family:sans-serif;font-size:14px;">${slotListe}</ul>
        <p>
          <a href="${ticketUrl}" style="background:#3D8B7A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;">
            Termin auswählen
          </a>
        </p>
        <p style="font-size:12px;color:#6B665E;">
          Wähle einen Termin aus — die anderen verfallen automatisch.
          Wenn keiner passt, kannst du im Ticket auf &bdquo;Keiner passt&ldquo; klicken,
          dann schlägt der Handwerker neue Termine vor.
        </p>
      `,
    })
  }

  return NextResponse.json({ ok: true, vorschlag_gruppe_id: gruppeId, anzahl: rows.length })
}
