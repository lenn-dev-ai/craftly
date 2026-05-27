import { getValidAccessToken } from "./oauth"

// Sprint AE Phase 3 — Read-only Pull der Google-Calendar-Events
// für einen Reparo-User. Wird im HW-Kalender als zusätzlicher Layer
// gerendert. Kein Write-Back (= keine Termin-Erstellung Reparo→Google),
// nur Anzeige als "belegt".

export interface GoogleCalEvent {
  id: string
  summary: string
  start: string  // ISO 8601 oder date-only ("YYYY-MM-DD" für Ganztages)
  end: string
  allDay: boolean
  htmlLink?: string
}

interface GoogleApiEvent {
  id: string
  summary?: string
  status?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  htmlLink?: string
}

/**
 * Listet Google-Calendar-Events des Users in einem Zeitfenster.
 * Bei fehlendem Token / API-Fehler: leeres Array (kein Throw — Kalender-UI
 * soll auch ohne Google-Verbindung funktionieren).
 */
export async function listEventsForUser(
  userId: string,
  from: Date,
  to: Date,
): Promise<GoogleCalEvent[]> {
  const token = await getValidAccessToken(userId)
  if (!token) return []

  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: "true",  // serialisiert recurring events in einzelne Instanzen
    orderBy: "startTime",
    maxResults: "100",
  })

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        // Server-Fetch — keine cache, Next.js soll nichts speichern
        cache: "no-store",
      },
    )
    if (!res.ok) {
      console.warn("[google-cal/events] Google API error:", res.status, await res.text())
      return []
    }
    const data = await res.json() as { items?: GoogleApiEvent[] }
    return (data.items ?? [])
      .filter(e => e.status !== "cancelled")
      .map<GoogleCalEvent | null>(e => {
        const startDateTime = e.start?.dateTime
        const startDate = e.start?.date
        const endDateTime = e.end?.dateTime
        const endDate = e.end?.date
        if (!startDateTime && !startDate) return null
        return {
          id: e.id,
          summary: e.summary ?? "(ohne Titel)",
          start: startDateTime ?? startDate ?? "",
          end: endDateTime ?? endDate ?? "",
          allDay: !startDateTime,
          htmlLink: e.htmlLink,
        }
      })
      .filter((e): e is GoogleCalEvent => e !== null)
  } catch (err) {
    console.error("[google-cal/events] fetch exception:", err)
    return []
  }
}
