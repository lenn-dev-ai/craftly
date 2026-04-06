"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { UserProfile, Zeitslot, ZeitslotGebot } from "@/types"
import { berechneEinnahmenPrognose, GEWERK_BASIS_PREISE } from "@/lib/yield-management"
import { formatZeit } from "@/lib/format"

export default function EinnahmenDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [slots, setSlots] = useState<Zeitslot[]>([])
  const [gebote, setGebote] = useState<ZeitslotGebot[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState("")

  async function handleGebot(gebotId: string, action: "angenommen" | "abgelehnt") {
    const label = action === "angenommen" ? "annehmen" : "ablehnen"
    if (!window.confirm(`Anfrage wirklich ${label}?`)) return
    const supabase = createClient()
    const { error } = await supabase.from("zeitslot_gebote").update({ status: action }).eq("id", gebotId)
    if (error) {
      setToast("Fehler: " + error.message)
    } else {
      setToast(action === "angenommen" ? "Anfrage angenommen!" : "Anfrage abgelehnt.")
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const [{ data: mySlots }, { data: myGebote }] = await Promise.all([
          supabase.from("zeitslots").select("*, gebote:zeitslot_gebote(*)").eq("handwerker_id", user.id).order("datum"),
          supabase.from("zeitslot_gebote").select("*, zeitslot:zeitslots(*)").eq("zeitslots.handwerker_id", user.id),
        ])
        setSlots(mySlots || [])
        setGebote(myGebote || [])
      }
    }
    setTimeout(() => setToast(""), 3000)
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const [{ data: prof }, { data: mySlots }, { data: myGebote }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("zeitslots").select("*, gebote:zeitslot_gebote(*)").eq("handwerker_id", user.id).order("datum"),
        supabase.from("zeitslot_gebote").select("*, zeitslot:zeitslots(*)").eq("zeitslots.handwerker_id", user.id),
      ])

      setProfile(prof)
      setSlots(mySlots || [])
      setGebote(myGebote || [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#3D8B7A]/30 border-t-[#3D8B7A] rounded-full animate-spin" />
        <span className="text-sm text-[#8C857B]">Einnahmen werden berechnet...</span>
      </div>
    </div>
  )

  const prognose = berechneEinnahmenPrognose(slots, gebote)
  const offeneGebote = gebote.filter(g => g.status === "offen")
  const basisPreis = profile?.basis_preis || GEWERK_BASIS_PREISE[profile?.gewerk || "allgemein"] || 50

  const heute = new Date()
  const in7Tagen = new Date(heute)
  in7Tagen.setDate(heute.getDate() + 7)
  const naechsteSlots = slots
    .filter(s => {
      const d = new Date(s.datum)
      return d >= heute && d <= in7Tagen
    })
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.von.localeCompare(b.von))

  const vergebeneSlots = slots.filter(s => s.status === "vergeben")
  const verfuegbareSlots = slots.filter(s => s.status === "verfuegbar")
  const avgStundensatz = vergebeneSlots.length > 0
    ? Math.round(vergebeneSlots.reduce((s, sl) => s + (sl.dynamischer_preis || sl.basis_preis_stunde), 0) / vergebeneSlots.length)
    : basisPreis

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pt-16 md:pt-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-[#3D8B7A]/30 text-[#2D2A26] text-sm px-4 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D2A26]">Meine Einnahmen</h1>
        <p className="text-sm text-[#8C857B] mt-1">Yield Management \u2014 Deine Zeit, dein Preis</p>
      </div>

      {/* HERO: Einnahmen-\u00DCbersicht */}
      <div className="bg-white rounded-2xl border border-[#EDE8E1] p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-[#8C857B] font-medium mb-1">Diese Woche verdient</div>
            <div className="text-3xl font-bold text-[#3D8B7A]">
              {prognose.dieseWoche > 0 ? prognose.dieseWoche.toLocaleString("de") : "0"} <span className="text-base font-medium">\u20AC</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8C857B] font-medium mb-1">N\u00E4chste Woche geplant</div>
            <div className="text-3xl font-bold text-[#2D2A26]">
              {prognose.naechsteWoche > 0 ? prognose.naechsteWoche.toLocaleString("de") : "0"} <span className="text-base font-medium">\u20AC</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8C857B] font-medium mb-1">Offenes Potenzial</div>
            <div className="text-3xl font-bold text-[#C4956A]">
              +{prognose.potenzialNaechsteWoche.toLocaleString("de")} <span className="text-base font-medium">\u20AC</span>
            </div>
            <div className="text-xs text-[#8C857B] mt-0.5">{prognose.offeneSlots} offene Slots</div>
          </div>
        </div>

        {/* KI-Tipp */}
        <div className="mt-5 bg-[#FAF8F5] rounded-xl p-4 flex items-start gap-3 border border-[#EDE8E1]">
          <span className="text-xs bg-[#C4956A]/15 text-[#C4956A] px-2 py-0.5 rounded-full font-bold flex-shrink-0">AI</span>
          <div className="text-sm text-[#6B665E] flex-1">{prognose.tipp}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-[#EDE8E1] p-4">
          <div className="text-xs text-[#8C857B] mb-1">\u00D8 Stundensatz</div>
          <div className="text-2xl font-bold text-[#2D2A26]">{avgStundensatz} \u20AC</div>
          <div className="text-xs text-[#3D8B7A]">Markt: {basisPreis} \u20AC</div>
        </div>
        <div className="bg-white rounded-xl border border-[#EDE8E1] p-4">
          <div className="text-xs text-[#8C857B] mb-1">Aktive Slots</div>
          <div className="text-2xl font-bold text-[#3D8B7A]">{verfuegbareSlots.length}</div>
          <div className="text-xs text-[#8C857B]">Online sichtbar</div>
        </div>
        <div className="bg-white rounded-xl border border-[#EDE8E1] p-4">
          <div className="text-xs text-[#8C857B] mb-1">Offene Anfragen</div>
          <div className="text-2xl font-bold text-[#C4956A]">{offeneGebote.length}</div>
          <div className="text-xs text-[#8C857B]">Warten auf Antwort</div>
        </div>
        <div className="bg-white rounded-xl border border-[#EDE8E1] p-4">
          <div className="text-xs text-[#8C857B] mb-1">Vergeben</div>
          <div className="text-2xl font-bold text-[#2D2A26]">{vergebeneSlots.length}</div>
          <div className="text-xs text-[#8C857B]">Gebuchte Auftr\u00E4ge</div>
        </div>
      </div>

      {/* CTA: Mehr Slots einstellen */}
      {verfuegbareSlots.length < 5 && (
        <div className="bg-[#3D8B7A]/5 border border-[#3D8B7A]/15 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-[#2D2A26]">
                {verfuegbareSlots.length === 0
                  ? "Starte jetzt \u2014 Stell deine ersten Zeitslots ein!"
                  : `Noch ${5 - verfuegbareSlots.length} Slots bis zur optimalen Sichtbarkeit`
                }
              </div>
              <div className="text-xs text-[#8C857B] mt-1">
                Handwerker mit 5+ Slots erhalten 4x mehr Anfragen
              </div>
            </div>
            <Link
              href="/dashboard-handwerker/zeitslots"
              className="text-xs font-bold bg-[#3D8B7A] text-white px-4 py-2.5 rounded-xl hover:bg-[#2D7A6A] transition-colors flex-shrink-0"
            >
              + Zeitslot erstellen
            </Link>
          </div>
        </div>
      )}

      {/* Offene Gebote */}
      {offeneGebote.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#2D2A26] mb-3">Offene Anfragen ({offeneGebote.length})</h2>
          <div className="flex flex-col gap-2">
            {offeneGebote.map(g => (
              <div key={g.id} className="bg-white border border-[#C4956A]/20 rounded-xl p-4">
                {(g as any).zeitslot && (
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#EDE8E1]">
                    <span className="text-xs bg-[#3D8B7A]/10 text-[#3D8B7A] px-2 py-0.5 rounded-full font-medium">Zeitslot</span>
                    <span className="text-xs text-[#6B665E] font-medium">{(g as any).zeitslot.titel}</span>
                    <span className="text-xs text-[#8C857B]">
                      {new Date((g as any).zeitslot.datum).toLocaleDateString("de", { weekday: "short", day: "numeric", month: "short" })}
                      {" \u00B7 "}{(g as any).zeitslot.von} \u2013 {(g as any).zeitslot.bis}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[#2D2A26]">{g.verwalter?.firma || g.verwalter?.name || "Hausverwaltung"}</div>
                    <div className="text-xs text-[#8C857B] mt-1">
                      {g.wunsch_stunden ? `${g.wunsch_stunden}h gew\u00FCnscht` : ""}
                      {g.nachricht && ` \u2014 "${g.nachricht}"`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-[#3D8B7A]">{g.gebotener_preis} \u20AC</div>
                    <div className="text-xs text-[#8C857B]">Geboten</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleGebot(g.id, "angenommen")}
                    className="flex-1 text-xs font-semibold bg-[#3D8B7A] text-white py-2.5 rounded-lg hover:bg-[#2D7A6A] transition-colors"
                  >
                    Annehmen
                  </button>
                  <button
                    onClick={() => handleGebot(g.id, "abgelehnt")}
                    className="text-xs text-[#6B665E] border border-[#EDE8E1] px-4 py-2.5 rounded-lg hover:bg-[#F5F0EB] transition-colors"
                  >
                    Ablehnen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* N\u00E4chste Slots Timeline */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#2D2A26]">N\u00E4chste 7 Tage</h2>
          <Link
            href="/dashboard-handwerker/zeitslots"
            className="text-xs text-[#3D8B7A] hover:text-[#2D7A6A] transition-colors font-medium"
          >
            Alle verwalten \u2192
          </Link>
        </div>
        {naechsteSlots.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#EDE8E1] p-8 text-center">
            <div className="text-2xl mb-2">&#128197;</div>
            <div className="text-sm text-[#6B665E]">Keine Slots f\u00FCr die n\u00E4chsten 7 Tage</div>
            <Link
              href="/dashboard-handwerker/zeitslots"
              className="mt-3 inline-block text-xs text-[#3D8B7A] border border-[#3D8B7A]/20 px-4 py-2 rounded-lg hover:bg-[#3D8B7A]/5 transition-colors"
            >
              Jetzt Zeitslots erstellen
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {naechsteSlots.map(s => {
              const preis = s.dynamischer_preis || s.basis_preis_stunde
              const gebotsCount = (s.gebote as any[])?.length || 0
              const statusColors: Record<string, string> = {
                verfuegbar: "bg-[#3D8B7A]/8 text-[#3D8B7A] border-[#3D8B7A]/15",
                reserviert: "bg-[#C4956A]/10 text-[#C4956A] border-[#C4956A]/15",
                vergeben: "bg-[#2D2A26]/8 text-[#2D2A26] border-[#2D2A26]/15",
                abgelaufen: "bg-[#EDE8E1] text-[#8C857B] border-[#EDE8E1]",
              }
              const statusLabels: Record<string, string> = {
                verfuegbar: "Online", reserviert: "Reserviert",
                vergeben: "Gebucht", abgelaufen: "Abgelaufen",
              }

              return (
                <div key={s.id} className="bg-white rounded-xl border border-[#EDE8E1] p-4 hover:border-[#3D8B7A]/20 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-center min-w-[50px]">
                        <div className="text-xs text-[#8C857B]">
                          {new Date(s.datum).toLocaleDateString("de", { weekday: "short" })}
                        </div>
                        <div className="text-lg font-bold text-[#2D2A26]">
                          {new Date(s.datum).getDate()}.{new Date(s.datum).getMonth() + 1}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#2D2A26]">{s.titel}</div>
                        <div className="text-xs text-[#8C857B]">{formatZeit(s.von)} \u2013 {formatZeit(s.bis)} ({s.stunden}h)</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {gebotsCount > 0 && (
                        <span className="text-xs bg-[#C4956A]/10 text-[#C4956A] px-2 py-0.5 rounded-full font-medium">
                          {gebotsCount} {gebotsCount === 1 ? "Anfrage" : "Anfragen"}
                        </span>
                      )}
                      <div className="text-right">
                        <div className="text-lg font-bold text-[#3D8B7A]">{preis} \u20AC/h</div>
                        {s.preisfaktor > 1.0 && (
                          <div className="text-xs text-[#C4956A]">
                            \u00D7{s.preisfaktor} Surge
                          </div>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium border ${statusColors[s.status]}`}>
                        {statusLabels[s.status]}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
