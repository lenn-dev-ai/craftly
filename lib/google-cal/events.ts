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
  reparoTicketId?: string  // gesetzt wenn Event von Reparo erstellt wurde → Duplikat-Filter
}

interface GoogleApiEvent {
  id: string
  summary?: string
  status?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  htmlLink?: string
  extendedProperties?: { private?: { reparo_ticket_id?: string } }
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
          reparoTicketId: e.extendedProperties?.private?.reparo_ticket_id,
        }
      })
      .filter((e): e is GoogleCalEvent => e !== null)
  } catch (err) {
    console.error("[google-cal/events] fetch exception:", err)
    return []
  }
}

/**
 * F1-Fix Audit (27.05.): Quick-Check für Auctions — gibt true zurück wenn
 * der User im angefragten Zeitfenster MINDESTENS einen busy Google-Event hat.
 * Wird vom Notfall-Match aufgerufen, um HW auszuschließen, die gerade privat
 * verplant sind. Performance-Notiz: 1 Google-API-Call pro HW; Aufrufer
 * sollte das auf Top-N Kandidaten begrenzen (nicht ganzen Radius scannen).
 *
 * Returns false bei: kein Token (HW nicht verbunden), API-Fehler, keine
 * Events. Heißt: "not connected" = "frei verfügbar" (kein false-positive
 * Block für HW ohne Google-Setup).
 */
export async function hasGoogleEventInRange(
  userId: string,
  from: Date,
  to: Date,
): Promise<boolean> {
  const events = await listEventsForUser(userId, from, to)
  // Auch All-Day-Events zählen — wenn HW "Urlaub" eingetragen hat, ist
  // er auch für 2h-Notfall-Slot nicht verfügbar.
  return events.length > 0
}

/**
 * Konvertiert Berlin-Lokalzeit (datum "YYYY-MM-DD", zeit "HH:MM" oder "HH:MM:SS")
 * in ein UTC-Date-Objekt. Berücksichtigt automatisch CET (UTC+1) / CEST (UTC+2).
 *
 * Hintergrund: Netlify-Functions laufen in UTC (TZ=UTC). Ein naives
 * `new Date("2026-06-20T09:00:00")` wird als 09:00 UTC interpretiert,
 * nicht als 09:00 Berlin (= 07:00 UTC in CEST). Diese Funktion korrigiert
 * das und stellt sicher dass Google-Cal-Queries im richtigen Fenster suchen.
 */
export function parseBerlinTime(datum: string, zeit: string): Date {
  // Midday UTC on the given date — safe anchor to determine DST offset
  const anchor = new Date(`${datum}T12:00:00Z`)
  const berlinHour = parseInt(
    new Intl.DateTimeFormat("en", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      hour12: false,
    }).format(anchor),
    10,
  )
  // Berlin offset in hours relative to UTC (e.g. 14 - 12 = +2 for CEST)
  const offsetHours = berlinHour - 12
  const z = zeit.slice(0, 5) // "HH:MM"
  // Parse as UTC literal, then shift by Berlin offset to get true UTC
  const asUtcLiteral = new Date(`${datum}T${z}:00Z`)
  return new Date(asUtcLiteral.getTime() - offsetHours * 60 * 60 * 1000)
}
