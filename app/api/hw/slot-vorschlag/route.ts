import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { listEventsForUser } from "@/lib/google-cal/events"

// GET /api/hw/slot-vorschlag?ticket_id=xxx
// Sprint AW Phase 3 — KI-gestützte Termin-Slot-Vorschläge für HW.
//
// Analysiert:
//   - Bestehende Reparo-Termine des HW (belegte Zeiten)
//   - Google-Calendar-Events des HW (falls verbunden)
//   - Ticketpriorität (notfall/zeitnah/planbar → Suchfenster)
//   - Arbeitszeiten aus HW-Profil (frueheste_stunde / spaeteste_stunde)
//
// Gibt 3 freie Zeitfenster zurück, die:
//   - Zur Priorität passen (notfall: 1-2 Tage, zeitnah: 1 Woche, planbar: 2 Wochen)
//   - Nicht mit bestehenden Terminen/Google-Events kollidieren
//   - Innerhalb der Arbeitszeit des HW liegen
//   - Auf Werktage fallen (Mo–Sa)
//
// Jeder Slot hat 2 Stunden Dauer (Branche-Standard als Default).
// Auth: eingeloggter HW (Bearer oder Cookie).

const SLOT_DAUER_MIN = 120  // 2 Stunden Standard-Dauer

interface SlotVorschlag {
  datum: string  // "YYYY-MM-DD"
  von: string    // "HH:MM"
  bis: string    // "HH:MM"
}

interface BelegtBlock {
  start: Date
  end: Date
}

/** Konvertiert "HH:MM" + Datum zu Date */
function toDate(datum: string, zeit: string): Date {
  return new Date(`${datum}T${zeit.length === 5 ? zeit + ":00" : zeit}`)
}

/** Prüft ob ein Kandidat-Slot mit bestehenden Blöcken überlappt. */
function kollision(kandidat: { start: Date; end: Date }, belegt: BelegtBlock[]): boolean {
  for (const b of belegt) {
    // Überlappung wenn: kandidat.start < b.end UND kandidat.end > b.start
    if (kandidat.start < b.end && kandidat.end > b.start) return true
  }
  return false
}

/** Gibt den Suchhorizont in Tagen zurück basierend auf Ticket-Priorität. */
function horizontTage(prioritaet: string | null): number {
  if (prioritaet === "notfall") return 2
  if (prioritaet === "zeitnah") return 7
  return 14  // planbar
}

/** "YYYY-MM-DD" aus einem Date in Berlin-Timezone */
function toBerlinDateString(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })
}

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const ticketId = url.searchParams.get("ticket_id")

  const admin = createServiceRoleClient()

  // 1. HW-Profil (Arbeitszeiten)
  const { data: profil } = await admin
    .from("profiles")
    .select("frueheste_stunde, spaeteste_stunde")
    .eq("id", user.id)
    .maybeSingle<{ frueheste_stunde: number | null; spaeteste_stunde: number | null }>()

  const fruehsteH = profil?.frueheste_stunde ?? 7   // 07:00 Uhr Standard
  const spaetesteH = profil?.spaeteste_stunde ?? 18  // 18:00 Uhr Standard

  // 2. Ticketpriorität (für Suchhorizont)
  let prioritaet: string | null = "planbar"
  if (ticketId) {
    const { data: ticket } = await admin
      .from("tickets")
      .select("prioritaet")
      .eq("id", ticketId)
      .maybeSingle<{ prioritaet: string | null }>()
    prioritaet = ticket?.prioritaet ?? "planbar"
  }

  const horizont = horizontTage(prioritaet)
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  const vonDatum = new Date(heute)
  // Notfall: ab heute, sonst: ab morgen (HW braucht Vorlaufzeit für normale Fälle)
  if (prioritaet !== "notfall") vonDatum.setDate(vonDatum.getDate() + 1)
  const bisDatum = new Date(heute)
  bisDatum.setDate(bisDatum.getDate() + horizont)

  // 3. Existierende Termine aus Reparo
  const vonStr = toBerlinDateString(vonDatum)
  const bisStr = toBerlinDateString(bisDatum)

  const { data: termineRaw } = await admin
    .from("termine")
    .select("datum, von, bis, status")
    .eq("handwerker_id", user.id)
    .gte("datum", vonStr)
    .lte("datum", bisStr)
    .in("status", ["bestaetigt", "vorgeschlagen"])
    .returns<Array<{ datum: string; von: string; bis: string; status: string }>>()

  const belegtReparo: BelegtBlock[] = (termineRaw ?? []).map(t => ({
    start: toDate(t.datum, t.von),
    end: toDate(t.datum, t.bis),
  }))

  // 4. Google-Cal-Events (optional — silent fail wenn nicht verbunden)
  const googleEvents = await listEventsForUser(user.id, vonDatum, bisDatum).catch(() => [])
  const belegtGoogle: BelegtBlock[] = googleEvents
    .filter(e => !e.allDay)
    .map(e => ({ start: new Date(e.start), end: new Date(e.end) }))

  const alleBelegt = [...belegtReparo, ...belegtGoogle]

  // 5. Kandidaten-Slots generieren (stündlich von fruehsteH bis spaetesteH - 2h)
  const vorschlaege: SlotVorschlag[] = []
  const kandidat = new Date(vonDatum)

  while (kandidat <= bisDatum && vorschlaege.length < 3) {
    const wochentag = kandidat.getDay()  // 0=Sonntag, 6=Samstag
    if (wochentag !== 0) {  // keine Sonntage
      // Versuche verschiedene Uhrzeiten an diesem Tag
      for (let h = fruehsteH; h <= spaetesteH - 2; h++) {
        if (vorschlaege.length >= 3) break

        // Bevorzuge Morgenstunden zuerst (7, 8, 9), dann Mittag (10, 11, 12, 13)
        const slotStart = new Date(kandidat)
        slotStart.setHours(h, 0, 0, 0)
        const slotEnd = new Date(slotStart)
        slotEnd.setMinutes(slotStart.getMinutes() + SLOT_DAUER_MIN)

        // Nicht in der Vergangenheit
        if (slotStart <= new Date()) continue

        if (!kollision({ start: slotStart, end: slotEnd }, alleBelegt)) {
          const von = `${String(h).padStart(2, "0")}:00`
          const bis = `${String(h + Math.floor(SLOT_DAUER_MIN / 60)).padStart(2, "0")}:${String(SLOT_DAUER_MIN % 60).padStart(2, "0")}`
          vorschlaege.push({
            datum: toBerlinDateString(slotStart),
            von,
            bis,
          })
          // Pro Tag max. 1 Slot (nicht mehrere Vorschläge am gleichen Tag)
          break
        }
      }
    }
    kandidat.setDate(kandidat.getDate() + 1)
  }

  return NextResponse.json({
    vorschlaege,
    prioritaet,
    horizont,
    google_cal_genutzt: googleEvents.length > 0,
  })
}
