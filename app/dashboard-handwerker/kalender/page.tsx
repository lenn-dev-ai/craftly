"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { ChevronLeft, ChevronRight, Plus, X, Briefcase, Sun } from "lucide-react"
import { GEWERK_BASIS_PREISE, berechneDynamischenPreis } from "@/lib/yield-management"
import { useToast } from "@/components/Toast"
import { GoogleCalBanner } from "@/components/handwerker/GoogleCalBanner"

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
// Wochentag-Index in JS Date: 0=Sonntag … 6=Samstag.
// Wir mappen auf unseren Mo-So-Index 0..6.
function jsWochentagToIdx(jsTag: number): number {
  return (jsTag + 6) % 7
}
// Umgekehrt: für `verfuegbarkeiten.wochentag` (DB-Konvention 0=So..6=Sa
// wie in Sidebar.tsx beobachtet) → unseren Mo-So-Index.
function dbWochentagToIdx(dbTag: number): number {
  return (dbTag + 6) % 7
}

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

interface KalenderSlot {
  id: string
  datum: string
  von: string
  bis: string
  basis_preis_stunde: number | null
  dynamischer_preis: number | null
  status: string
}

interface KalenderVerf {
  // B4: aus zeitslots mit art='wiederkehrend' geladen — wochentag-basierte
  // Wochenstruktur ohne konkretes Datum.
  wochentag: number
  von: string
  bis: string
}

function fmtTime(t: string): string {
  return t.slice(0, 5)
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function eventOffsetTop(von: string): number {
  const mins = timeToMinutes(von) - STUNDE_VON * 60
  return (mins / 60) * STUNDE_HOEHE_PX
}

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
  datum: string
  von: string
  bis: string
  // B2: "wiederkehrend" macht aus dem einmaligen zeitslots-Eintrag eine
  // wöchentliche verfuegbarkeiten-Zeile (handwerker_id + wochentag).
  wiederkehrend: boolean
  // F2-Fix Audit (27.05.): "privat" = Blockzeit (Mittagspause, Arzt etc.).
  // Speichert status='privat' statt 'verfuegbar' → Marktplatz filtert ihn raus.
  privat: boolean
}

const WOCHENTAG_NAME = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"]

export default function KalenderPage() {
  const router = useRouter()
  const { confirm } = useToast()

  const [montag, setMontag] = useState<Date>(() => getMontag(new Date()))
  // B1: "Slots" als separates User-Konzept ist weg. Der Verfügbarkeit-Toggle
  // steuert jetzt sowohl die Wochenstruktur-Hintergründe als auch die
  // konkreten Buchungsfenster aus public.zeitslots.
  const [layers, setLayers] = useState({ termine: true, verfuegbarkeit: true, google: true })
  const [userId, setUserId] = useState<string | null>(null)
  const [profileGewerk, setProfileGewerk] = useState<string>("allgemein")
  const [profileBasisPreis, setProfileBasisPreis] = useState<number>(50)
  const [termine, setTermine] = useState<KalenderTermin[]>([])
  const [slots, setSlots] = useState<KalenderSlot[]>([])
  const [verf, setVerf] = useState<KalenderVerf[]>([])
  const [googleEvents, setGoogleEvents] = useState<GoogleEventTag[]>([])
  const [googleAllDay, setGoogleAllDay] = useState<GoogleAllDayTag[]>([])
  // Audit-Fix #6: Google-Fetch-Status für sichtbares Feedback im Chip.
  // null = noch nicht geladen / kein Versuch, ""=ok, sonst Fehlertext.
  const [googleFetchError, setGoogleFetchError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [slotModal, setSlotModal] = useState<SlotModalState | null>(null)
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

    const [{ data: prof }, { data: t }, { data: s }, { data: v }] = await Promise.all([
      supabase.from("profiles").select("id, gewerk, basis_preis").eq("id", user.id).single(),
      supabase
        .from("termine")
        .select("id, datum, von, bis, titel, ticket_id, status")
        .eq("handwerker_id", user.id)
        .gte("datum", wochenStartIso)
        .lte("datum", wochenEndeIso),
      // B4: konkrete Slots — nur art='einmalig' mit datum-Filter.
      supabase
        .from("zeitslots")
        .select("id, datum, von, bis, basis_preis_stunde, dynamischer_preis, status")
        .eq("handwerker_id", user.id)
        .eq("art", "einmalig")
        .gte("datum", wochenStartIso)
        .lte("datum", wochenEndeIso),
      // B4: Wochenstruktur lebt jetzt in zeitslots (art='wiederkehrend'),
      // status='verfuegbar' filtert deaktivierte Strukturen.
      supabase
        .from("zeitslots")
        .select("wochentag, von, bis, status")
        .eq("handwerker_id", user.id)
        .eq("art", "wiederkehrend")
        .eq("status", "verfuegbar"),
    ])

    if (prof) {
      setProfileGewerk(prof.gewerk || "allgemein")
      setProfileBasisPreis(prof.basis_preis ?? GEWERK_BASIS_PREISE[prof.gewerk || "allgemein"] ?? 50)
    }
    setTermine((t ?? []).filter((x: KalenderTermin) => x.status !== "abgelaufen" && x.status !== "abgelehnt"))
    setSlots(s ?? [])
    setVerf(v ?? [])
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
          const json = await res.json() as { events?: Array<{ id: string; summary: string; start: string; end: string; allDay: boolean; htmlLink?: string }> }
          // Events pro Tag clippen — Google liefert ISO mit Datum+Zeit
          const perDay: GoogleEventTag[] = []
          const allDay: GoogleAllDayTag[] = []
          for (const ev of json.events ?? []) {
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
    const bis = String(Math.min(stunde + 2, STUNDE_BIS)).padStart(2, "0") + ":00"
    setSlotModal({ datum, von, bis, wiederkehrend: false, privat: false })
  }

  function terminKlick(t: KalenderTermin) {
    if (t.ticket_id) {
      router.push(`/dashboard-handwerker/ticket/${t.ticket_id}`)
    }
  }

  async function saveSlot() {
    if (!slotModal || !userId) return
    if (timeToMinutes(slotModal.bis) <= timeToMinutes(slotModal.von)) {
      setToast("Endzeit muss nach Startzeit liegen.")
      setTimeout(() => setToast(""), 2500)
      return
    }
    setSaving(true)
    const supabase = createClient()

    let insErr: { message: string } | null = null
    const basisPreis = profileBasisPreis || GEWERK_BASIS_PREISE[profileGewerk] || 50
    // F2-Fix Audit (27.05.): privat-Blockzeit ist immer einmalig (kein
    // wiederkehrender Privattermin via Modal — dafür Google nutzen).
    const slotStatus = slotModal.privat ? "privat" : "verfuegbar"
    if (slotModal.wiederkehrend && !slotModal.privat) {
      // B4: Wochenstruktur — Zeile in zeitslots mit art='wiederkehrend',
      // datum=null. wochentag aus dem geklickten Datum (JS getDay() ≡ DB).
      const wochentag = new Date(slotModal.datum).getDay()
      const { error } = await supabase.from("zeitslots").insert({
        handwerker_id: userId,
        titel: "Wochenstruktur",
        gewerk: profileGewerk,
        datum: null,
        von: slotModal.von,
        bis: slotModal.bis,
        basis_preis_stunde: basisPreis,
        status: "verfuegbar",
        ist_luecke: false,
        art: "wiederkehrend",
        wochentag,
      })
      insErr = error
    } else {
      // Einmaliger Slot oder Privat-Block — art='einmalig'.
      // Privat: ohne Preisberechnung (=0), nicht im Marktplatz.
      const preisInfo = slotModal.privat
        ? { dynamischerPreis: 0, gesamtFaktor: 1 }
        : berechneDynamischenPreis(
            basisPreis,
            slotModal.datum,
            slotModal.von,
            0,
            slots.filter(s => s.status === "verfuegbar").length,
            false,
          )
      const { error } = await supabase.from("zeitslots").insert({
        handwerker_id: userId,
        titel: slotModal.privat ? "Privat blockiert" : `Slot ${slotModal.datum}`,
        gewerk: profileGewerk,
        datum: slotModal.datum,
        von: slotModal.von,
        bis: slotModal.bis,
        basis_preis_stunde: slotModal.privat ? 0 : basisPreis,
        dynamischer_preis: preisInfo.dynamischerPreis,
        preisfaktor: preisInfo.gesamtFaktor,
        status: slotStatus,
        ist_luecke: false,
        art: "einmalig",
      })
      insErr = error
    }

    if (insErr) {
      setToast("Fehler: " + insErr.message)
    } else {
      setToast(
        slotModal.wiederkehrend
          ? "Wochenstruktur ergänzt."
          : "Verfügbarkeit eingetragen.",
      )
      setSlotModal(null)
      await loadData()
    }
    setSaving(false)
    setTimeout(() => setToast(""), 2500)
  }

  async function slotLoeschen(slot: KalenderSlot) {
    if (!await confirm(`Slot am ${slot.datum} ${fmtTime(slot.von)}-${fmtTime(slot.bis)} entfernen?`)) return
    const supabase = createClient()
    const { error } = await supabase.from("zeitslots").delete().eq("id", slot.id)
    if (error) {
      setToast("Fehler: " + error.message)
    } else {
      await loadData()
    }
    setTimeout(() => setToast(""), 2500)
  }

  const stunden = Array.from({ length: STUNDE_BIS - STUNDE_VON }, (_, i) => STUNDE_VON + i)
  const heuteIso = isoDatum(new Date())

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

        {/* Layer-Toggles */}
        <div className="max-w-6xl mx-auto pl-14 pr-4 md:px-6 pb-3 flex items-center gap-2 flex-wrap">
          <LayerChip
            label="Termine"
            icon={<Briefcase size={13} />}
            active={layers.termine}
            tone="termine"
            onClick={() => setLayers(l => ({ ...l, termine: !l.termine }))}
          />
          <LayerChip
            label="Verfügbarkeit"
            icon={<Sun size={13} />}
            active={layers.verfuegbarkeit}
            tone="verf"
            onClick={() => setLayers(l => ({ ...l, verfuegbarkeit: !l.verfuegbarkeit }))}
          />
          <LayerChip
            label={googleFetchError ? "Google ⚠" : "Google"}
            icon={<Briefcase size={13} />}
            active={layers.google}
            tone="google"
            onClick={() => setLayers(l => ({ ...l, google: !l.google }))}
            title={googleFetchError ? `Google-Cal nicht erreichbar: ${googleFetchError}` : undefined}
          />
          <span className="text-[11px] text-ink-faint ml-auto hidden sm:inline">
            Klick auf eine leere Stunde → Verfügbarkeit anbieten
          </span>
        </div>
      </div>

      {/* Sprint AE — Google-Cal-Connect-Banner (zeigt sich nur wenn HW nicht verbunden) */}
      <div className="max-w-6xl mx-auto px-2 sm:px-6 pt-4">
        <GoogleCalBanner />
      </div>

      {/* B2-Fix Sprint AE Phase 3: Mobile-Hint für Erstnutzer
          (Desktop hat die Zeile in der Chips-Bar; Mobile bekommt sie hier).
          Versteckt sich, sobald HW schon Slots/Verfügbarkeit eingetragen hat. */}
      {slots.length === 0 && verf.length === 0 && (
        <div className="max-w-6xl mx-auto px-2 sm:px-6 pt-3 sm:hidden">
          <div className="text-[11px] text-ink-muted bg-surface-muted/60 border border-line rounded-lg px-3 py-2">
            Tippe auf eine leere Stunde im Grid, um deine Verfügbarkeit dort anzubieten.
          </div>
        </div>
      )}

      {/* U1-Fix Audit (27.05.): Empty-State-Onboarding für Erstnutzer.
          Sichtbar wenn HW noch nichts angelegt hat (keine Termine, Slots,
          Verfügbarkeiten, Google-Events). Dismissable via localStorage.
          Soll Klick-Pfad zeigen, nicht über-erklären. */}
      {!loading
        && termine.length === 0
        && slots.length === 0
        && verf.length === 0
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
                  <li>Klick auf eine freie Stunde im Grid → biete diese Zeit als Verfügbarkeit an</li>
                  <li>Oder verbinde Google-Kalender — deine Privattermine erscheinen automatisch</li>
                  <li>Aufträge die du übernimmst landen ebenfalls hier</li>
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
                  className="text-[10px] text-ink-faint border-r border-line px-1.5 pt-0.5"
                  style={{ gridColumn: 1 }}
                >
                  {String(s).padStart(2, "0")}:00
                </div>
              ))}

              {/* Tag-Spalten (klickbar für Slot-Anbieten) */}
              {tageDerWoche.map((tag, tagIdx) => {
                const datumIso = isoDatum(tag)
                const tagIdxMoSo = tagIdx
                const tagTermine = termine.filter(t => t.datum === datumIso)
                const tagSlots = slots.filter(s => s.datum === datumIso)
                const tagVerf = verf.filter(v => dbWochentagToIdx(v.wochentag) === tagIdxMoSo)
                const tagGoogle = googleEvents.filter(g => g.datum === datumIso)
                const tagAllDay = layers.google ? googleAllDay.filter(a => a.datum === datumIso) : []
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
                        style={{ top: (s - STUNDE_VON) * STUNDE_HOEHE_PX }}
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
                            <a
                              key={a.id}
                              href={a.htmlLink || "https://calendar.google.com"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-md bg-blue-100 border border-blue-200 text-blue-900 px-2 py-0.5 hover:bg-blue-200 transition-colors truncate text-[10px] font-medium"
                              title={`Ganztägig: ${a.summary}`}
                            >
                              <span className="text-blue-700 font-semibold mr-1">Google</span>
                              {a.summary}
                            </a>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Verfügbarkeits-Layer (Hintergrund) */}
                    {layers.verfuegbarkeit && tagVerf.map((v, vi) => (
                      <div
                        key={`v-${vi}`}
                        className="absolute left-0 right-0 bg-accent/8 border-l-2 border-accent/30 pointer-events-none"
                        style={{
                          top: eventOffsetTop(v.von),
                          height: eventHeight(v.von, v.bis),
                        }}
                      />
                    ))}

                    {/* Klick-Hotzone pro Stunde (für leere Slots).
                        Sprint AE Phase 3 Fix: Google-Events blockieren Klick ebenfalls,
                        damit HW sich nicht doppelt verplant (gegen Privat-Termin). */}
                    {stunden.map((s) => {
                      const stundeStart = String(s).padStart(2, "0") + ":00"
                      const stundeEnde = String(s + 1).padStart(2, "0") + ":00"
                      const istBelegt =
                        tagTermine.some(t => overlap(t.von, t.bis, stundeStart, stundeEnde)) ||
                        tagSlots.some(sl => overlap(sl.von, sl.bis, stundeStart, stundeEnde)) ||
                        tagGoogle.some(g => overlap(g.von, g.bis, stundeStart, stundeEnde)) ||
                        tagAllDay.length > 0
                      if (istBelegt) return null
                      return (
                        <button
                          key={`hot-${s}`}
                          onClick={() => leereStundeKlick(tagIdx, s)}
                          className="absolute left-0 right-0 hover:bg-accent/5 group flex items-center justify-center"
                          style={{
                            top: (s - STUNDE_VON) * STUNDE_HOEHE_PX,
                            height: STUNDE_HOEHE_PX,
                          }}
                          aria-label={`Verfügbarkeit anbieten ${datumIso} ${stundeStart}`}
                        >
                          <Plus size={14} className="opacity-0 group-hover:opacity-60 text-accent" />
                        </button>
                      )
                    })}

                    {/* Slot-Layer — Verfügbarkeit (warm-orange) ODER privat (grau).
                        F2-Fix Audit (27.05.): status='privat' = HW-Blockzeit, nicht
                        im Marktplatz, anders gerendert. */}
                    {layers.verfuegbarkeit && tagSlots.map(s => {
                      const istPrivat = s.status === "privat"
                      return (
                        <button
                          key={s.id}
                          onClick={() => slotLoeschen(s)}
                          className={`absolute left-1 right-1 rounded-md text-left px-2 py-1 transition-colors ${
                            istPrivat
                              ? "bg-ink/10 border border-ink/30 hover:bg-ink/15"
                              : "bg-warm-light border border-warm/30 hover:bg-warm/15"
                          }`}
                          style={{
                            top: eventOffsetTop(s.von) + 2,
                            height: eventHeight(s.von, s.bis) - 4,
                          }}
                          title={istPrivat ? "Privat blockiert — entfernen?" : "Slot entfernen?"}
                        >
                          <div className={`text-[10px] font-semibold uppercase tracking-wide ${
                            istPrivat ? "text-ink/80" : "text-warm-dark"
                          }`}>
                            {istPrivat ? "🔒 Privat" : "Slot"}
                          </div>
                          <div className={`text-[10px] truncate ${
                            istPrivat ? "text-ink/70" : "text-warm-dark/80"
                          }`}>
                            {fmtTime(s.von)}–{fmtTime(s.bis)}
                          </div>
                          {!istPrivat && s.dynamischer_preis && (
                            <div className="text-[10px] text-warm-dark/70 truncate">{s.dynamischer_preis} €/h</div>
                          )}
                        </button>
                      )
                    })}

                    {/* Sprint AE Phase 3 — Google-Cal-Events (Read-Only, links eingerückt) */}
                    {layers.google && tagGoogle.map(g => (
                      <a
                        key={g.id}
                        href={g.htmlLink || "https://calendar.google.com"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute left-1 right-1 rounded-md bg-blue-50 border border-blue-200 text-blue-900 px-2 py-1 hover:bg-blue-100 transition-colors block"
                        style={{
                          top: eventOffsetTop(g.von) + 2,
                          height: eventHeight(g.von, g.bis) - 4,
                          opacity: 0.85,
                        }}
                        title={`Google: ${g.summary} (${fmtTime(g.von)}–${fmtTime(g.bis)})`}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Google</div>
                        <div className="text-[10px] truncate text-blue-900">{g.summary}</div>
                        <div className="text-[10px] text-blue-800/70 truncate">{fmtTime(g.von)}–{fmtTime(g.bis)}</div>
                      </a>
                    ))}

                    {/* Termin-Layer */}
                    {layers.termine && tagTermine.map(t => {
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
                            top: eventOffsetTop(t.von) + 2,
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
                  des Stundenfensters (07:00–20:00). 1 Minute auto-update. */}
              {(() => {
                const now = new Date()
                const heuteInWoche = tageDerWoche.some(t => isoDatum(t) === isoDatum(now))
                if (!heuteInWoche) return null
                const nowMin = now.getHours() * 60 + now.getMinutes()
                const minOffset = nowMin - STUNDE_VON * 60
                if (minOffset < 0 || minOffset > (STUNDE_BIS - STUNDE_VON) * 60) return null
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
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h2 className="text-base font-semibold text-ink">
                {slotModal.privat ? "Privat blockieren" : "Verfügbarkeit anbieten"}
              </h2>
              <button onClick={() => setSlotModal(null)} aria-label="Schließen" className="text-ink-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-ink-muted">
                {slotModal.privat
                  ? "Diese Zeit als belegt markieren — taucht nicht im Marktplatz auf. Verwalter können dir hier keinen Auftrag vorschlagen."
                  : "Diese Zeit zur Verfügung stellen — Verwalter sehen das im Marktplatz und können darauf zugreifen."}
              </p>

              {/* F2-Fix Audit (27.05.): Modus-Toggle Verfügbarkeit ↔ Privat-Block.
                  Wiederkehrend wird automatisch deaktiviert wenn Privat aktiv. */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSlotModal(s => s ? { ...s, privat: false } : null)}
                  aria-pressed={!slotModal.privat}
                  className={`text-xs font-medium rounded-lg px-3 py-2 border transition-colors ${
                    !slotModal.privat
                      ? "bg-accent text-white border-accent"
                      : "bg-white text-ink-secondary border-line hover:bg-surface-muted"
                  }`}
                >
                  ⚒️ Verfügbar
                </button>
                <button
                  type="button"
                  onClick={() => setSlotModal(s => s ? { ...s, privat: true, wiederkehrend: false } : null)}
                  aria-pressed={slotModal.privat}
                  className={`text-xs font-medium rounded-lg px-3 py-2 border transition-colors ${
                    slotModal.privat
                      ? "bg-ink text-white border-ink"
                      : "bg-white text-ink-secondary border-line hover:bg-surface-muted"
                  }`}
                >
                  🔒 Privat blockieren
                </button>
              </div>

              {/* B2: Einmalig vs Wiederkehrend — nur bei "Verfügbar"-Modus,
                  Privatzeit ist immer einmalig (für Wochenstruktur Google nutzen). */}
              {!slotModal.privat && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSlotModal(s => s ? { ...s, wiederkehrend: false } : null)}
                  aria-pressed={!slotModal.wiederkehrend}
                  className={`text-xs font-medium rounded-lg px-3 py-2 border transition-colors ${
                    !slotModal.wiederkehrend
                      ? "bg-accent/15 text-accent border-accent/40"
                      : "bg-white text-ink-secondary border-line hover:bg-surface-muted"
                  }`}
                >
                  Einmalig
                </button>
                <button
                  type="button"
                  onClick={() => setSlotModal(s => s ? { ...s, wiederkehrend: true } : null)}
                  aria-pressed={slotModal.wiederkehrend}
                  className={`text-xs font-medium rounded-lg px-3 py-2 border transition-colors ${
                    slotModal.wiederkehrend
                      ? "bg-accent/15 text-accent border-accent/40"
                      : "bg-white text-ink-secondary border-line hover:bg-surface-muted"
                  }`}
                >
                  Jede Woche
                </button>
              </div>
              )}

              {slotModal.wiederkehrend ? (
                <div className="bg-accent/5 border border-accent/20 rounded-lg px-3 py-2">
                  <div className="text-[11px] font-medium text-ink-muted">Wiederholt sich</div>
                  <div className="text-sm text-ink mt-0.5">
                    Jeden {WOCHENTAG_NAME[new Date(slotModal.datum).getDay()]}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">Datum</label>
                  <input
                    type="date"
                    value={slotModal.datum}
                    onChange={e => setSlotModal(s => s ? { ...s, datum: e.target.value } : null)}
                    className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
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
              <p className="text-[11px] text-ink-faint">
                {slotModal.privat
                  ? "Diese Zeit wird in deinem Kalender als belegt angezeigt — niemand sieht den Grund."
                  : slotModal.wiederkehrend
                    ? "Wochenstruktur — gilt ab sofort jeden " + WOCHENTAG_NAME[new Date(slotModal.datum).getDay()] + "."
                    : `Gewerk: ${profileGewerk}. Preis wird vom System dynamisch berechnet.`}
              </p>
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
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {saving
                    ? "Speichert …"
                    : slotModal.privat
                      ? "Privat blockieren"
                      : slotModal.wiederkehrend
                        ? "Wochenstruktur speichern"
                        : "Verfügbarkeit eintragen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LayerChip({ label, icon, active, tone, onClick, title }: {
  label: string
  icon: React.ReactNode
  active: boolean
  tone: "termine" | "slots" | "verf" | "google"
  onClick: () => void
  title?: string
}) {
  const toneActive: Record<string, string> = {
    termine: "bg-accent text-white border-accent",
    slots:   "bg-warm text-white border-warm",
    verf:    "bg-rolle-handwerker text-white border-rolle-handwerker",
    google:  "bg-blue-500 text-white border-blue-500",
  }
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
        active
          ? toneActive[tone]
          : "bg-white text-ink-muted border-line hover:border-ink-muted/30"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function overlap(aVon: string, aBis: string, bVon: string, bBis: string): boolean {
  return timeToMinutes(aVon) < timeToMinutes(bBis) && timeToMinutes(aBis) > timeToMinutes(bVon)
}
