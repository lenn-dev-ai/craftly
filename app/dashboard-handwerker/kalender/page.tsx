"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { ChevronLeft, ChevronRight, Plus, X, Briefcase, Sun } from "lucide-react"
import { GEWERK_BASIS_PREISE, berechneDynamischenPreis } from "@/lib/yield-management"
import { useToast } from "@/components/Toast"

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
  wochentag: number
  von: string
  bis: string
  aktiv: boolean
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
}

export default function KalenderPage() {
  const router = useRouter()
  const { confirm } = useToast()

  const [montag, setMontag] = useState<Date>(() => getMontag(new Date()))
  // B1: "Slots" als separates User-Konzept ist weg. Der Verfügbarkeit-Toggle
  // steuert jetzt sowohl die Wochenstruktur-Hintergründe als auch die
  // konkreten Buchungsfenster aus public.zeitslots.
  const [layers, setLayers] = useState({ termine: true, verfuegbarkeit: true })
  const [userId, setUserId] = useState<string | null>(null)
  const [profileGewerk, setProfileGewerk] = useState<string>("allgemein")
  const [profileBasisPreis, setProfileBasisPreis] = useState<number>(50)
  const [termine, setTermine] = useState<KalenderTermin[]>([])
  const [slots, setSlots] = useState<KalenderSlot[]>([])
  const [verf, setVerf] = useState<KalenderVerf[]>([])
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
      supabase
        .from("zeitslots")
        .select("id, datum, von, bis, basis_preis_stunde, dynamischer_preis, status")
        .eq("handwerker_id", user.id)
        .gte("datum", wochenStartIso)
        .lte("datum", wochenEndeIso),
      supabase
        .from("verfuegbarkeiten")
        .select("wochentag, von, bis, aktiv")
        .eq("handwerker_id", user.id)
        .eq("aktiv", true),
    ])

    if (prof) {
      setProfileGewerk(prof.gewerk || "allgemein")
      setProfileBasisPreis(prof.basis_preis ?? GEWERK_BASIS_PREISE[prof.gewerk || "allgemein"] ?? 50)
    }
    setTermine((t ?? []).filter((x: KalenderTermin) => x.status !== "abgelaufen" && x.status !== "abgelehnt"))
    setSlots(s ?? [])
    setVerf(v ?? [])
    setLoading(false)
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
    setSlotModal({ datum, von, bis })
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
    const basisPreis = profileBasisPreis || GEWERK_BASIS_PREISE[profileGewerk] || 50
    const preisInfo = berechneDynamischenPreis(
      basisPreis,
      slotModal.datum,
      slotModal.von,
      0,
      slots.filter(s => s.status === "verfuegbar").length,
      false,
    )
    const { error } = await supabase.from("zeitslots").insert({
      handwerker_id: userId,
      titel: `Slot ${slotModal.datum}`,
      gewerk: profileGewerk,
      datum: slotModal.datum,
      von: slotModal.von,
      bis: slotModal.bis,
      basis_preis_stunde: basisPreis,
      dynamischer_preis: preisInfo.dynamischerPreis,
      preisfaktor: preisInfo.gesamtFaktor,
      status: "verfuegbar",
      ist_luecke: false,
    })
    if (error) {
      setToast("Fehler: " + error.message)
    } else {
      setToast("Verfügbarkeit eingetragen.")
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-3 flex items-center gap-2 flex-wrap">
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
          <span className="text-[11px] text-ink-faint ml-auto hidden sm:inline">
            Klick auf eine leere Stunde → Verfügbarkeit anbieten
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-2 sm:px-6 py-4">
        {loading ? (
          <div className="text-center text-sm text-ink-muted py-16">Lädt …</div>
        ) : (
          <div className="bg-white border border-line rounded-2xl overflow-hidden">
            {/* Tagesspalten-Header */}
            <div
              className="grid border-b border-line bg-surface-muted/40"
              style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}
            >
              <div />
              {tageDerWoche.map((d, i) => {
                const isHeute = isoDatum(d) === heuteIso
                return (
                  <div key={i} className={`text-center py-2 text-[11px] font-medium ${isHeute ? "text-accent" : "text-ink-secondary"}`}>
                    <div>{TAGE_LABEL[i]}</div>
                    <div className={`text-xs ${isHeute ? "font-bold" : "font-normal"}`}>{d.getDate()}.</div>
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

                    {/* Klick-Hotzone pro Stunde (für leere Slots) */}
                    {stunden.map((s) => {
                      const stundeStart = String(s).padStart(2, "0") + ":00"
                      const stundeEnde = String(s + 1).padStart(2, "0") + ":00"
                      const istBelegt =
                        tagTermine.some(t => overlap(t.von, t.bis, stundeStart, stundeEnde)) ||
                        tagSlots.some(sl => overlap(sl.von, sl.bis, stundeStart, stundeEnde))
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

                    {/* Slot-Layer */}
                    {layers.verfuegbarkeit && tagSlots.map(s => (
                      <button
                        key={s.id}
                        onClick={() => slotLoeschen(s)}
                        className="absolute left-1 right-1 rounded-md bg-warm-light border border-warm/30 text-left px-2 py-1 hover:bg-warm/15 transition-colors"
                        style={{
                          top: eventOffsetTop(s.von) + 2,
                          height: eventHeight(s.von, s.bis) - 4,
                        }}
                        title="Slot entfernen"
                      >
                        <div className="text-[10px] font-semibold text-warm-dark uppercase tracking-wide">Slot</div>
                        <div className="text-[10px] text-warm-dark/80 truncate">{fmtTime(s.von)}–{fmtTime(s.bis)}</div>
                        {s.dynamischer_preis && (
                          <div className="text-[10px] text-warm-dark/70 truncate">{s.dynamischer_preis} €/h</div>
                        )}
                      </button>
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
              <h2 className="text-base font-semibold text-ink">Verfügbarkeit anbieten</h2>
              <button onClick={() => setSlotModal(null)} aria-label="Schließen" className="text-ink-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-ink-muted">
                Diese Zeit zur Verfügung stellen — Verwalter sehen das im Marktplatz und können darauf zugreifen.
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
              <p className="text-[11px] text-ink-faint">
                Gewerk: {profileGewerk}. Preis wird vom System dynamisch berechnet.
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
                  {saving ? "Speichert …" : "Verfügbarkeit eintragen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LayerChip({ label, icon, active, tone, onClick }: {
  label: string
  icon: React.ReactNode
  active: boolean
  tone: "termine" | "slots" | "verf"
  onClick: () => void
}) {
  const toneActive: Record<string, string> = {
    termine: "bg-accent text-white border-accent",
    slots:   "bg-warm text-white border-warm",
    verf:    "bg-rolle-handwerker text-white border-rolle-handwerker",
  }
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
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
