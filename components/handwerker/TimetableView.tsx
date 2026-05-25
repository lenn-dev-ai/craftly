"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Calendar, CalendarRange, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react"
import { useToast } from "@/components/Toast"
import { useFocusTrap } from "@/lib/use-focus-trap"

// ============================================================
// Konstanten
// ============================================================

const STUNDEN_VON = 6
const STUNDEN_BIS = 20 // exklusiv (Raster 6..19)
const STUNDEN_PRO_TAG = STUNDEN_BIS - STUNDEN_VON
const ARBEITSTAGE = 5 // Mo-Fr für Wochen-Statistik (Sa/So sichtbar, zählen aber nicht in 'verfügbar')
const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const

// ============================================================
// Typen
// ============================================================

type Dringlichkeit = "notfall" | "zeitnah" | "planbar"

interface Eintrag {
  id: string
  typ: "auftrag" | "privat"
  datum: string  // YYYY-MM-DD
  von: string    // HH:mm
  bis: string    // HH:mm
  titel: string
  ticket_id?: string | null
  dringlichkeit?: Dringlichkeit
  preis?: number | null
}

type ViewMode = "tag" | "woche"

// ============================================================
// Helpers
// ============================================================

function parseTimeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + (m || 0)
}

function isoHeute(): string {
  return new Date().toISOString().slice(0, 10)
}

function shiftDatum(iso: string, tage: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + tage)
  return d.toISOString().slice(0, 10)
}

function montagDerWoche(iso: string): string {
  const d = new Date(iso)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return d.toISOString().slice(0, 10)
}

function deutschesDatum(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("de", { weekday: "short", day: "2-digit", month: "2-digit" })
}

function deutschesDatumLang(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("de", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
}

function farbeFuerDringlichkeit(d: Dringlichkeit | undefined, typ: "auftrag" | "privat"): { bg: string; border: string; text: string } {
  if (typ === "privat") return { bg: "#EDE8E1", border: "#B5AEA4", text: "#6B665E" }
  if (d === "notfall") return { bg: "#C4574B", border: "#A03E33", text: "#ffffff" }
  if (d === "zeitnah") return { bg: "#C4956A", border: "#A07248", text: "#ffffff" }
  return { bg: "#5B6ABF", border: "#3F4F9C", text: "#ffffff" } // planbar = default
}

// ============================================================
// Haupt-Component
// ============================================================

// KAL-1 Sprint 4: Editor-State für private_termine.
type EditorState =
  | { mode: "add"; datum: string; von: string; bis: string }
  | { mode: "edit"; id: string; datum: string; von: string; bis: string; titel: string }
  | null

export default function TimetableView() {
  const router = useRouter()
  const { show } = useToast()
  const [eintraege, setEintraege] = useState<Eintrag[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>("tag")
  const [datum, setDatum] = useState<string>(isoHeute())
  const [editor, setEditor] = useState<EditorState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace("/login"); return }

    // Fenster: Anfang der angezeigten Woche - Ende der Woche danach
    // (damit alle möglichen Wochenansichten ein Cache-Hit sind)
    const wochenStart = montagDerWoche(datum)
    const wochenEnde = shiftDatum(wochenStart, 13)

    const [{ data: termine }, { data: privat }] = await Promise.all([
      supabase
        .from("termine")
        .select("id, ticket_id, datum, von, bis, titel, ticket:tickets(dringlichkeit, kosten_final)")
        .eq("handwerker_id", user.id)
        .gte("datum", wochenStart)
        .lte("datum", wochenEnde)
        .returns<Array<{
          id: string
          ticket_id: string | null
          datum: string
          von: string
          bis: string
          titel: string | null
          ticket: { dringlichkeit: Dringlichkeit | null; kosten_final: number | null } | null
        }>>(),
      supabase
        .from("private_termine")
        .select("id, datum, von, bis, bezeichnung")
        .eq("handwerker_id", user.id)
        .gte("datum", wochenStart)
        .lte("datum", wochenEnde)
        .returns<Array<{
          id: string
          datum: string
          von: string
          bis: string
          bezeichnung: string | null
        }>>(),
    ])

    const list: Eintrag[] = []
    for (const t of termine ?? []) {
      list.push({
        id: t.id,
        typ: "auftrag",
        datum: t.datum,
        von: t.von?.slice(0, 5) ?? "",
        bis: t.bis?.slice(0, 5) ?? "",
        titel: t.titel ?? "Auftrag",
        ticket_id: t.ticket_id,
        dringlichkeit: t.ticket?.dringlichkeit ?? "planbar",
        preis: t.ticket?.kosten_final ?? null,
      })
    }
    for (const p of privat ?? []) {
      list.push({
        id: p.id,
        typ: "privat",
        datum: p.datum,
        von: p.von?.slice(0, 5) ?? "",
        bis: p.bis?.slice(0, 5) ?? "",
        titel: p.bezeichnung ?? "Privat",
      })
    }
    setEintraege(list)
    setLoading(false)
  }, [router, datum])

  useEffect(() => { load() }, [load])

  const wochenStart = useMemo(() => montagDerWoche(datum), [datum])
  const wochenTage = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDatum(wochenStart, i)), [wochenStart])

  // Statistik für aktuelle Wochen-Arbeitszeit
  const wochenStats = useMemo(() => {
    const arbeitsTage = wochenTage.slice(0, ARBEITSTAGE) // Mo-Fr
    let belegtMin = 0
    let umsatzCent = 0
    let auftragsCount = 0
    for (const tag of arbeitsTage) {
      for (const e of eintraege.filter(x => x.datum === tag)) {
        const dauer = Math.max(0, parseTimeToMin(e.bis) - parseTimeToMin(e.von))
        if (e.typ === "auftrag") {
          belegtMin += dauer
          umsatzCent += Math.round((e.preis ?? 0) * 100)
          auftragsCount++
        }
      }
    }
    const verfuegbarMin = ARBEITSTAGE * STUNDEN_PRO_TAG * 60
    const effizienz = verfuegbarMin > 0 ? Math.round((belegtMin / verfuegbarMin) * 100) : 0
    return {
      belegtH: Math.round(belegtMin / 60 * 10) / 10,
      verfuegbarH: verfuegbarMin / 60,
      umsatz: umsatzCent / 100,
      auftragsCount,
      effizienz,
    }
  }, [eintraege, wochenTage])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink">Zeitplan</h1>
          <p className="text-sm text-ink-muted mt-1">
            {view === "tag" ? deutschesDatumLang(datum) : `Woche ab ${deutschesDatum(wochenStart)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View-Toggle */}
          <div className="inline-flex items-center gap-0.5 bg-white border border-line rounded-full p-0.5 shadow-sm">
            <button
              onClick={() => setView("tag")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                view === "tag" ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
              }`}
            >
              <Calendar size={12} /> Tag
            </button>
            <button
              onClick={() => setView("woche")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                view === "woche" ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
              }`}
            >
              <CalendarRange size={12} /> Woche
            </button>
          </div>
          {/* Datum-Navigation */}
          <div className="inline-flex items-center gap-0.5 bg-white border border-line rounded-full p-0.5 shadow-sm">
            <button
              onClick={() => setDatum(d => shiftDatum(d, view === "tag" ? -1 : -7))}
              className="w-7 h-7 rounded-full hover:bg-surface flex items-center justify-center text-ink-secondary"
              aria-label="Zurück"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => {
                // Audit-Befund: Heute-Klick fühlte sich unzuverlässig an,
                // wenn man in der Wochenansicht stand und 'heute' bereits
                // in der sichtbaren Woche war — visuell tat sich nichts.
                // Fix: explizit auf Tagesansicht von heute springen.
                setDatum(isoHeute())
                setView("tag")
              }}
              className="text-xs px-3 py-1 rounded-full text-accent hover:bg-accent/5 font-medium"
            >
              Heute
            </button>
            <button
              onClick={() => setDatum(d => shiftDatum(d, view === "tag" ? 1 : 7))}
              className="w-7 h-7 rounded-full hover:bg-surface flex items-center justify-center text-ink-secondary"
              aria-label="Weiter"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Effizienz-Score */}
      <EffizienzKarte stats={wochenStats} />

      {loading ? (
        <div className="bg-white border border-line rounded-2xl p-8 text-center text-sm text-ink-muted">
          Lädt…
        </div>
      ) : view === "tag" ? (
        <Tagesansicht
          datum={datum}
          eintraege={eintraege.filter(e => e.datum === datum)}
          onAuftragKlick={tid => router.push(`/dashboard-handwerker/ticket/${tid}`)}
          onFreierSlotKlick={(vonMin, bisMin) => setEditor({
            mode: "add",
            datum,
            von: minToTime(vonMin),
            bis: minToTime(Math.min(bisMin, vonMin + 60)),
          })}
          onPrivatKlick={e => setEditor({
            mode: "edit",
            id: e.id,
            datum: e.datum,
            von: e.von,
            bis: e.bis,
            titel: e.titel,
          })}
        />
      ) : (
        <Wochenansicht
          tage={wochenTage}
          eintraege={eintraege}
          onTagKlick={tag => { setDatum(tag); setView("tag") }}
          onAuftragKlick={tid => router.push(`/dashboard-handwerker/ticket/${tid}`)}
        />
      )}

      {/* Floating "Neuer Termin"-Button — schneller Weg ohne erst Slot zu finden */}
      {!editor && view === "tag" && (
        <button
          type="button"
          onClick={() => setEditor({ mode: "add", datum, von: "09:00", bis: "10:00" })}
          aria-label="Neuen Termin erstellen"
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30 w-12 h-12 rounded-full bg-accent text-white shadow-lg hover:bg-accent-hover flex items-center justify-center transition-colors"
        >
          <Plus size={22} />
        </button>
      )}

      {editor && (
        <PrivatTerminModal
          state={editor}
          onClose={() => setEditor(null)}
          onSaved={async () => { setEditor(null); await load() }}
          onError={msg => show(msg, "error")}
          onSuccess={msg => show(msg, "success")}
        />
      )}
    </div>
  )
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

// ============================================================
// Editor-Modal für private_termine
// ============================================================
function PrivatTerminModal({ state, onClose, onSaved, onError, onSuccess }: {
  state: NonNullable<EditorState>
  onClose: () => void
  onSaved: () => void | Promise<void>
  onError: (msg: string) => void
  onSuccess: (msg: string) => void
}) {
  const [titel, setTitel] = useState(state.mode === "edit" ? state.titel : "")
  const [von, setVon] = useState(state.von)
  const [bis, setBis] = useState(state.bis)
  const [datum, setDatum] = useState(state.datum)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  // ESC schließt Modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  async function speichern() {
    if (!titel.trim()) {
      onError("Bitte einen Titel eingeben")
      return
    }
    if (parseTimeToMin(bis) <= parseTimeToMin(von)) {
      onError("Endzeit muss nach Startzeit liegen")
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { onError("Nicht eingeloggt"); setBusy(false); return }

    if (state.mode === "add") {
      const { error } = await supabase.from("private_termine").insert({
        handwerker_id: user.id,
        datum, von, bis,
        bezeichnung: titel.trim(),
      })
      if (error) { onError("Speichern fehlgeschlagen: " + error.message); setBusy(false); return }
      onSuccess("Termin angelegt")
    } else {
      const { error } = await supabase.from("private_termine").update({
        datum, von, bis,
        bezeichnung: titel.trim(),
      }).eq("id", state.id)
      if (error) { onError("Update fehlgeschlagen: " + error.message); setBusy(false); return }
      onSuccess("Termin aktualisiert")
    }
    setBusy(false)
    await onSaved()
  }

  async function loeschen() {
    if (state.mode !== "edit") return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from("private_termine").delete().eq("id", state.id)
    if (error) { onError("Löschen fehlgeschlagen: " + error.message); setBusy(false); return }
    onSuccess("Termin gelöscht")
    setBusy(false)
    await onSaved()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privat-termin-modal-title"
    >
      <div ref={dialogRef} className="bg-surface-card rounded-2xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
        <h3 id="privat-termin-modal-title" className="text-lg font-semibold text-ink mb-4">
          {state.mode === "add" ? "Neuer Privat-Termin" : "Termin bearbeiten"}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Bezeichnung</label>
            <input
              type="text"
              value={titel}
              onChange={e => setTitel(e.target.value)}
              placeholder="z.B. Arzttermin, Materialeinkauf"
              className="w-full bg-surface-card border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Datum</label>
            <input
              type="date"
              value={datum}
              onChange={e => setDatum(e.target.value)}
              className="w-full bg-surface-card border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">Von</label>
              <input
                type="time"
                value={von}
                onChange={e => setVon(e.target.value)}
                className="w-full bg-surface-card border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">Bis</label>
              <input
                type="time"
                value={bis}
                onChange={e => setBis(e.target.value)}
                className="w-full bg-surface-card border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-5">
          <div>
            {state.mode === "edit" && (
              <button
                type="button"
                onClick={loeschen}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-danger hover:bg-danger/10 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} /> Löschen
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-sm text-ink-secondary hover:text-ink px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={speichern}
              disabled={busy}
              className="text-sm font-semibold bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {busy ? "Speichert…" : "Speichern"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Effizienz-Score Karte
// ============================================================

function EffizienzKarte({ stats }: {
  stats: { belegtH: number; verfuegbarH: number; umsatz: number; auftragsCount: number; effizienz: number }
}) {
  const farbe = stats.effizienz >= 70 ? "#3D8B7A"
              : stats.effizienz >= 30 ? "#C4956A"
              : "#C4574B"
  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] uppercase tracking-wider text-ink-muted font-medium">Effizienz diese Woche</span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: farbe }}>
            {stats.effizienz} %
          </span>
        </div>
        <div className="text-xs text-ink-muted tabular-nums">
          {stats.belegtH} h von {stats.verfuegbarH} h verplant ·
          {" "}{stats.auftragsCount} {stats.auftragsCount === 1 ? "Auftrag" : "Aufträge"} ·
          {" "}<span className="text-accent font-semibold">{stats.umsatz.toLocaleString("de", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €</span> erwartet
        </div>
      </div>
      <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${stats.effizienz}%`, background: farbe }}
        />
      </div>
    </div>
  )
}

// ============================================================
// Tagesansicht — Stundenraster 6–20
// ============================================================

function Tagesansicht({ datum, eintraege, onAuftragKlick, onFreierSlotKlick, onPrivatKlick }: {
  datum: string
  eintraege: Eintrag[]
  onAuftragKlick: (id: string) => void
  onFreierSlotKlick: (vonMin: number, bisMin: number) => void
  onPrivatKlick: (e: Eintrag) => void
}) {
  // Auflösung: 1 px = 1 min, Stunde = 60 px Höhe
  const PX_PRO_MIN = 1
  const STUNDE_HOEHE = 60 * PX_PRO_MIN
  const GESAMT_HOEHE = STUNDEN_PRO_TAG * STUNDE_HOEHE

  // Belegung pro Minute berechnen (für freie-Slot-Markierung)
  const belegtMinSet = useMemo(() => {
    const s = new Set<number>()
    for (const e of eintraege) {
      const start = Math.max(parseTimeToMin(e.von), STUNDEN_VON * 60)
      const end = Math.min(parseTimeToMin(e.bis), STUNDEN_BIS * 60)
      for (let m = start; m < end; m++) s.add(m)
    }
    return s
  }, [eintraege])

  // Freie Slots: zusammenhängende min-Bereiche ohne Belegung von >=60 min
  const freieSlots = useMemo(() => {
    const slots: Array<{ vonMin: number; bisMin: number }> = []
    let runStart: number | null = null
    for (let m = STUNDEN_VON * 60; m < STUNDEN_BIS * 60; m++) {
      if (!belegtMinSet.has(m)) {
        if (runStart === null) runStart = m
      } else {
        if (runStart !== null) {
          if (m - runStart >= 60) slots.push({ vonMin: runStart, bisMin: m })
          runStart = null
        }
      }
    }
    if (runStart !== null && STUNDEN_BIS * 60 - runStart >= 60) {
      slots.push({ vonMin: runStart, bisMin: STUNDEN_BIS * 60 })
    }
    return slots
  }, [belegtMinSet])

  // UX-Audit: "ist komplett frei"-Empty-Hint früher als absolute-overlay
  // über dem Grid, das verdeckte die Slot-Buttons. Jetzt als Banner über
  // dem Grid + grid bleibt unberührt.
  const istKomplettFrei = eintraege.length === 0 && freieSlots.length === 1

  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
      {istKomplettFrei && (
        <div className="mb-4 bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 text-center">
          <div className="text-sm font-semibold text-accent">{deutschesDatum(datum)} ist komplett frei</div>
          <div className="text-xs text-ink-muted mt-0.5">Tippe in den freien Bereich oder lege Zeitslots an, damit Verwalter dich buchen können.</div>
        </div>
      )}
      <div className="relative" style={{ height: GESAMT_HOEHE, marginLeft: 48 }}>
        {/* Stunden-Linien + Labels */}
        {Array.from({ length: STUNDEN_PRO_TAG + 1 }, (_, i) => {
          const h = STUNDEN_VON + i
          const top = i * STUNDE_HOEHE
          return (
            <div key={i}>
              <div
                className="absolute left-0 right-0 border-t border-line"
                style={{ top }}
              />
              <div
                className="absolute text-[10px] tabular-nums text-ink-muted -translate-y-1/2"
                style={{ top, left: -44 }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            </div>
          )
        })}

        {/* Freie-Slot-Markierungen (hinter den Einträgen).
            KAL-1: jetzt klickbar — öffnet Modal mit prefilled von/bis. */}
        {freieSlots.map((s, i) => {
          const top = (s.vonMin - STUNDEN_VON * 60) * PX_PRO_MIN
          const height = (s.bisMin - s.vonMin) * PX_PRO_MIN
          const stunden = Math.round((s.bisMin - s.vonMin) / 60 * 10) / 10
          return (
            <button
              key={`frei-${i}`}
              type="button"
              onClick={() => onFreierSlotKlick(s.vonMin, s.bisMin)}
              aria-label={`Termin im freien Slot ${minToTime(s.vonMin)}–${minToTime(s.bisMin)} hinzufügen`}
              className="absolute left-0 right-0 bg-accent/5 border-l-2 border-accent/30 rounded-r-md flex items-center px-2 hover:bg-accent/10 transition-colors group"
              style={{ top, height }}
            >
              <span className="text-[10px] text-accent font-semibold flex items-center gap-1">
                <Plus size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                Frei · {stunden} h
              </span>
            </button>
          )
        })}

        {/* Einträge — Auftrag = Ticket öffnen, Privat = Editor öffnen */}
        {eintraege.map(e => {
          const start = Math.max(parseTimeToMin(e.von), STUNDEN_VON * 60)
          const end = Math.min(parseTimeToMin(e.bis), STUNDEN_BIS * 60)
          if (end <= start) return null
          const top = (start - STUNDEN_VON * 60) * PX_PRO_MIN
          const height = (end - start) * PX_PRO_MIN
          const c = farbeFuerDringlichkeit(e.dringlichkeit, e.typ)
          const istAuftrag = e.typ === "auftrag"
          const clickable = (istAuftrag && e.ticket_id) || e.typ === "privat"
          return (
            <button
              key={e.id}
              onClick={() => {
                if (istAuftrag && e.ticket_id) onAuftragKlick(e.ticket_id)
                else if (e.typ === "privat") onPrivatKlick(e)
              }}
              disabled={!clickable}
              className="absolute rounded-lg p-2 text-left transition-shadow shadow-sm hover:shadow-md disabled:cursor-default"
              style={{
                top, height,
                left: 8, right: 8,
                background: c.bg, borderLeft: `3px solid ${c.border}`, color: c.text,
              }}
            >
              <div className="text-[11px] font-semibold tabular-nums opacity-90">{e.von}–{e.bis}</div>
              <div className="text-xs font-semibold leading-tight mt-0.5 line-clamp-2">{e.titel}</div>
            </button>
          )
        })}

      </div>
    </div>
  )
}

// ============================================================
// Wochenansicht
// ============================================================

function Wochenansicht({ tage, eintraege, onTagKlick, onAuftragKlick }: {
  tage: string[]
  eintraege: Eintrag[]
  onTagKlick: (tag: string) => void
  onAuftragKlick: (id: string) => void
}) {
  return (
    <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
      <div className="grid grid-cols-7 gap-2">
        {tage.map((tag, i) => {
          const tageinträge = eintraege.filter(e => e.datum === tag)
          const auftraege = tageinträge.filter(e => e.typ === "auftrag")
          const belegtMin = auftraege.reduce((s, e) => s + (parseTimeToMin(e.bis) - parseTimeToMin(e.von)), 0)
          const umsatz = auftraege.reduce((s, e) => s + (e.preis ?? 0), 0)
          const istHeute = tag === isoHeute()
          const istWochenende = i >= 5

          return (
            <button
              key={tag}
              onClick={() => onTagKlick(tag)}
              className={`text-left rounded-xl border p-3 transition-all hover:shadow-sm ${
                istHeute ? "border-[#3D8B7A] bg-accent/5" : "border-line bg-white hover:bg-surface"
              } ${istWochenende ? "opacity-75" : ""}`}
            >
              <div className="flex items-baseline justify-between mb-2">
                <span className={`text-[10px] uppercase tracking-wider font-bold ${
                  istHeute ? "text-accent" : "text-ink-muted"
                }`}>
                  {WOCHENTAGE[i]}
                </span>
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {new Date(tag).getDate()}
                </span>
              </div>

              {auftraege.length === 0 ? (
                <div className="text-[10px] text-ink-muted italic py-3">frei</div>
              ) : (
                <div className="space-y-1">
                  {auftraege.slice(0, 3).map(e => {
                    const c = farbeFuerDringlichkeit(e.dringlichkeit, e.typ)
                    return (
                      <div
                        key={e.id}
                        onClick={ev => { ev.stopPropagation(); if (e.ticket_id) onAuftragKlick(e.ticket_id) }}
                        className="rounded px-1.5 py-1 text-[10px] truncate hover:opacity-80 transition-opacity"
                        style={{ background: c.bg, color: c.text }}
                      >
                        <span className="tabular-nums opacity-90">{e.von}</span> · {e.titel}
                      </div>
                    )
                  })}
                  {auftraege.length > 3 && (
                    <div className="text-[10px] text-ink-muted font-medium pl-1">
                      +{auftraege.length - 3} weitere
                    </div>
                  )}
                </div>
              )}

              {auftraege.length > 0 && (
                <div className="mt-2 pt-2 border-t border-line text-[10px] text-ink-muted tabular-nums space-y-0.5">
                  <div>{Math.round(belegtMin / 60 * 10) / 10} h</div>
                  {umsatz > 0 && <div className="text-accent font-semibold">{Math.round(umsatz)} €</div>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
