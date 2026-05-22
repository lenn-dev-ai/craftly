"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile, Zeitslot, formatGewerk } from "@/types"
import { GEWERK_BASIS_PREISE } from "@/lib/yield-management"
import { formatZeit } from "@/lib/format"
import { useToast } from "@/components/Toast"

type Filter = "alle" | "sanitaer" | "elektro" | "heizung" | "maler" | "schreiner" | "dachdecker" | "schlosser"

// B3: Marktplatz-Slot kann entweder ein konkreter zeitslots-Eintrag sein
// (mit echter id, bewerbbar) oder aus einer HW-Wochenstruktur generiert
// (virtual, nicht direkt bewerbbar — der HW muss den Slot erst konkret
// freigeben, dann kann gebucht werden). Beide tauchen in der Liste auf,
// werden visuell unterschieden.
type MarktSlot = Zeitslot & {
  ist_wochenstruktur?: boolean
  wochenstruktur_id?: string
}

const VORSCHAU_TAGE = 14

function timeToH(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h + (m ?? 0) / 60
}

export default function MarktplatzPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // F10: HW-Filter via Query-Param. "Slots ansehen" auf der HW-Liste setzt
  // ?hw=<id>, der Marktplatz zeigt dann nur Slots dieses Handwerkers.
  const hwParam = searchParams.get("hw")
  const { confirm } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [slots, setSlots] = useState<MarktSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("alle")
  const [sending, setSending] = useState<string | null>(null)
  const [toast, setToast] = useState("")
  const [gebotPreise, setGebotPreise] = useState<Record<string, number>>({})
  const [gebotNachrichten, setGebotNachrichten] = useState<Record<string, string>>({})
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null)

  const hwFilterName = useMemo(() => {
    if (!hwParam) return null
    const slot = slots.find(s => s.handwerker_id === hwParam)
    const hw = slot?.handwerker as { name?: string; firma?: string } | undefined
    return hw?.firma || hw?.name || null
  }, [hwParam, slots])

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const heuteIso = new Date().toISOString().split("T")[0]
    // B4: konsolidierte Tabelle — zwei art-gefilterte Queries gegen
    // public.zeitslots. verfuegbarkeiten wird nicht mehr gelesen.
    const [{ data: prof }, { data: verfuegbareSlots }, { data: wochenstruktur }] = await Promise.all([
      supabase.from("profiles").select("id, email, name, rolle, created_at").eq("id", user.id).single(),
      supabase
        .from("zeitslots")
        .select("*, handwerker:profiles!handwerker_id(id, name, firma, gewerk, bewertung_avg, auftraege_anzahl, plz_bereich), gebote:zeitslot_gebote(count)")
        .eq("art", "einmalig")
        .eq("status", "verfuegbar")
        .gte("datum", heuteIso)
        .order("datum", { ascending: true }),
      // Wochenstruktur — wochentag-Felder, kein konkretes Datum.
      supabase
        .from("zeitslots")
        .select("id, handwerker_id, wochentag, von, bis, handwerker:profiles!handwerker_id(id, name, firma, gewerk, bewertung_avg, auftraege_anzahl, plz_bereich, basis_preis)")
        .eq("art", "wiederkehrend")
        .eq("status", "verfuegbar"),
    ])

    // Virtuelle Slots aus Wochenstruktur für die nächsten 14 Tage erzeugen.
    // Skip, wenn für denselben HW+Datum+Zeit bereits ein konkreter Slot
    // existiert — der hat Vorrang, weil der HW den explizit freigegeben hat.
    const konkretKeys = new Set(
      (verfuegbareSlots ?? []).map(s => `${s.handwerker_id}|${s.datum}|${s.von}|${s.bis}`),
    )
    const heute = new Date()
    heute.setHours(0, 0, 0, 0)
    const virtuelle: MarktSlot[] = []
    type WStruktur = {
      id: string; handwerker_id: string; wochentag: number; von: string; bis: string
      handwerker: { id: string; name: string | null; firma: string | null; gewerk: string | null; bewertung_avg: number | null; auftraege_anzahl: number | null; plz_bereich: string | null; basis_preis: number | null } | null
    }
    for (const w of (wochenstruktur ?? []) as unknown as WStruktur[]) {
      if (w.wochentag == null) continue
      for (let i = 0; i < VORSCHAU_TAGE; i++) {
        const d = new Date(heute)
        d.setDate(heute.getDate() + i)
        if (d.getDay() !== w.wochentag) continue
        const datum = d.toISOString().slice(0, 10)
        const key = `${w.handwerker_id}|${datum}|${w.von}|${w.bis}`
        if (konkretKeys.has(key)) continue

        const hwGewerk = w.handwerker?.gewerk ?? "allgemein"
        const basisPreis = w.handwerker?.basis_preis ?? GEWERK_BASIS_PREISE[hwGewerk] ?? 50
        const stunden = (timeToH(w.bis) - timeToH(w.von))
        virtuelle.push({
          id: `wstr-${w.id}-${datum}`,
          handwerker_id: w.handwerker_id,
          titel: `Wochenstruktur ${w.handwerker?.firma ?? w.handwerker?.name ?? ""}`.trim(),
          gewerk: hwGewerk,
          datum,
          von: w.von,
          bis: w.bis,
          stunden,
          basis_preis_stunde: basisPreis,
          dynamischer_preis: basisPreis,
          preisfaktor: 1,
          status: "verfuegbar",
          ist_luecke: false,
          notizen: null,
          created_at: new Date().toISOString(),
          handwerker: w.handwerker,
          ist_wochenstruktur: true,
          wochenstruktur_id: w.id,
        } as unknown as MarktSlot)
      }
    }

    const merged: MarktSlot[] = [
      ...((verfuegbareSlots ?? []) as MarktSlot[]),
      ...virtuelle,
    ].sort((a, b) => (a.datum + a.von).localeCompare(b.datum + b.von))

    setProfile(prof)
    setSlots(merged)
    setLoading(false)
  }, [router])

  useEffect(() => { loadData() }, [loadData])

  async function submitGebot(slotId: string) {
    if (!profile) return
    const slot = slots.find(s => s.id === slotId)
    if (!slot) return
    // B3: virtuelle Wochenstruktur-Slots können nicht direkt beboten werden —
    // der HW muss sie erst konkret freigeben. Bis B4 (Materialize-API) ist
    // das ein expliziter Hinweis statt einer stillen Failure.
    if (slot.ist_wochenstruktur) {
      setToast("Dieser Slot stammt aus der Wochenstruktur — der Handwerker gibt ihn frei, sobald er ihn konkret anbietet.")
      setTimeout(() => setToast(""), 4000)
      return
    }
    const preis = gebotPreise[slotId] || slot.dynamischer_preis || slot.basis_preis_stunde
    if (!await confirm(`Gebot über ${preis} €/h für „${slot.titel}" wirklich absenden?`)) return
    setSending(slotId)

    const nachricht = gebotNachrichten[slotId] || ""

    const supabase = createClient()
    const { error } = await supabase.from("zeitslot_gebote").insert({
      zeitslot_id: slotId,
      verwalter_id: profile.id,
      gebotener_preis: preis,
      wunsch_stunden: slot.stunden,
      nachricht: nachricht || null,
      status: "offen",
    })

    if (error) {
      if (error.message.includes("duplicate")) {
        setToast("Du hast bereits ein Gebot für diesen Slot abgegeben")
      } else {
        setToast("Fehler: " + error.message)
      }
    } else {
      setToast("Gebot erfolgreich gesendet! Der Handwerker wird benachrichtigt.")
      setExpandedSlot(null)
      await loadData()
    }
    setSending(null)
    setTimeout(() => setToast(""), 4000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-[#3D8B7A] rounded-full animate-spin" />
        <span className="text-sm text-ink-muted">Marktplatz laden...</span>
      </div>
    </div>
  )

  const slotsNachHW = hwParam ? slots.filter(s => s.handwerker_id === hwParam) : slots
  const filteredSlots = filter === "alle"
    ? slotsNachHW
    : slotsNachHW.filter(s => s.gewerk === filter)

  const gewerke = Array.from(new Set(slotsNachHW.map(s => s.gewerk).filter(Boolean))) as string[]

  function hwFilterEntfernen() {
    const url = new URL(window.location.href)
    url.searchParams.delete("hw")
    router.replace(url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : ""))
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      <div className="max-w-5xl mx-auto p-6 md:p-6 pt-16 md:pt-6">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white border border-accent/30 text-ink text-sm px-4 py-3 rounded-xl shadow-lg shadow-[#3D8B7A]/10">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Handwerker-Marktplatz</h1>
          <p className="text-ink-muted text-sm mt-1">
            Verfügbare Zeitslots — Biete auf Handwerker deiner Wahl
          </p>
        </div>

        {/* F10: HW-Filter-Banner, falls über ?hw=<id> aus der HW-Liste gekommen */}
        {hwParam && (
          <div className="mb-5 flex items-center justify-between gap-3 bg-accent/5 border border-accent/20 rounded-xl px-4 py-3">
            <div className="text-xs text-ink-secondary">
              Slots gefiltert auf{" "}
              <span className="font-semibold text-ink">
                {hwFilterName ?? "diesen Handwerker"}
              </span>
              {!hwFilterName && slots.length > 0 && (
                <span className="text-ink-muted"> — keine verfügbaren Slots.</span>
              )}
            </div>
            <button
              onClick={hwFilterEntfernen}
              className="text-xs font-medium text-accent hover:text-[#2D6B5A]"
            >
              Filter entfernen
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-line rounded-xl p-4">
            <div className="text-xs text-ink-muted mb-1">Verfügbare Slots</div>
            <div className="text-2xl font-bold text-accent">{slots.length}</div>
          </div>
          <div className="bg-white border border-line rounded-xl p-4">
            <div className="text-xs text-ink-muted mb-1">Gewerke</div>
            <div className="text-2xl font-bold text-warm">{gewerke.length}</div>
          </div>
          <div className="bg-white border border-line rounded-xl p-4 hidden sm:block">
            <div className="text-xs text-ink-muted mb-1">Ø Preis/h</div>
            <div className="text-2xl font-bold text-ink">
              {slots.length > 0
                ? Math.round(slots.reduce((s, sl) => s + (sl.dynamischer_preis || sl.basis_preis_stunde), 0) / slots.length)
                : 0
              } €
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter("alle")}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
              filter === "alle"
                ? "bg-accent/15 text-accent border border-accent/20"
                : "text-ink-muted border border-line hover:text-ink-secondary hover:border-accent/20"
            }`}
          >
            Alle ({slots.length})
          </button>
          {gewerke.map(g => {
            const count = slots.filter(s => s.gewerk === g).length
            return (
              <button
                key={g}
                onClick={() => setFilter(g as Filter)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filter === g
                    ? "bg-accent/15 text-accent border border-accent/20"
                    : "text-ink-muted border border-line hover:text-ink-secondary hover:border-accent/20"
                }`}
              >
                {formatGewerk(g)} ({count})
              </button>
            )
          })}
        </div>

        {/* Slots Grid */}
        {filteredSlots.length === 0 ? (
          <div className="bg-white border border-line rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-lg font-semibold mb-1">Keine Slots gefunden</div>
            <div className="text-sm text-ink-muted">
              {filter !== "alle"
                ? `Keine verfügbaren Slots für ${formatGewerk(filter)}. Probiere einen anderen Filter.`
                : "Aktuell sind keine Handwerker-Slots verfügbar. Schau später nochmal vorbei!"
              }
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredSlots.map(s => {
              const hw = s.handwerker as any
              const preis = s.dynamischer_preis || s.basis_preis_stunde
              const basisPreis = GEWERK_BASIS_PREISE[s.gewerk || "allgemein"] || 50
              const isExpanded = expandedSlot === s.id
              const gebotsCount = (s.gebote as any)?.[0]?.count || 0

              return (
                <div
                  key={s.id}
                  className={`bg-white border rounded-xl transition-all ${
                    isExpanded ? "border-accent/30 shadow-lg shadow-[#3D8B7A]/5" : "border-line hover:border-line"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      {/* Left: Handwerker Info */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#3D8B7A]/20 to-[#C4956A]/20 rounded-xl flex items-center justify-center text-sm font-bold text-accent flex-shrink-0">
                          {hw?.name?.charAt(0) || "H"}
                        </div>
                        <div>
                          <div className="text-sm font-semibold flex items-center gap-2">
                            {hw?.firma || hw?.name || "Handwerker"}
                            {hw?.bewertung_avg > 0 && (
                              <span className="text-[10px] text-[#F59E0B]">
                                ★ {hw.bewertung_avg.toFixed(1)}
                              </span>
                            )}
                            {hw?.auftraege_anzahl > 0 && (
                              <span className="text-[10px] text-ink/30">
                                ({hw.auftraege_anzahl} Aufträge)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-ink-muted mt-0.5">
                            {formatGewerk(s.gewerk)}
                            {hw?.plz_bereich && ` · PLZ ${hw.plz_bereich}`}
                          </div>
                          <div className="text-xs text-ink/50 mt-1">
                            <span className="font-medium">
                              {new Date(s.datum).toLocaleDateString("de", { weekday: "short", day: "numeric", month: "short" })}
                            </span>
                            {" · "}
                            {formatZeit(s.von)} – {formatZeit(s.bis)} ({s.stunden}h)
                          </div>
                          {s.ist_luecke && (
                            <span className="inline-block mt-1 text-[9px] bg-[#8B5CF6]/15 text-[#8B5CF6] px-1.5 py-0.5 rounded-full">
                              Lücken-Angebot (–15%)
                            </span>
                          )}
                          {s.ist_wochenstruktur && (
                            <span className="inline-block mt-1 ml-1 text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">
                              Wochenstruktur
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Price + Action */}
                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-bold text-accent">{preis} €<span className="text-sm text-ink-muted">/h</span></div>
                        {s.preisfaktor > 1.0 && (
                          <div className="text-[10px] text-[#F59E0B]">×{s.preisfaktor} Surge</div>
                        )}
                        {s.preisfaktor <= 1.0 && preis < basisPreis && (
                          <div className="text-[10px] text-[#8B5CF6]">Unter Marktpreis</div>
                        )}
                        <div className="text-[10px] text-ink-muted mt-0.5">
                          Markt: {basisPreis} €/h
                        </div>
                        {gebotsCount > 0 && (
                          <div className="text-[10px] text-[#F59E0B] mt-1">
                            {gebotsCount} {gebotsCount === 1 ? "Gebot" : "Gebote"} vorhanden
                          </div>
                        )}
                        <button
                          onClick={() => {
                            if (s.ist_wochenstruktur) {
                              submitGebot(s.id) // löst den Wochenstruktur-Hinweis-Toast aus
                              return
                            }
                            setExpandedSlot(isExpanded ? null : s.id)
                          }}
                          className={`mt-2 text-xs font-bold px-4 py-2 rounded-lg transition-all ${
                            s.ist_wochenstruktur
                              ? "bg-surface-muted text-ink-secondary cursor-help"
                              : isExpanded
                                ? "bg-surface-muted text-ink-secondary"
                                : "bg-gradient-to-r from-[#3D8B7A] to-[#C4956A] text-black hover:brightness-110"
                          }`}
                          title={s.ist_wochenstruktur ? "Aus Wochenstruktur generiert — HW gibt konkret frei" : undefined}
                        >
                          {s.ist_wochenstruktur
                            ? "Auf Anfrage"
                            : isExpanded
                              ? "Schließen"
                              : "Slot buchen"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Gebot Form */}
                  {isExpanded && (
                    <div className="border-t border-line p-4 bg-white/[0.02]">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs text-ink-muted mb-1 block">Dein Gebot (€/h) *</label>
                          <input
                            type="number"
                            min={1}
                            value={gebotPreise[s.id] || preis}
                            onChange={e => setGebotPreise({ ...gebotPreise, [s.id]: Number(e.target.value) })}
                            className="w-full bg-surface-muted border border-line rounded-xl px-4 py-2.5 text-sm text-ink focus:border-accent/40 focus:outline-none transition-colors"
                          />
                          <div className="text-[10px] text-ink/30 mt-1">
                            {(gebotPreise[s.id] || preis) >= preis
                              ? "✓ Gebot liegt beim oder über dem aktuellen Preis"
                              : "⚠ Unter dem aktuellen Preis — Annahme unwahrscheinlich"
                            }
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs text-ink-muted mb-1 block">Nachricht (optional)</label>
                          <input
                            type="text"
                            value={gebotNachrichten[s.id] || ""}
                            onChange={e => setGebotNachrichten({ ...gebotNachrichten, [s.id]: e.target.value })}
                            placeholder="z.B. Für Sanitär-Reparatur in Musterstraße 12..."
                            className="w-full bg-surface-muted border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent/40 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      {/* Gesamt-Vorschau */}
                      <div className="mt-3 bg-surface-muted rounded-lg p-3 flex items-center justify-between">
                        <div className="text-xs text-ink-muted">
                          Geschätzte Gesamtkosten: <span className="font-bold text-ink">
                            {Math.round((gebotPreise[s.id] || preis) * s.stunden)} €
                          </span>
                          <span className="text-ink-muted"> ({s.stunden}h × {gebotPreise[s.id] || preis} €)</span>
                        </div>
                        <button
                          onClick={() => submitGebot(s.id)}
                          disabled={sending === s.id}
                          className="text-xs font-bold bg-gradient-to-r from-[#3D8B7A] to-[#C4956A] text-black px-6 py-2.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
                        >
                          {sending === s.id ? "Wird gesendet..." : "Gebot senden"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
