import { createServiceRoleClient } from "@/lib/supabase-server"

// Sprint T MVP — Audit-Logger
//
// Schreibt unveränderlichen Eintrag in public.ticket_audit_log.
// Aufruf nur aus API-Routes / Server-Code (nutzt Service-Role).
//
// Niemals aus dem Frontend aufrufen — das Schema verbietet es per RLS.

export type AuditEventType =
  | "created"
  | "status_change"
  | "angebot_eingegangen"
  | "angebot_angenommen"
  | "auktion_geschlossen"
  | "vergeben"
  | "termin_vorgeschlagen"
  | "termin_bestaetigt"
  | "abgeschlossen"
  | "reklamiert"
  | "kommentar"
  | "export"
  | "freigabe_erste"
  | "freigabe_zweite"

export interface LogTicketEventOpts {
  ticketId: string
  eventType: AuditEventType
  eventData?: Record<string, unknown>
  actorUserId?: string | null
  actorRole?: string | null
  request?: Request | { headers: Headers }
}

export async function logTicketEvent(opts: LogTicketEventOpts): Promise<void> {
  try {
    const admin = createServiceRoleClient()

    let actorRole = opts.actorRole ?? null
    if (!actorRole && opts.actorUserId) {
      const { data } = await admin
        .from("profiles")
        .select("rolle")
        .eq("id", opts.actorUserId)
        .maybeSingle<{ rolle: string }>()
      actorRole = data?.rolle ?? null
    }

    const ipHeader = opts.request?.headers.get("x-forwarded-for") ?? null
    const ipAddr = ipHeader ? ipHeader.split(",")[0]?.trim() : null
    const userAgent = opts.request?.headers.get("user-agent") ?? null

    await admin.from("ticket_audit_log").insert({
      ticket_id: opts.ticketId,
      actor_user_id: opts.actorUserId ?? null,
      actor_role: actorRole,
      event_type: opts.eventType,
      event_data: opts.eventData ?? {},
      ip_addr: ipAddr,
      user_agent: userAgent,
    })
  } catch (err) {
    // Audit ist Best-Effort. Wir blockieren keine Geschäftslogik
    // wenn Logging fehlschlägt, aber loggen den Fehler.
    console.warn("[audit] failed to log ticket event", {
      ticketId: opts.ticketId,
      eventType: opts.eventType,
      err: err instanceof Error ? err.message : String(err),
    })
  }
}
