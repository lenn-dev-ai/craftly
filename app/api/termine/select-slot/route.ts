import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { createCalendarEvent } from "@/lib/google-cal/write"
import { hasCalendarWriteScope } from "@/lib/google-cal/oauth"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// K1.2: Mieter wählt einen vorgeschlagenen Termin-Slot (oder lehnt alle ab).
//
// Eingang:
//   { gruppe_id: uuid, action: "select", termin_id: uuid }   ← Slot wählen
//   { gruppe_id: uuid, action: "reject" }                    ← alle ablehnen
//
// Auth: Bearer-Token (B1.1-Pattern) oder Cookie. User muss Ticket-Ersteller
// sein (`tickets.erstellt_von`). Service-Role-Client bypasst RLS, weil
// `termine_update` nur dem handwerker_id Updates erlaubt — der Mieter
// hätte sonst keine Möglichkeit, seinen Slot zu bestätigen.
//
// Effekte:
//   action=select  → gewählter Termin status='bestaetigt', restliche der
//                    Gruppe status='abgelaufen'
//   action=reject  → alle der Gruppe status='abgelehnt'
// Beide Pfade sind idempotent gegen Doppelklicks: nur wenn alle Termine
// der Gruppe noch 'vorgeschlagen' sind, wird gemacht.

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { gruppe_id?: unknown; action?: unknown; termin_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const gruppeId = typeof body.gruppe_id === "string" ? body.gruppe_id : ""
  const action = body.action === "select" || body.action === "reject" ? body.action : null
  const terminId = typeof body.termin_id === "string" ? body.termin_id : null
  if (!gruppeId || !action) {
    return NextResponse.json({ error: "gruppe_id und action erforderlich" }, { status: 400 })
  }
  if (action === "select" && !terminId) {
    return NextResponse.json({ error: "termin_id erforderlich für action=select" }, { status: 400 })
  }

  const admin = createServiceRoleClient()
  const { data: gruppe, error: gErr } = await admin
    .from("termine")
    .select("id, ticket_id, status, vorschlag_gruppe_id")
    .eq("vorschlag_gruppe_id", gruppeId)
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })
  if (!gruppe || gruppe.length === 0) {
    return NextResponse.json({ error: "Vorschlagsgruppe nicht gefunden" }, { status: 404 })
  }

  const ticketId = gruppe[0].ticket_id as string | null
  if (!ticketId) {
    return NextResponse.json({ error: "Termine ohne Ticket-Zuordnung" }, { status: 400 })
  }

  const { data: ticket, error: tErr } = await admin
    .from("tickets")
    .select("erstellt_von")
    .eq("id", ticketId)
    .single<{ erstellt_von: string }>()
  if (tErr || !ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 })
  if (ticket.erstellt_von !== user.id) {
    return NextResponse.json({ error: "Nur der Mieter darf den Termin wählen." }, { status: 403 })
  }

  if (!gruppe.every(t => t.status === "vorgeschlagen")) {
    return NextResponse.json(
      { error: "Diese Vorschläge wurden bereits bearbeitet." },
      { status: 409 },
    )
  }

  // HW-Daten für die Email-Benachrichtigung
  const hwId = gruppe[0]
    ? (await admin.from("termine").select("handwerker_id, datum, von, bis").eq("id", gruppe[0].id).single<{ handwerker_id: string; datum: string; von: string; bis: string }>()).data
    : null

  if (action === "select") {
    const treffer = gruppe.find(t => t.id === terminId)
    if (!treffer) {
      return NextResponse.json({ error: "Gewählter Termin gehört nicht zur Gruppe" }, { status: 400 })
    }
    const { error: e1 } = await admin
      .from("termine")
      .update({ status: "bestaetigt" })
      .eq("id", terminId!)
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    const { error: e2 } = await admin
      .from("termine")
      .update({ status: "abgelaufen" })
      .eq("vorschlag_gruppe_id", gruppeId)
      .neq("id", terminId!)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    // Sprint AV Phase 2 — Google-Cal Write-Sync (fire-and-forget).
    // Nur wenn der HW den calendar.events Scope erteilt hat.
    // Fehler loggen aber Request nicht abbrechen — Termin ist trotzdem bestätigt.
    if (hwId?.handwerker_id) {
      void (async () => {
        try {
          const canWrite = await hasCalendarWriteScope(hwId.handwerker_id)
          if (!canWrite) return

          // Bestätigten Termin laden (mit allen Feldern die für Cal-Event nötig sind)
          const { data: terminDetails } = await admin
            .from("termine")
            .select("datum, von, bis, titel, einsatzort_adresse, ticket_id")
            .eq("id", terminId!)
            .maybeSingle<{ datum: string; von: string; bis: string; titel: string; einsatzort_adresse: string | null; ticket_id: string | null }>()
          if (!terminDetails) return

          const { data: ticketDetails } = await admin
            .from("tickets")
            .select("beschreibung")
            .eq("id", ticketId)
            .maybeSingle<{ beschreibung: string | null }>()

          const result = await createCalendarEvent(hwId.handwerker_id, {
            titel: terminDetails.titel,
            datum: terminDetails.datum,
            von: terminDetails.von,
            bis: terminDetails.bis,
            adresse: terminDetails.einsatzort_adresse,
            ticketId: ticketId,
            beschreibung: ticketDetails?.beschreibung ?? null,
          })

          if (result.googleEventId) {
            // google_event_id in termine speichern (für spätere Updates/Deletes)
            await admin
              .from("termine")
              .update({ google_event_id: result.googleEventId })
              .eq("id", terminId!)
          } else if (result.error) {
            console.warn("[select-slot] Google-Cal-Write fehlgeschlagen:", result.error)
          }
        } catch (calErr) {
          console.warn("[select-slot] Google-Cal-Write Exception:", calErr)
        }
      })()
    }

    // K1.3b: HW-Email — "Mieter hat einen Termin bestätigt"
    if (hwId?.handwerker_id) {
      const { data: gewaehlter } = await admin
        .from("termine")
        .select("datum, von, bis")
        .eq("id", terminId!)
        .maybeSingle<{ datum: string; von: string; bis: string }>()
      const { data: hwProfile } = await admin
        .from("profiles")
        .select("email, name")
        .eq("id", hwId.handwerker_id)
        .maybeSingle<{ email: string | null; name: string | null }>()
      const { data: ticketRow } = await admin
        .from("tickets")
        .select("titel")
        .eq("id", ticketId)
        .maybeSingle<{ titel: string }>()
      if (hwProfile?.email && gewaehlter) {
        const wt = new Date(gewaehlter.datum).toLocaleDateString("de", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })
        const ticketUrl = `${SITE_URL}/dashboard-handwerker/ticket/${ticketId}`
        sendEmailFireAndForget({
          to: hwProfile.email,
          subject: `Termin bestätigt: ${ticketRow?.titel ?? "Auftrag"}`,
          html: `
            <p>Hallo${hwProfile.name ? " " + escape(hwProfile.name) : ""},</p>
            <p>Der Mieter hat einen deiner Termine für &bdquo;${escape(ticketRow?.titel ?? "")}&ldquo; bestätigt:</p>
            <p style="background:#F0FAF7;border:1px solid #BCDDD2;border-radius:8px;padding:12px 16px;font-family:sans-serif;font-size:14px;">
              <strong>${escape(wt)}</strong><br>
              ${escape(gewaehlter.von.slice(0, 5))} – ${escape(gewaehlter.bis.slice(0, 5))} Uhr
            </p>
            <p><a href="${ticketUrl}" style="background:#3D8B7A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;">Auftrag öffnen</a></p>
          `,
        })
      }
    }
    return NextResponse.json({ ok: true, status: "bestaetigt" })
  } else {
    // reject — alle der Gruppe auf 'abgelehnt'. Der HW wird per Email
    // informiert und kann im Auftrag neue Slots vorschlagen.
    const { error } = await admin
      .from("termine")
      .update({ status: "abgelehnt" })
      .eq("vorschlag_gruppe_id", gruppeId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (hwId?.handwerker_id) {
      const { data: hwProfile } = await admin
        .from("profiles")
        .select("email, name")
        .eq("id", hwId.handwerker_id)
        .maybeSingle<{ email: string | null; name: string | null }>()
      const { data: ticketRow } = await admin
        .from("tickets")
        .select("titel")
        .eq("id", ticketId)
        .maybeSingle<{ titel: string }>()
      if (hwProfile?.email) {
        const ticketUrl = `${SITE_URL}/dashboard-handwerker/ticket/${ticketId}`
        sendEmailFireAndForget({
          to: hwProfile.email,
          subject: `Termine abgelehnt: bitte neu vorschlagen — ${ticketRow?.titel ?? ""}`.slice(0, 200),
          html: `
            <p>Hallo${hwProfile.name ? " " + escape(hwProfile.name) : ""},</p>
            <p>Der Mieter hat deine Termin-Vorschläge für &bdquo;${escape(ticketRow?.titel ?? "")}&ldquo; abgelehnt. Bitte schlag im Auftrag neue Slots vor.</p>
            <p><a href="${ticketUrl}" style="background:#3D8B7A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;">Neue Termine vorschlagen</a></p>
          `,
        })
      }
    }
    return NextResponse.json({ ok: true, status: "abgelehnt" })
  }
}
