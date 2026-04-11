"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile, Zeitslot, GEWERK_LABELS } from "@/types"
import { GEWERK_BASIS_PREISE } from "@/lib/yield-management"
import { formatZeit } from "@/lib/format"

type Filter = "alle" | "sanitaer" | "elektro" | "heizung" | "maler" | "schreiner" | "dachdecker" | "schlosser"

export default function MarktplatzPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [slots, setSlots] = useState<Zeitslot[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("alle")
  const [sending, setSending] = useState<string | null>(null)
  const [toast, setToast] = useState("")
  const [gebotPreise, setGebotPreise] = useState<Record<string, number>>({})
  const [gebotNachrichten, setGebotNachrichten] = useState<Record<string, string>>({})
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const [{ data: prof }, { data: verfuegbareSlots }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("zeitslots")
        .select("*, handwerker:profiles!handwerker_id(id, name, firma, gewerk, bewertung_avg, auftraege_anzahl, plz_bereich), gebote:zeitslot_gebote(count)")
        .eq("status", "verfuegbar")
        .gte("datum", new Date().toISOString().split("T")[0])
        .order("datum", { ascending: true }),
    ])

    setProfile(prof)
    setSlots(verfuegbareSlots || [])
    setLoading(false)
  }

  async function submitGebot(slotId: string) {
    if (!profile) return
    const slot = slots.find(s => s.id === slotId)
    if (!slot) return
    const preis = gebotPreise[slotId] || slot.dynamischer_preis || slot.basis_preis_stunde
    if (!window.confirm(`Gebot über ${preis} €/h für "${slot.titel}" wirklich absenden?`)) return
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
    <div className="flex items-center justify-center h-screen bg-[#FAF8F5]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#3D8B7A]/30 border-t-[#3D8B7A] rounded-full animate-spin" />
        <span className="text-sm text-[#8C857B]">Marktplatz laden...</span>
      </div>
    </div>
  )

  const filteredSlots = filter === "alle"
    ? slots
    : slots.filter(s => s.gewerk === filter)

  const gewerke = Array.from(new Set(slots.map(s => s.gewerk).filter(Boolean))) as string[]

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2A26]">
      <div className="max-w-5xl mx-auto p-6 md:p-6 pt-16 md:pt-6">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-white border border-[#3D8B7A]/30 text-[#2D2A26] text-sm px-4 py-3 rounded-xl shadow-lg shadow-[#3D8B7A]/10">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Handwerker-Marktplatz</h1>
          <p className="text-[#8C857B] text-sm mt-1">
            Verfügbare Zeitslots — Biete auf Handwerker deiner Wahl
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-[#EDE8E1] rounded-xl p-4">
            <div className="text-xs text-[#8C857B] mb-1">Verfügbare Slots</div>
            <div className="text-2xl font-bold text-[#3D8B7A]">{slots.length}</div>
          </div>
          <div className="bg-white border border-[#EDE8E1] rounded-xl p-4">
            <div className="text-xs text-[#8C857B] mb-1">Gewerke</div>
            <div className="text-2xl font-bold text-[#C4956A]">{gewerke.length}</div>
          </div>
          <div className="bg-white border border-[#EDE8E1] rounded-xl p-4 hidden sm:block">
            <div className="text-xs text-[#8C857B] mb-1">Ø Preis/h</div>
            <div className="text-2xl font-bold text-[#2D2A26]">
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
                ? "bg-[#3D8B7A]/15 text-[#3D8B7A] border border-[#3D8B7A]/20"
                : "text-[#8C857B] border border-[#EDE8E1] hover:text-[#6B665E] hover:border-[#3D8B7A]/20"
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
                    ? "bg-[#3D8B7A]/15 text-[#3D8B7A] border border-[#3D8B7A]/20"
                    : "text-[#8C857B] border border-[#EDE8E1] hover:text-[#6B665E] hover:border-[#3D8B7A]/20"
                }`}
              >
                {GEWERK_LABELS[g] || g} ({count})
              </button>
            )
          })}
        </div>

        {/* Slots Grid */}
        {filteredSlots.length === 0 ? (
          <div className="bg-white border border-[#EDE8E1] rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-lg font-semibold mb-1">Keine Slots gefunden</div>
            <div className="text-sm text-[#8C857B]">
              {filter !== "alle"
                ? `Keine verfügbaren Slots für ${GEWERK_LABELS[filter]}. Probiere einen anderen Filter.`
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
                    isExpanded ? "border-[#3D8B7A]/30 shadow-lg shadow-[#3D8B7A]/5" : "border-[#EDE8E1] hover:border-[#EDE8E1]"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      {/* Left: Handwerker Info */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#3D8B7A]/20 to-[#C4956A]/20 rounded-xl flex items-center justify-center text-sm font-bold text-[#3D8B7A] flex-shrink-0">
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
                              <span className="text-[10px] text-[#2D2A26]/30">
                                ({hw.auftraege_anzahl} Aufträge)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#8C857B] mt-0.5">
                            {GEWERK_LABELS[s.gewerk || "allgemein"]}
                            {hw?.plz_bereich && ` · PLZ ${hw.plz_bereich}`}
                          </div>
                          <div className="text-xs text-[#2D2A26]/50 mt-1">
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
                        </div>
                      </div>

                      {/* Right: Price + Action */}
                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-bold text-[#3D8B7A]">{preis} €<span className="text-sm text-[#8C857B]">/h</span></div>
                        {s.preisfaktor > 1.0 && (
                          <div className="text-[10px] text-[#F59E0B]">×{s.preisfaktor} Surge</div>
                        )}
                        {s.preisfaktor <= 1.0 && preis < basisPreis && (
                          <div className="text-[10px] text-[#8B5CF6]">Unter Marktpreis</div>
                        )}
                        <div className="text-[10px] text-[#8C857B] mt-0.5">
                          Markt: {basisPreis} €/h
                        </div>
                        {gebotsCount > 0 && (
                          <div className="text-[10px] text-[#F59E0B] mt-1">
                            {gebotsCount} {gebotsCount === 1 ? "Gebot" : "Gebote"} vorhanden
                          </div>
                        )}
                        <button
                          onClick={() => setExpandedSlot(isExpanded ? null : s.id)}
                          className={`mt-2 text-xs font-bold px-4 py-2 rounded-lg transition-all ${
                            isExpanded
                              ? "bg-[#F5F0EB] text-[#6B665E]"
                              : "bg-gradient-to-r from-[#3D8B7A] to-[#C4956A] text-black hover:brightness-110"
                          }`}
                        >
                          {isExpanded ? "Schließen" : "Gebot abgeben"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Gebot Form */}
                  {isExpanded && (
                    <div className="border-t border-[#EDE8E1] p-4 bg-white/[0.02]">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs text-[#8C857B] mb-1 block">Dein Gebot (€/h) *</label>
                          <input
                            type="number"
                            min={1}
                            value={gebotPreise[s.id] || preis}
                            onChange={e => setGebotPreise({ ...gebotPreise, [s.id]: Number(e.target.value) })}
                            className="w-full bg-[#F5F0EB] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] focus:border-[#3D8B7A]/40 focus:outline-none transition-colors"
                          />
                          <div className="text-[10px] text-[#2D2A26]/30 mt-1">
                            {(gebotPreise[s.id] || preis) >= preis
                              ? "✓ Gebot liegt beim oder über dem aktuellen Preis"
                              : "⚠ Unter dem aktuellen Preis — Annahme unwahrscheinlich"
                            }
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs text-[#8C857B] mb-1 block">Nachricht (optional)</label>
                          <input
                            type="text"
                            value={gebotNachrichten[s.id] || ""}
                            onChange={e => setGebotNachrichten({ ...gebotNachrichten, [s.id]: e.target.value })}
                            placeholder="z.B. Für Sanitär-Reparatur in Musterstraße 12..."
                            className="w-full bg-[#F5F0EB] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#8C857B] focus:border-[#3D8B7A]/40 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      {/* Gesamt-Vorschau */}
                      <div className="mt-3 bg-[#F5F0EB] rounded-lg p-3 flex items-center justify-between">
                        <div className="text-xs text-[#8C857B]">
                          Geschätzte Gesamtkosten: <span className="font-bold text-[#2D2A26]">
                            {Math.round((gebotPreise[s.id] || preis) * s.stunden)} €
                          </span>
                          <span className="text-[#8C857B]"> ({s.stunden}h × {gebotPreise[s.id] || preis} €)</span>
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
