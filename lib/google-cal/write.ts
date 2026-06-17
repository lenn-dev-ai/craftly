import { getValidAccessToken } from "./oauth"

// Sprint AV Phase 2 — Google Calendar Write-Sync.
//
// Schreibt bestätigte Reparo-Termine in den primären Google-Kalender des HW.
// Wird aufgerufen wenn:
//   - Mieter einen Termin bestätigt (select-slot → status='bestaetigt')
//   - Termin storniert wird (status='abgelaufen'/'abgelehnt' + google_event_id gesetzt)
//
// Voraussetzungen:
//   - HW hat `calendar.events` Scope in hw_google_oauth.scope
//   - Access-Token ist gültig (getValidAccessToken refresht bei Bedarf)
//
// Fehler werden als { error: string } zurückgegeben — nie throw. Der
// Aufrufer (select-slot API) soll bei Calendar-Fehler den Request nicht
// abbrechen (Termin ist trotzdem bestätigt, nur die Cal-Sync fehlt).

const GCAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

export interface CalEventInput {
  titel: string
  datum: string        // "2026-06-17"
  von: string          // "09:00:00" oder "09:00"
  bis: string          // "10:30:00" oder "10:30"
  adresse: string | null
  ticketId: string     // für description link
  beschreibung?: string | null
}

export interface CalEventResult {
  googleEventId: string | null
  error: string | null
}

// Konvertiert Datum + Uhrzeit in RFC3339 für Berlin-Timezone (Europe/Berlin).
// Google-Cal akzeptiert RFC3339 direkt wenn timezone angegeben ist.
function toRfc3339(datum: string, zeit: string): string {
  // Sicherstellen dass Sekunden da sind (HH:MM → HH:MM:00)
  const z = zeit.length === 5 ? `${zeit}:00` : zeit
  return `${datum}T${z}`
}

export async function createCalendarEvent(
  userId: string,
  event: CalEventInput,
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app",
): Promise<CalEventResult> {
  const token = await getValidAccessToken(userId)
  if (!token) {
    return { googleEventId: null, error: "Kein gültiger Google-Token" }
  }

  const body = {
    summary: event.titel,
    description: [
      event.beschreibung ?? "",
      `Reparo-Auftrag: ${siteUrl}/dashboard-handwerker/ticket/${event.ticketId}`,
    ].filter(Boolean).join("\n\n"),
    location: event.adresse ?? undefined,
    start: {
      dateTime: toRfc3339(event.datum, event.von),
      timeZone: "Europe/Berlin",
    },
    end: {
      dateTime: toRfc3339(event.datum, event.bis),
      timeZone: "Europe/Berlin",
    },
    // Reparo-Tag für spätere Identifikation + mögliche Batch-Sync
    extendedProperties: {
      private: {
        reparo_ticket_id: event.ticketId,
        reparo_managed: "true",
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 60 },   // 1h vor dem Termin
        { method: "popup", minutes: 15 },   // 15 min vor dem Termin
      ],
    },
  }

  try {
    const res = await fetch(GCAL_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => res.status.toString())
      console.warn(`[google-cal/write] createEvent failed ${res.status}:`, errText)
      return { googleEventId: null, error: `Google API ${res.status}: ${errText.slice(0, 200)}` }
    }

    const data = await res.json() as { id?: string }
    return { googleEventId: data.id ?? null, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn("[google-cal/write] createEvent exception:", msg)
    return { googleEventId: null, error: msg }
  }
}

export async function deleteCalendarEvent(
  userId: string,
  googleEventId: string,
): Promise<{ error: string | null }> {
  const token = await getValidAccessToken(userId)
  if (!token) return { error: "Kein gültiger Google-Token" }

  try {
    const res = await fetch(`${GCAL_BASE}/${encodeURIComponent(googleEventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    // 204 = deleted, 410 = already gone — beide OK
    if (!res.ok && res.status !== 410) {
      const errText = await res.text().catch(() => res.status.toString())
      return { error: `Google API ${res.status}: ${errText.slice(0, 200)}` }
    }
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
