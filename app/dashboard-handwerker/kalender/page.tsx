"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { ChevronLeft, ChevronRight, Plus, X, Lock } from "lucide-react"
import { useToast } from "@/components/Toast"
import { GoogleCalBanner } from "@/components/handwerker/GoogleCalBanner"
import { useFocusTrap } from "@/lib/use-focus-trap"

// Sprint AK Stufe 1 (27.05.2026): Verfügbarkeits-/Marktplatz-Konzept ist tot.
// Verfügbarkeit = Google-Kalender (Source of Truth) + Reparo-Termine.
// Was bleibt:
//   - Termine-Layer (Aufträge + Vorschläge)
//   - Google-Layer (private Termine als "belegt")
//   - Privat-Block-Layer (Convenience für HW ohne Google; speichert in
//     zeitslots mit status='privat' und art='einmalig' — bleibt erhalten
//     bis Stufe 3 das wegmigriert)
// Layer-Toggles → Legende, weil HW eh immer alles sehen will.
// Wochenstruktur (art='wiederkehrend') und Marktplatz-Slots (status='verfuegbar')
// werden NICHT mehr neu angelegt — Bestand bleibt für Verwalter-Marktplatz lesbar
// bis Stufe 2 das umbaut.

// Sprint AE Phase 3: Google-Cal-Events Read-Only-Anzeige.
interface GoogleEventTag {
  id: string
  datum: string  // YYYY-MM-DD (clipped pro Tag, mehrtätige Events splitten wir)
  von: string    // HH:MM
  bis: string
  summary: string
  htmlLink?: string
}

// Audit-Fix #2 (27.05.): Ganztages-Events (Urlaub etc.) erscheinen als
// schmaler Top-Streifen über der Tagsspalte plus subtiler Hintergrund.
// Klick-Hotzonen sind gesperrt, damit HW sich nicht doppelt verplant.
interface GoogleAllDayTag {
  id: string
  datum: string
  summary: string
  htmlLink?: string
}

// K2.2: Wochen-Kalender mit drei Layer-Toggles. Eine Page für alles,
// was die HW-Zeitplanung umfasst — Termine (bestätigte Aufträge),
// Slots (Marktplatz-Angebote) und Verfügbarkeit (Wochenrhythmus).
// Klick auf leere Stunde öffnet das Slot-Anbieten-Modal direkt im
// Kontext des angeklickten Tages/Zeit-Slots.

const TAGE_LABEL = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
// Sprint AK Stufe 1 (27.05.): jsWochentagToIdx + dbWochentagToIdx entfernt —
// Wochenstruktur ist tot, niemand mappt mehr Wochentag→Spalten-Index.

const STUNDE_VON = 7
const STUNDE_BIS = 20
const STUNDE_HOEHE_PX = 56

// U3-Fix Audit (27.05.): bundesweite DE-Feiertage 2026/2027.
// Im Header der Tagsspalte als Badge anzeigen + visuell als belegt
// markieren (Verfügbarkeit eher unüblich). Regionale Feiertage
// (Fronleichnam, Mariä Himmelfahrt etc.) bewusst weggelassen — HW
// kennt seine Region selbst.
const DE_FEIERTAGE: Record<string, string> = {
  "2026-01-01": "Neujahr",
  "2026-04-03": "Karfreitag",
  "2026-04-06": "Ostermontag",
  "2026-05-01": "Tag d. Arbeit",
  "2026-05-14": "Himmelfahrt",
  "2026-05-25": "Pfingstmontag",
  "2026-10-03": "Tag d. Einheit",
  "2026-12-25": "1. Weihnachten",
  "2026-12-26": "2. Weihnachten",
  "2027-01-01": "Neujahr",
  "2027-03-26": "Karfreitag",
  "2027-03-29": "Ostermontag",
  "2027-05-01": "Tag d. Arbeit",
  "2027-05-06": "Himmelfahrt",
  "2027-05-17": "Pfingstmontag",
  "2027-10-03": "Tag d. Einheit",
  "2027-12-25": "1. Weihnachten",
  "2027-12-26": "2. Weihnachten",
}

interface KalenderTermin {
  id: string
  datum: string
  von: string
  bis: string
  titel: string
  ticket_id: string | null
  status: string
}

interface PrivatBlock {
  // Sprint AK Stufe 1: nur noch status='privat' Slots — Convenience-Blocker
  // für HW ohne Google. Marktplatz-Slots und Wochenstruktur sind tot.
  id: string
  datum: string
  von: string
  bis: string
}

function fmtTime(t: string): string {
  return t.slice(0, 5)
}

// B2-Fix: Google-Cal-API gibt HTML-Entities zurück (z.B. &amp;, &lt;).
// Hier dekodieren wir die häufigsten, ohne einen DOM-Parse zu brauchen.
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

// U7-Fix Audit (27.05.): offsetTop wurde in den Component-Body verschoben,
// da es jetzt vom konfigurierbaren arbVon abhängt. Modul-Level-Variante
// entfernt — wäre dead code.

function eventHeight(von: string, bis: string): number {
  const dauer = timeToMinutes(bis) - timeToMinutes(von)
  return Math.max(20, (dauer / 60) * STUNDE_HOEHE_PX)
}

function getMontag(d: Date): Date {
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  const tag = m.getDay()
  const diff = tag === 0 ? -6 : 1 - tag
  m.setDate(m.getDate() + diff)
  return m
}

function isoDatum(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function formatWochenLabel(montag: Date): string {
  const sonntag = new Date(montag)
  sonntag.setDate(montag.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }
  return `${montag.toLocaleDateString("de", opts)} – ${sonntag.toLocaleDateString("de", opts)}`
}

interface SlotModalState {
  // Sprint AK Stufe 1: Modal blockt nur noch Privat-Zeit. "Verfügbarkeit
  // anbieten" + "Wochenstruktur" sind weg — passiert jetzt im Google-Cal
  // bzw. wird gar nicht mehr aktiv gepflegt (Auctions checken Google direkt).
  datum: string
  von: string
  bis: string
}

export default function KalenderPage() {
  const router = useRouter()
  const { confirm } = useToast()

  const [montag, setMontag] = useState<Date>(() => getMontag(new Date()))
  const [userId, setUserId] = useState<string | null>(null)
  // U7-Fix Audit (27.05.): Arbeitszeit-Fenster aus profile. Default
  // STUNDE_VON/BIS bleibt 7-20 wenn profile leer ist.
  const [arbVon, setArbVon] = useState<number>(STUNDE_VON)
  const [arbBis, setArbBis] = useState<number>(STUNDE_BIS)
  const [termine, setTermine] = useState<KalenderTermin[]>([])
  const [privatBlocks, setPrivatBlocks] = useState<PrivatBlock[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleEventTag[]>([])
  const [googleAllDay, setGoogleAllDay] = useState<GoogleAllDayTag[]>([])
  // Audit-Fix #6: Google-Fetch-Status für sichtbares Feedback im Chip.
  // null = noch nicht geladen / kein Versuch, ""=ok, sonst Fehlertext.
  const [googleFetchError, setGoogleFetchError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [slotModal, setSlotModal] = useState<SlotModalState | null>(null)

  // A11Y-Cleanup (Audit #82): Focus-Trap im "Zeit blockieren"-Modal.
  const slotDialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(slotDialogRef, !!slotModal)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState("")

  const tageDerWoche = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(montag)
      d.setDate(montag.getDate() + i)
      return d
    })
  }, [montag])

  const wochenStartIso = isoDatum(tageDerWoche[0])
  const wochenEndeIso = isoDatum(tageDerWoche[6])

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    setUserId(user.id)

    // Sprint AK Stufe 1: nur noch 3 Quellen — Profil (für Arbeitszeit),
    // Termine, Privat-Blocks. Wochenstruktur + Marktplatz-Slots werden
    // weder geladen noch angezeigt.
    const [{ data: prof }, { data: t }, { data: pb }] = await Promise.all([
      supabase.from("profiles").select("id, arbeitszeit_von, arbeitszeit_bis").eq("id", user.id).single(),
      supabase
        .from("termine")
        .select("id, datum, von, bis, titel, ticket_id, status")
        .eq("handwerker_id", user.id)
        .gte("datum", wochenStartIso)
        .lte("datum", wochenEndeIso),
      supabase
        .from("zeitslots")
        .select("id, datum, von, bis")
        .eq("handwerker_id", user.id)
        .eq("art", "einmalig")
        .eq("status", "privat")
        .gte("datum", wochenStartIso)
        .lte("datum", wochenEndeIso),
    ])

    if (prof) {
      // U7-Fix Audit (27.05.): Arbeitszeit-Fenster aus profile.
      // Defaults via DB-Spalte (von=7, bis=20) — fallback hier nochmal explizit
      // für den Fall, dass ein Legacy-Profil noch NULL hat.
      const pv = (prof as { arbeitszeit_von?: number | null }).arbeitszeit_von
      const pbv = (prof as { arbeitszeit_bis?: number | null }).arbeitszeit_bis
      if (typeof pv === "number" && pv >= 0 && pv <= 23) setArbVon(pv)
      if (typeof pbv === "number" && pbv >= 1 && pbv <= 24 && (typeof pv !== "number" || pbv > pv)) setArbBis(pbv)
    }
    setTermine((t ?? []).filter((x: KalenderTermin) => x.status !== "abgelaufen" && x.status !== "abgelehnt"))
    setPrivatBlocks((pb ?? []) as PrivatBlock[])
    setLoading(false)

    // Sprint AE Phase 3 — Google-Cal-Events laden (parallel, non-blocking).
    // Wenn HW keine Cal-Verbindung hat, returnt API leeres Array.
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const res = await fetch(
          `/api/google-cal/events?from=${wochenStartIso}&to=${wochenEndeIso}`,
          { headers: { authorization: `Bearer ${session.access_token}` } },
        )
        if (res.ok) {
          const json = await res.json() as { events?: Array<{ id: string; summary: string; start: string; end: string; allDay: boolean; htmlLink?: string; reparoTicketId?: string }> }
          // Events pro Tag clippen — Google liefert ISO mit Datum+Zeit
          const perDay: GoogleEventTag[] = []
          const allDay: GoogleAllDayTag[] = []
          for (const ev of (json.events ?? []).filter(e => !e.reparoTicketId)) {
            // ^ Reparo-erstellte Events (via write.ts) werden schon als Reparo-Termin
            // angezeigt — hier überspringen, sonst doppelter Eintrag im Kalender.
            if (ev.allDay) {
              // Google end.date ist EXKLUSIV (z.B. start=Mo, end=Di = nur Mo).
              const sd = new Date(ev.start + "T00:00:00")
              const ed = new Date(ev.end + "T00:00:00")
              const c = new Date(sd)
              while (c < ed) {
                allDay.push({
                  id: ev.id + "-ad-" + isoDatum(c),
                  datum: isoDatum(c),
                  summary: ev.summary,
                  htmlLink: ev.htmlLink,
                })
                c.setDate(c.getDate() + 1)
              }
              continue
            }
            const startDate = new Date(ev.start)
            const endDate = new Date(ev.end)
            // Pro Tag splitten
            const cursor = new Date(startDate)
            while (cursor < endDate) {
              const dayIso = isoDatum(cursor)
              const dayEnd = new Date(cursor)
              dayEnd.setHours(23, 59, 59, 999)
              const segEnd = endDate < dayEnd ? endDate : dayEnd
              const von = `${String(cursor.getHours()).padStart(2, "0")}:${String(cursor.getMinutes()).padStart(2, "0")}`
              const bis = `${String(segEnd.getHours()).padStart(2, "0")}:${String(segEnd.getMinutes()).padStart(2, "0")}`
              perDay.push({
                id: ev.id + "-" + dayIso,
                datum: dayIso,
                von,
                bis,
                summary: ev.summary,
                htmlLink: ev.htmlLink,
              })
              // Cursor auf nächsten Tag 00:00
              cursor.setDate(cursor.getDate() + 1)
              cursor.setHours(0, 0, 0, 0)
            }
          }
          setGoogleEvents(perDay)
          setGoogleAllDay(allDay)
          setGoogleFetchError("")
        } else if (res.status !== 401) {
          // 401 = Bearer-Auth fail oder kein Google-Account → still tolerieren,
          // alles andere ist ein echtes Problem (Token expired upstream o.ä.).
          setGoogleFetchError(`HTTP ${res.status}`)
        }
      }
    } catch (e) {
      console.warn("[kalender] google-events load failed", e)
      setGoogleFetchError(e instanceof Error ? e.message : "fetch_error")
    }
  }, [router, wochenStartIso, wochenEndeIso])

  useEffect(() => { loadData() }, [loadData])

  function shiftWoche(deltaTage: number) {
    const next = new Date(montag)
    next.setDate(montag.getDate() + deltaTage)
    setMontag(getMontag(next))
  }
  function gotoHeute() {
    setMontag(getMontag(new Date()))
  }

  function leereStundeKlick(tagIdx: number, stunde: number) {
    const tag = tageDerWoche[tagIdx]
    const datum = isoDatum(tag)
    const von = String(stunde).padStart(2, "0") + ":00"
    const bis = String(Math.min(stunde + 2, arbBis)).padStart(2, "0") + ":00"
    setSlotModal({ datum, von, bis })
  }

  function terminKlick(t: KalenderTermin) {
    if (t.ticket_id) {
      router.push(`/dashboard-handwerker/ticket/${t.ticket_id}`)
    }
  }

  async function saveSlot() {
    // Sprint AK Stufe 1: Modal speichert nur noch Privat-Blocks
    // (art='einmalig', status='privat'). Yield/Marktplatz-Felder = 0/null.
    if (!slotModal || !userId) return
    if (timeToMinutes(slotModal.bis) <= timeToMinutes(slotModal.von)) {
      setToast("Endzeit muss nach Startzeit liegen.")
      setTimeout(() => setToast(""), 2500)
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("zeitslots").insert({
      handwerker_id: userId,
      titel: "Privat blockiert",
      datum: slotModal.datum,
      von: slotModal.von,
      bis: slotModal.bis,
      basis_preis_stunde: 0,
      dynamischer_preis: 0,
      preisfaktor: 1,
      status: "privat",
      ist_luecke: false,
      art: "einmalig",
    })
    if (error) {
      setToast("Fehler: " + error.message)
    } else {
      setToast("Zeit blockiert.")
      setSlotModal(null)
      await loadData()
    }
    setSaving(false)
    setTimeout(() => setToast(""), 2500)
  }

  async function privatBlockLoeschen(block: PrivatBlock) {
    if (!await confirm(`Block am ${block.datum} ${fmtTime(block.von)}-${fmtTime(block.bis)} entfernen?`)) return
    const supabase = createClient()
    const { error } = await supabase.from("zeitslots").delete().eq("id", block.id)
    if (error) {
      setToast("Fehler: " + error.message)
    } else {
      await loadData()
    }
    setTimeout(() => setToast(""), 2500)
  }

  // U7-Fix Audit (27.05.): stunden-Array aus konfigurierbarem Arbeitsfenster.
  // Wenn Profil ungültig wäre, fallen wir auf 7-20 zurück (Mindest-2h, sonst Fenster leer).
  const sicherArbVon = arbVon >= 0 && arbVon <= 23 ? arbVon : STUNDE_VON
  const sicherArbBis = arbBis > sicherArbVon && arbBis <= 24 ? arbBis : STUNDE_BIS
  const stunden = Array.from({ length: sicherArbBis - sicherArbVon }, (_, i) => sicherArbVon + i)
  const heuteIso = isoDatum(new Date())

  // Lokale Offset-Helper aus konfigurierbarer Start-Stunde — überschreibt
  // die module-level Helper, die hartcodierte STUNDE_VON nutzen.
  const offsetTop = (von: string): number => {
    const mins = timeToMinutes(von) - sicherArbVon * 60
    return (mins / 60) * STUNDE_HOEHE_PX
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="bg-white border-b border-line">
        <div className="max-w-6xl mx-auto pl-14 pr-4 md:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-ink">Kalender</h1>
            <p className="text-xs text-ink-muted">{formatWochenLabel(tageDerWoche[0])}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftWoche(-7)}
              className="w-9 h-9 rounded-lg border border-line hover:bg-surface-muted flex items-center justify-center text-ink-secondary"
              aria-label="Vorherige Woche"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={gotoHeute}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-line hover:bg-surface-muted"
            >
              Heute
            </button>
            {/* F3-Fix Audit (27.05.): Datum-Picker für Direkt-Sprung
                zu spezifischer Woche. Setzt montag auf den Mo der gewählten Woche. */}
            <input
              type="date"
              value={isoDatum(tageDerWoche[0])}
              onChange={(e) => {
                if (e.target.value) setMontag(getMontag(new Date(e.target.value)))
              }}
              className="hidden sm:inline text-xs px-2 py-2 rounded-lg border border-line hover:bg-surface-muted text-ink-secondary"
              aria-label="Zu Woche springen"
            />
            <button
              onClick={() => shiftWoche(7)}
              className="w-9 h-9 rounded-lg border border-line hover:bg-surface-muted flex items-center justify-center text-ink-secondary"
              aria-label="Nächste Woche"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Sprint AK Stufe 1 (27.05.): Filter-Chips → Legende. HW will eh
            immer alles sehen; Toggles waren Erbe vom alten Marktplatz-Konzept. */}
        <div className="max-w-6xl mx-auto pl-14 pr-4 md:px-6 pb-3 flex items-center gap-3 flex-wrap text-[11px]">
          <LegendItem color="bg-accent" label="Auftrag" />
          <LegendItem color="bg-rolle-mieter/50" label="Vorschlag" />
          <LegendItem color="bg-blue-300" label="Google" />
          <LegendItem color="bg-ink/40" label="Privat blockiert" />
          {googleFetchError && (
            <span
              className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"
              title={`Google-Cal: ${googleFetchError}`}
            >
              ⚠ Google nicht erreichbar
            </span>
          )}
          <span className="text-ink-muted ml-auto hidden sm:inline">
            Klick auf eine leere Stunde → Zeit privat blockieren
          </span>
        </div>
      </div>

      {/* Sprint AE — Google-Cal-Connect-Banner (zeigt sich nur wenn HW nicht verbunden) */}
      <div className="max-w-6xl mx-auto px-2 sm:px-6 pt-4">
        <GoogleCalBanner />
      </div>

      {/* B2-Fix Sprint AE Phase 3 + Sprint AK Stufe 1: Mobile-Hint für Erstnutzer
          (Desktop hat die Zeile in der Chips-Bar; Mobile bekommt sie hier). */}
      {privatBlocks.length === 0 && termine.length === 0 && (
        <div className="max-w-6xl mx-auto px-2 sm:px-6 pt-3 sm:hidden">
          <div className="text-[11px] text-ink-muted bg-surface-muted/60 border border-line rounded-lg px-3 py-2">
            Tippe auf eine leere Stunde im Grid, um diese Zeit privat zu blockieren.
          </div>
        </div>
      )}

      {/* U1-Fix Audit (27.05.) + Sprint AK Stufe 1: Empty-State-Onboarding.
          Sichtbar wenn HW noch nichts hat (keine Termine, Privat-Blocks, Google).
          Dismissable via localStorage. Wording entrümpelt — kein "Verfügbarkeit
          anbieten" mehr, weil das Konzept tot ist. */}
      {!loading
        && termine.length === 0
        && privatBlocks.length === 0
        && googleEvents.length === 0
        && googleAllDay.length === 0
        && typeof window !== "undefined"
        && localStorage.getItem("kalenderOnboardingDismissed") !== "1"
        && (
          <div className="max-w-6xl mx-auto px-2 sm:px-6 pt-2">
            <div className="bg-surface-alt border border-line rounded-2xl px-4 py-3 flex items-start gap-3 mb-2">
              <div className="text-2xl flex-shrink-0">📅</div>
              <div className="flex-1 min-w-0 text-sm">
                <div className="font-semibold text-ink mb-1">So füllst du deinen Kalender</div>
                <ol className="text-xs text-ink-muted space-y-0.5 list-decimal pl-4">
                  <li>Verbinde Google-Kalender — deine Privattermine erscheinen automatisch als &bdquo;belegt&ldquo;</li>
                  <li>Aufträge die du übernimmst landen automatisch hier</li>
                  <li>Klick auf eine freie Stunde, um sie manuell zu blockieren (z.B. für Pause)</li>
                </ol>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") localStorage.setItem("kalenderOnboardingDismissed", "1")
                  // Re-render trigger — Toast als no-op state set
                  setToast(" ")
                  setTimeout(() => setToast(""), 100)
                }}
                aria-label="Onboarding ausblenden"
                className="p-1 text-ink-muted hover:text-ink flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )
      }

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-2 sm:px-6 py-4 overflow-x-auto">
        {loading ? (
          <div className="text-center text-sm text-ink-muted py-16">Lädt …</div>
        ) : (
          <div
            className="bg-white border border-line rounded-2xl overflow-hidden"
            style={{ minWidth: "min(700px, 100%)" }}
            /* U9-Fix Audit (27.05.): min-width gibt Tagsspalten auf Mobile
               genug Platz (mind. ~93px pro Spalte); Outer hat overflow-x-auto,
               sodass schmale Screens horizontal scrollen statt zu quetschen. */
          >
            {/* Tagesspalten-Header */}
            <div
              className="grid border-b border-line bg-surface-muted/40"
              style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}
            >
              <div />
              {tageDerWoche.map((d, i) => {
                const isHeute = isoDatum(d) === heuteIso
                const feiertag = DE_FEIERTAGE[isoDatum(d)]
                return (
                  <div key={i} className={`text-center py-2 text-[11px] font-medium ${isHeute ? "text-accent" : "text-ink-secondary"}`}>
                    <div>{TAGE_LABEL[i]}</div>
                    <div className={`text-xs ${isHeute ? "font-bold" : "font-normal"}`}>{d.getDate()}.</div>
                    {feiertag && (
                      <div
                        className="mt-0.5 text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-px mx-1 truncate"
                        title={feiertag}
                      >
                        {feiertag}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Stunden-Grid */}
            <div
              className="grid relative"
              style={{
                gridTemplateColumns: "48px repeat(7, 1fr)",
                gridTemplateRows: `repeat(${stunden.length}, ${STUNDE_HOEHE_PX}px)`,
              }}
            >
              {/* Stunden-Achse */}
              {stunden.map((s) => (
                <div
                  key={s}
                  className="text-[10px] text-ink-muted border-r border-line px-1.5 pt-0.5"
                  style={{ gridColumn: 1 }}
                >
                  {String(s).padStart(2, "0")}:00
                </div>
              ))}

              {/* Tag-Spalten (klickbar für Privat-Block) */}
              {tageDerWoche.map((tag, tagIdx) => {
                const datumIso = isoDatum(tag)
                const tagTermine = termine.filter(t => t.datum === datumIso)
                const tagPrivat = privatBlocks.filter(p => p.datum === datumIso)
                const tagGoogle = googleEvents.filter(g => g.datum === datumIso)
                const tagAllDay = googleAllDay.filter(a => a.datum === datumIso)
                return (
                  <div
                    key={tagIdx}
                    className="relative border-r border-line last:border-r-0"
                    style={{
                      gridColumn: tagIdx + 2,
                      gridRow: `1 / ${stunden.length + 1}`,
                    }}
                  >
                    {/* Stunden-Trennlinien */}
                    {stunden.slice(1).map((s) => (
                      <div
                        key={s}
                        className="absolute left-0 right-0 border-t border-line/60"
                        style={{ top: (s - sicherArbVon) * STUNDE_HOEHE_PX }}
                      />
                    ))}

                    {/* Sprint AE Phase 3 — Ganztages-Google-Events: subtiler
                        Hintergrund über die volle Spalte + Top-Band mit Summary.
                        Klick-Hotzonen sind oben via tagAllDay.length > 0 gesperrt. */}
                    {tagAllDay.length > 0 && (
                      <>
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(45deg, rgba(59,130,246,0.06) 0 6px, transparent 6px 12px)",
                          }}
                        />
                        <div className="absolute left-0 right-0 top-0 z-10 flex flex-col gap-0.5 p-1">
                          {tagAllDay.map(a => (
                            <div
                              key={a.id}
                              role={a.htmlLink ? "button" : undefined}
                              tabIndex={a.htmlLink ? 0 : undefined}
                              onClick={() => a.htmlLink && window.open(a.htmlLink, "_blank", "noopener,noreferrer")}
                              onKeyDown={e => e.key === "Enter" && a.htmlLink && window.open(a.htmlLink, "_blank", "noopener,noreferrer")}
                              className={`block rounded-md bg-blue-100 border border-blue-200 text-blue-900 px-2 py-0.5 transition-colors truncate text-[10px] font-medium ${a.htmlLink ? "cursor-pointer hover:bg-blue-200" : "cursor-default"}`}
                              title={`Ganztägig: ${decodeHtml(a.summary)}`}
                            >
                              <span className="text-blue-700 font-semibold mr-1">Google</span>
                              {decodeHtml(a.summary)}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Klick-Hotzone pro Stunde (öffnet Privat-Block-Modal).
                        Sprint AK Stufe 1: keine Layer-Toggles mehr — Google, Termine
                        und Privat-Blocks blockieren Klick gleich, weil's eh alle Quellen
                        zeigen. */}
                    {stunden.map((s) => {
                      const stundeStart = String(s).padStart(2, "0") + ":00"
                      const stundeEnde = String(s + 1).padStart(2, "0") + ":00"
                      const istBelegt =
                        tagTermine.some(t => overlap(t.von, t.bis, stundeStart, stundeEnde)) ||
                        tagPrivat.some(p => overlap(p.von, p.bis, stundeStart, stundeEnde)) ||
                        tagGoogle.some(g => overlap(g.von, g.bis, stundeStart, stundeEnde)) ||
                        tagAllDay.length > 0
                      if (istBelegt) return null
                      return (
                        <button
                          key={`hot-${s}`}
                          onClick={() => leereStundeKlick(tagIdx, s)}
                          className="absolute left-0 right-0 hover:bg-ink/5 group flex items-center justify-center"
                          style={{
                            top: (s - sicherArbVon) * STUNDE_HOEHE_PX,
                            height: STUNDE_HOEHE_PX,
                          }}
                          aria-label={`Zeit blockieren ${datumIso} ${stundeStart}`}
                        >
                          <Lock size={12} className="opacity-0 group-hover:opacity-50 text-ink-muted" />
                        </button>
                      )
                    })}

                    {/* Privat-Block-Layer — graue Blöcke, klickbar zum Löschen */}
                    {tagPrivat.map(p => (
                      <button
                        key={p.id}
                        onClick={() => privatBlockLoeschen(p)}
                        className="absolute left-1 right-1 rounded-md text-left px-2 py-1 transition-colors bg-ink/10 border border-ink/30 hover:bg-ink/15"
                        style={{
                          top: offsetTop(p.von) + 2,
                          height: eventHeight(p.von, p.bis) - 4,
                        }}
                        title="Privat blockiert — entfernen?"
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/80">🔒 Privat</div>
                        <div className="text-[10px] truncate text-ink/70">
                          {fmtTime(p.von)}–{fmtTime(p.bis)}
                        </div>
                      </button>
                    ))}

                    {/* Sprint AE Phase 3 — Google-Cal-Events (Read-Only, links eingerückt) */}
                    {/* B3-Fix: <a> → <div role="button"> verhindert blank-tab bei Klick.
                        B2-Fix: decodeHtml() dekodiert &amp; u.a. aus Google-API. */}
                    {tagGoogle.map(g => (
                      <div
                        key={g.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => g.htmlLink && window.open(g.htmlLink, "_blank", "noopener,noreferrer")}
                        onKeyDown={e => e.key === "Enter" && g.htmlLink && window.open(g.htmlLink, "_blank", "noopener,noreferrer")}
                        className="absolute left-1 right-1 rounded-md bg-blue-50 border border-blue-200 text-blue-900 px-2 py-1 hover:bg-blue-100 transition-colors cursor-pointer"
                        style={{
                          top: offsetTop(g.von) + 2,
                          height: eventHeight(g.von, g.bis) - 4,
                          opacity: 0.85,
                        }}
                        title={`Google: ${decodeHtml(g.summary)} (${fmtTime(g.von)}–${fmtTime(g.bis)})`}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Google</div>
                        <div className="text-[10px] truncate text-blue-900">{decodeHtml(g.summary)}</div>
                        <div className="text-[10px] text-blue-800/70 truncate">{fmtTime(g.von)}–{fmtTime(g.bis)}</div>
                      </div>
                    ))}

                    {/* Termin-Layer */}
                    {tagTermine.map(t => {
                      const istVorschlag = t.status === "vorgeschlagen"
                      return (
                        <button
                          key={t.id}
                          onClick={() => terminKlick(t)}
                          className={`absolute left-1 right-1 rounded-md text-left px-2 py-1 border transition-colors ${
                            istVorschlag
                              ? "bg-rolle-mieter/15 border-rolle-mieter/40 hover:bg-rolle-mieter/25"
                              : "bg-accent text-white border-accent hover:bg-accent-hover"
                          }`}
                          style={{
                            top: offsetTop(t.von) + 2,
                            height: eventHeight(t.von, t.bis) - 4,
                            opacity: istVorschlag ? 0.7 : 1,
                          }}
                          title={t.titel}
                        >
                          <div className={`text-[10px] font-semibold uppercase tracking-wide ${
                            istVorschlag ? "text-rolle-mieter" : "text-white/90"
                          }`}>
                            {istVorschlag ? "Vorschlag" : "Auftrag"}
                          </div>
                          <div className={`text-[10px] truncate ${istVorschlag ? "text-rolle-mieter/80" : "text-white"}`}>
                            {fmtTime(t.von)}–{fmtTime(t.bis)}
                          </div>
                          <div className={`text-[10px] truncate ${istVorschlag ? "text-rolle-mieter/70" : "text-white/80"}`}>
                            {t.titel}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )
              })}

              {/* U2-Fix Audit (27.05.): Rote Now-Linie — nur sichtbar wenn
                  heute in der aktuell angezeigten Woche liegt UND innerhalb
                  des konfigurierten Arbeitsfensters (U7). */}
              {(() => {
                const now = new Date()
                const heuteInWoche = tageDerWoche.some(t => isoDatum(t) === isoDatum(now))
                if (!heuteInWoche) return null
                const nowMin = now.getHours() * 60 + now.getMinutes()
                const minOffset = nowMin - sicherArbVon * 60
                if (minOffset < 0 || minOffset > (sicherArbBis - sicherArbVon) * 60) return null
                const top = (minOffset / 60) * STUNDE_HOEHE_PX
                return (
                  <div
                    className="pointer-events-none absolute z-30 flex items-center"
                    style={{ top: `${top}px`, left: "48px", right: 0 }}
                    aria-hidden="true"
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0 shadow" />
                    <div className="flex-1 h-px bg-red-500/80" />
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-white text-xs px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {slotModal && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-end md:items-center justify-center p-4"
          onClick={() => !saving && setSlotModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            ref={slotDialogRef}
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                <Lock size={16} className="text-ink-muted" /> Zeit blockieren
              </h2>
              <button onClick={() => setSlotModal(null)} aria-label="Schließen" className="text-ink-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-ink-muted">
                Markiere diese Zeit als belegt — niemand kann dir hier einen Auftrag
                vorschlagen. Tipp: wenn du Google verbunden hast, trag wiederkehrende
                Termine direkt dort ein.
              </p>

              <div>
                <label className="block text-[11px] font-medium text-ink-muted mb-1">Datum</label>
                <input
                  type="date"
                  value={slotModal.datum}
                  onChange={e => setSlotModal(s => s ? { ...s, datum: e.target.value } : null)}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">Von</label>
                  <input
                    type="time"
                    value={slotModal.von}
                    onChange={e => setSlotModal(s => s ? { ...s, von: e.target.value } : null)}
                    className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">Bis</label>
                  <input
                    type="time"
                    value={slotModal.bis}
                    onChange={e => setSlotModal(s => s ? { ...s, bis: e.target.value } : null)}
                    className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setSlotModal(null)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm text-ink-secondary hover:bg-surface-muted"
                >
                  Abbrechen
                </button>
                <button
                  onClick={saveSlot}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-ink text-white hover:bg-ink/90 disabled:opacity-50"
                >
                  {saving ? "Speichert …" : "Blockieren"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Sprint AK Stufe 1 (27.05.): Legende statt Filter-Chips — vier kleine
// farbige Punkte mit Label, kein Klick, nur Hinweis welche Farbe was bedeutet.
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-muted">
      <span className={`w-2.5 h-2.5 rounded-sm ${color}`} aria-hidden="true" />
      {label}
    </span>
  )
}

function overlap(aVon: string, aBis: string, bVon: string, bBis: string): boolean {
  return timeToMinutes(aVon) < timeToMinutes(bBis) && timeToMinutes(aBis) > timeToMinutes(bVon)
}
