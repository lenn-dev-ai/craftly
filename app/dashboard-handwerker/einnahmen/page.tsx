"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile, Zeitslot, ZeitslotGebot } from "@/types"
import { berechneEinnahmenPrognose, GEWERK_BASIS_PREISE } from "@/lib/yield-management"

export default function EinnahmenDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [slots, setSlots] = useState<Zeitslot[]>([])
  const [gebote, setGebote] = useState<ZeitslotGebot[]>([])
  const [loading, setLoading] = useState(true)

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
    <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
        <span className="text-sm text-white/40">Einnahmen werden berechnet...</span>
      </div>
    </div>
  )

  const prognose = berechneEinnahmenPrognose(slots, gebote)
  const offeneGebote = gebote.filter(g => g.status === "offen")
  const basisPreis = profile?.basis_preis || GEWERK_BASIS_PREISE[profile?.gewerk || "allgemein"] || 50

  // Naechste 7 Tage Slots
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
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-4xl mx-auto p-6 md:p-6 pt-16 md:pt-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Meine Einnahmen</h1>
          <p className="text-white/40 text-sm mt-1">Yield Management â Deine Zeit, dein Preis</p>
        </div>

        {/* HERO: Einnahmen-Uebersicht */}
        <div className="bg-gradient-to-br from-[#00D4AA]/10 via-[#12121a] to-[#00B4D8]/10 border border-[#00D4AA]/20 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-white/40 mb-1">Diese Woche verdient</div>
              <div className="text-4xl font-bold text-[#00D4AA]">
                {prognose.dieseWoche > 0 ? prognose.dieseWoche.toLocaleString("de") : "0"} <span className="text-lg">EUR</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-white/40 mb-1">Naechste Woche geplant</div>
              <div className="text-4xl font-bold text-[#00B4D8]">
                {prognose.naechsteWoche > 0 ? prognose.naechsteWoche.toLocaleString("de") : "0"} <span className="text-lg">EUR</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-white/40 mb-1">Offenes Potenzial</div>
              <div className="text-4xl font-bold text-[#F59E0B]">
                +{prognose.potenzialNaechsteWoche.toLocaleString("de")} <span className="text-lg">EUR</span>
              </div>
              <div className="text-[10px] text-white/30">{prognose.offeneSlots} offene Slots</div>
            </div>
          </div>

          {/* KI-Tipp */}
          <div className="mt-4 bg-white/5 rounded-xl p-3 flex items-start gap-3">
            <span className="text-sm bg-[#F59E0B]/20 text-[#F59E0B] px-2 py-0.5 rounded-full font-bold text-xs">AI</span>
            <div className="text-sm text-white/60 flex-1">{prognose.tipp}</div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-white/40 mb-1">Ã Stundensatz</div>
            <div className="text-2xl font-bold text-white">{avgStundensatz} EUR</div>
            <div className="text-[10px] text-[#00D4AA]">Markt: {basisPreis} EUR</div>
          </div>
          <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-white/40 mb-1">Aktive Slots</div>
            <div className="text-2xl font-bold text-[#00B4D8]">{verfuegbareSlots.length}</div>
            <div className="text-[10px] text-white/30">Online sichtbar</div>
          </div>
          <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-white/40 mb-1">Offene Anfragen</div>
            <div className="text-2xl font-bold text-[#F59E0B]">{offeneGebote.length}</div>
            <div className="text-[10px] text-white/30">Warten auf Antwort</div>
          </div>
          <div className="bg-[#12121a] border border-white/5 rounded-xl p-4">
            <div className="text-xs text-white/40 mb-1">Vergeben</div>
            <div className="text-2xl font-bold text-[#8B5CF6]">{vergebeneSlots.length}</div>
            <div className="text-[10px] text-white/30">Gebuchte Auftraege</div>
          </div>
        </div>

        {/* CTA: Mehr Slots einstellen */}
        {verfuegbareSlots.length < 5 && (
          <div className="bg-gradient-to-r from-[#F59E0B]/10 to-[#00D4AA]/10 border border-[#F59E0B]/20 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">
                  {verfuegbareSlots.length === 0
                    ? "Starte jetzt â Stell deine ersten Zeitslots ein!"
                    : `Noch ${5 - verfuegbareSlots.length} Slots bis zur optimalen Sichtbarkeit`
                  }
                </div>
                <div className="text-xs text-white/50 mt-1">
                  Handwerker mit 5+ Slots erhalten 4x mehr Anfragen
                </div>
              </div>
              <button
                onClick={() => router.push("/dashboard-handwerker/zeitslots")}
                className="text-xs text-black font-bold bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] px-4 py-2.5 rounded-xl hover:brightness-110 transition-all flex-shrink-0"
              >
                + Zeitslot erstellen
              </button>
            </div>
          </div>
        )}

        {/* Offene Gebote */}
        {offeneGebote.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Offene Anfragen ({offeneGebote.length})</h2>
            <div className="flex flex-col gap-2">
              {offeneGebote.map(g => (
                <div key={g.id} className="bg-[#12121a] border border-[#F59E0B]/20 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{g.verwalter?.firma || g.verwalter?.name || "Hausverwaltung"}</div>
                      <div className="text-xs text-white/40 mt-1">
                        {g.wunsch_stunden ? `${g.wunsch_stunden}h gewuenscht` : ""}
                        {g.nachricht && ` â "${g.nachricht}"`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-[#00D4AA]">{g.gebotener_preis} EUR</div>
                      <div className="text-[10px] text-white/30">Geboten</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className="flex-1 text-xs font-semibold bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] text-white py-2 rounded-lg hover:brightness-110 transition-all">
                      Annehmen
                    </button>
                    <button className="text-xs text-white/40 border border-white/10 px-4 py-2 rounded-lg hover:bg-white/5 transition-all">
                      Ablehnen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Naechste Slots Timeline */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Naechste 7 Tage</h2>
            <button
              onClick={() => router.push("/dashboard-handwerker/zeitslots")}
              className="text-xs text-[#00D4AA] hover:text-[#00D4AA]/80 transition-colors"
            >
              Alle verwalten â
            </button>
          </div>
          {naechsteSlots.length === 0 ? (
            <div className="bg-[#12121a] border border-white/5 rounded-xl p-8 text-center">
              <div className="text-2xl mb-2">ð</div>
              <div className="text-sm text-white/60">Keine Slots fuer die naechsten 7 Tage</div>
              <button
                onClick={() => router.push("/dashboard-handwerker/zeitslots")}
                className="mt-3 text-xs text-[#00D4AA] border border-[#00D4AA]/20 px-4 py-2 rounded-lg hover:bg-[#00D4AA]/10 transition-colors"
              >
                Jetzt Zeitslots erstellen
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {naechsteSlots.map(s => {
                const preis = s.dynamischer_preis || s.basis_preis_stunde
                const gebotsCount = (s.gebote as any[])?.length || 0
                const statusColors: Record<string, string> = {
                  verfuegbar: "bg-[#00D4AA]/15 text-[#00D4AA]",
                  reserviert: "bg-[#F59E0B]/15 text-[#F59E0B]",
                  vergeben: "bg-[#8B5CF6]/15 text-[#8B5CF6]",
                  abgelaufen: "bg-white/5 text-white/30",
                }
                const statusLabels: Record<string, string> = {
                  verfuegbar: "Online", reserviert: "Reserviert",
                  vergeben: "Gebucht", abgelaufen: "Abgelaufen",
                }

                return (
                  <div key={s.id} className="bg-[#12121a] border border-white/5 rounded-xl p-4 hover:border-[#00D4AA]/20 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-center min-w-[50px]">
                          <div className="text-xs text-white/30">
                            {new Date(s.datum).toLocaleDateString("de", { weekday: "short" })}
                          </div>
                          <div className="text-lg font-bold">
                            {new Date(s.datum).getDate()}.{new Date(s.datum).getMonth() + 1}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium">{s.titel}</div>
                          <div className="text-xs text-white/40">{s.von} - {s.bis} ({s.stunden}h)</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {gebotsCount > 0 && (
                          <span className="text-[10px] bg-[#F59E0B]/15 text-[#F59E0B] px-2 py-0.5 rounded-full font-medium">
                            {gebotsCount} {gebotsCount === 1 ? "Anfrage" : "Anfragen"}
                          </span>
                        )}
                        <div className="text-right">
                          <div className="text-lg font-bold text-[#00D4AA]">{preis} EUR/h</div>
                          {s.preisfaktor > 1.0 && (
                            <div className="text-[10px] text-[#F59E0B]">
                              Ã{s.preisfaktor} Surge
                            </div>
                          )}
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${statusColors[s.status]}`}>
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
    </div>
  )
}
