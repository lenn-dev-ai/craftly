"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile, Zeitslot, Gewerk, GEWERK_LABELS } from "@/types"
import {
  berechneDynamischenPreis,
  GEWERK_BASIS_PREISE,
  erkenneLuecken,
  Luecke,
} from "@/lib/yield-management"

type Tab = "aktiv" | "vergangen" | "erstellen"

export default function ZeitslotsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [slots, setSlots] = useState<Zeitslot[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("aktiv")
  const [luecken, setLuecken] = useState<Luecke[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState("")

  // Form State
  const [form, setForm] = useState({
    titel: "",
    datum: "",
    von: "08:00",
    bis: "16:00",
    gewerk: "" as string,
    notizen: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }

    const [{ data: prof }, { data: mySlots }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("zeitslots")
        .select("*, gebote:zeitslot_gebote(*)")
        .eq("handwerker_id", user.id)
        .order("datum", { ascending: false }),
    ])

    setProfile(prof)
    setSlots(mySlots || [])

    // Luecken erkennen
    if (mySlots && mySlots.length > 0) {
      const termine = mySlots
        .filter((s: Zeitslot) => s.status === "vergeben")
        .map((s: Zeitslot) => ({
          datum: s.datum,
          von: s.von,
          bis: s.bis,
          titel: s.titel,
        }))
      const gefundeneLuecken = erkenneLuecken(mySlots, termine)
      setLuecken(gefundeneLuecken)
    }

    setLoading(false)
  }

  async function createSlot(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)

    const supabase = createClient()
    const basisPreis =
      profile.basis_preis ||
      GEWERK_BASIS_PREISE[profile.gewerk || "allgemein"] ||
      50

    // Stunden berechnen
    const [vonH, vonM] = form.von.split(":").map(Number)
    const [bisH, bisM] = form.bis.split(":").map(Number)
    const stunden = Math.round(((bisH * 60 + bisM - (vonH * 60 + vonM)) / 60) * 10) / 10

    if (stunden <= 0) {
      setToast("Endzeit muss nach Startzeit liegen")
      setSaving(false)
      return
    }

    // Dynamischen Preis berechnen
    const preisInfo = berechneDynamischenPreis(
      basisPreis,
      form.datum,
      form.von,
      0,
      slots.filter((s) => s.status === "verfuegbar").length,
      false
    )

    const { error } = await supabase.from("zeitslots").insert({
      handwerker_id: profile.id,
      titel: form.titel || `${GEWERK_LABELS[form.gewerk || profile.gewerk || "allgemein"]} Slot`,
      gewerk: form.gewerk || profile.gewerk || "allgemein",
      datum: form.datum,
      von: form.von,
      bis: form.bis,
      stunden,
      basis_preis_stunde: basisPreis,
      dynamischer_preis: preisInfo.dynamischerPreis,
      preisfaktor: preisInfo.gesamtFaktor,
      status: "verfuegbar",
      ist_luecke: false,
      notizen: form.notizen || null,
    })

    if (error) {
      setToast("Fehler beim Erstellen: " + error.message)
    } else {
      setToast("Zeitslot erfolgreich erstellt!")
      setForm({ titel: "", datum: "", von: "08:00", bis: "16:00", gewerk: "", notizen: "" })
      setTab("aktiv")
      await loadData()
    }
    setSaving(false)
    setTimeout(() => setToast(""), 3000)
  }

  async function createLueckenSlot(luecke: Luecke) {
    if (!profile) return
    setSaving(true)

    const supabase = createClient()
    const basisPreis =
      profile.basis_preis ||
      GEWERK_BASIS_PREISE[profile.gewerk || "allgemein"] ||
      50

    const preisInfo = berechneDynamischenPreis(
      basisPreis,
      luecke.datum,
      luecke.von,
      0,
      slots.filter((s) => s.status === "verfuegbar").length,
      true // ist_luecke = true â 15% Rabatt
    )

    const { error } = await supabase.from("zeitslots").insert({
      handwerker_id: profile.id,
      titel: `Luecken-Slot (${luecke.vorher} â ${luecke.nachher})`,
      gewerk: profile.gewerk || "allgemein",
      datum: luecke.datum,
      von: luecke.von,
      bis: luecke.bis,
      stunden: luecke.stunden,
      basis_preis_stunde: basisPreis,
      dynamischer_preis: preisInfo.dynamischerPreis,
      preisfaktor: preisInfo.gesamtFaktor,
      status: "verfuegbar",
      ist_luecke: true,
      notizen: `Automatisch erkannte Luecke zwischen "${luecke.vorher}" und "${luecke.nachher}"`,
    })

    if (error) {
      setToast("Fehler: " + error.message)
    } else {
      setToast("Luecken-Slot erstellt! (-15% Rabatt fuer schnelle Buchung)")
      await loadData()
    }
    setSaving(false)
    setTimeout(() => setToast(""), 3000)
  }

  async function deleteSlot(id: string) {
    const supabase = createClient()
    await supabase.from("zeitslots").delete().eq("id", id)
    setToast("Slot geloescht")
    await loadData()
    setTimeout(() => setToast(""), 3000)
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
          <span className="text-sm text-white/40">Zeitslots laden...</span>
        </div>
      </div>
    )

  const heute = new Date().toISOString().split("T")[0]
  const aktiveSlots = slots.filter(
    (s) => s.status === "verfuegbar" || s.status === "reserviert" || (s.status === "vergeben" && s.datum >= heute)
  )
  const vergangeneSlots = slots.filter(
    (s) => s.status === "abgelaufen" || (s.status === "vergeben" && s.datum < heute)
  )

  const statusColors: Record<string, string> = {
    verfuegbar: "bg-[#00D4AA]/15 text-[#00D4AA] border-[#00D4AA]/20",
    reserviert: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/20",
    vergeben: "bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/20",
    abgelaufen: "bg-white/5 text-white/30 border-white/10",
  }
  const statusLabels: Record<string, string> = {
    verfuegbar: "Online",
    reserviert: "Reserviert",
    vergeben: "Gebucht",
    abgelaufen: "Abgelaufen",
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-4xl mx-auto p-6 md:p-6 pt-16 md:pt-6">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-[#12121a] border border-[#00D4AA]/30 text-white text-sm px-4 py-3 rounded-xl shadow-lg shadow-[#00D4AA]/10 animate-pulse">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Meine Zeitslots</h1>
            <p className="text-white/40 text-sm mt-1">
              Verwalte deine Verfuegbarkeit â Dynamisches Pricing inklusive
            </p>
          </div>
          <button
            onClick={() => setTab("erstellen")}
            className="text-xs font-bold bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] text-black px-4 py-2.5 rounded-xl hover:brightness-110 transition-all"
          >
            + Neuer Slot
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#12121a] p-1 rounded-xl mb-6 border border-white/5">
          {(
            [
              { key: "aktiv", label: `Aktiv (${aktiveSlots.length})` },
              { key: "vergangen", label: `Vergangen (${vergangeneSlots.length})` },
              { key: "erstellen", label: "Erstellen" },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 text-xs font-medium py-2.5 rounded-lg transition-all ${
                tab === t.key
                  ? "bg-gradient-to-r from-[#00D4AA]/20 to-[#00B4D8]/15 text-white border border-[#00D4AA]/20"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Luecken-Erkennung Banner */}
        {luecken.length > 0 && tab === "aktiv" && (
          <div className="bg-gradient-to-r from-[#8B5CF6]/10 to-[#00D4AA]/10 border border-[#8B5CF6]/20 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs bg-[#8B5CF6]/20 text-[#8B5CF6] px-2 py-0.5 rounded-full font-bold">
                AI
              </span>
              <span className="text-sm font-semibold">
                {luecken.length} Luecke{luecken.length > 1 ? "n" : ""} erkannt
              </span>
              <span className="text-xs text-white/40">
                â Monetarisiere leere Zeitfenster mit -15% Rabatt
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {luecken.slice(0, 3).map((l, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white/5 rounded-lg p-3"
                >
                  <div>
                    <div className="text-xs font-medium">
                      {new Date(l.datum).toLocaleDateString("de", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                      {" â "}
                      {l.von} bis {l.bis} ({l.stunden}h)
                    </div>
                    <div className="text-[10px] text-white/30 mt-0.5">
                      Zwischen "{l.vorher}" und "{l.nachher}"
                    </div>
                  </div>
                  <button
                    onClick={() => createLueckenSlot(l)}
                    disabled={saving}
                    className="text-[10px] font-bold bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/20 px-3 py-1.5 rounded-lg hover:bg-[#8B5CF6]/30 transition-all"
                  >
                    Als Slot anbieten
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Erstellen */}
        {tab === "erstellen" && (
          <form onSubmit={createSlot} className="bg-[#12121a] border border-white/5 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Neuen Zeitslot erstellen</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Titel (optional)</label>
                <input
                  type="text"
                  value={form.titel}
                  onChange={(e) => setForm({ ...form, titel: e.target.value })}
                  placeholder="z.B. Sanitaer-Einsatz Vormittag"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[#00D4AA]/40 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Gewerk</label>
                <select
                  value={form.gewerk}
                  onChange={(e) => setForm({ ...form, gewerk: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#00D4AA]/40 focus:outline-none transition-colors"
                >
                  <option value="">Standard ({GEWERK_LABELS[profile?.gewerk || "allgemein"]})</option>
                  {Object.entries(GEWERK_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Datum *</label>
                <input
                  type="date"
                  required
                  value={form.datum}
                  onChange={(e) => setForm({ ...form, datum: e.target.value })}
                  min={heute}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#00D4AA]/40 focus:outline-none transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Von *</label>
                  <input
                    type="time"
                    required
                    value={form.von}
                    onChange={(e) => setForm({ ...form, von: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#00D4AA]/40 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Bis *</label>
                  <input
                    type="time"
                    required
                    value={form.bis}
                    onChange={(e) => setForm({ ...form, bis: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#00D4AA]/40 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-white/40 mb-1 block">Notizen (optional)</label>
                <textarea
                  value={form.notizen}
                  onChange={(e) => setForm({ ...form, notizen: e.target.value })}
                  placeholder="z.B. Nur Kleinreparaturen, max. 30km Umkreis..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[#00D4AA]/40 focus:outline-none transition-colors resize-none"
                />
              </div>
            </div>

            {/* Preis-Preview */}
            {form.datum && form.von && (
              <div className="mt-4 bg-white/5 rounded-xl p-4">
                <div className="text-xs text-white/40 mb-2">Preis-Vorschau (dynamisch)</div>
                {(() => {
                  const basisPreis =
                    profile?.basis_preis ||
                    GEWERK_BASIS_PREISE[profile?.gewerk || "allgemein"] ||
                    50
                  const preisInfo = berechneDynamischenPreis(
                    basisPreis,
                    form.datum,
                    form.von,
                    0,
                    slots.filter((s) => s.status === "verfuegbar").length,
                    false
                  )
                  return (
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-2xl font-bold" style={{ color: preisInfo.farbe }}>
                          {preisInfo.dynamischerPreis} EUR/h
                        </div>
                        <div className="text-[10px] text-white/30">
                          Basis: {basisPreis} EUR Ã {preisInfo.gesamtFaktor}
                        </div>
                      </div>
                      <div
                        className="text-xs px-3 py-1 rounded-full font-medium"
                        style={{
                          backgroundColor: preisInfo.farbe + "20",
                          color: preisInfo.farbe,
                        }}
                      >
                        {preisInfo.label}
                      </div>
                      <div className="flex-1 text-right">
                        <div className="text-[10px] text-white/30 space-y-0.5">
                          <div>Tageszeit: Ã{preisInfo.faktoren.tageszeit}</div>
                          <div>Wochentag: Ã{preisInfo.faktoren.wochentag}</div>
                          <div>Knappheit: Ã{preisInfo.faktoren.knappheit}</div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 text-sm font-bold bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] text-black py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50"
              >
                {saving ? "Wird erstellt..." : "Zeitslot veroeffentlichen"}
              </button>
              <button
                type="button"
                onClick={() => setTab("aktiv")}
                className="text-sm text-white/40 border border-white/10 px-6 py-3 rounded-xl hover:bg-white/5 transition-all"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}

        {/* Tab: Aktive Slots */}
        {tab === "aktiv" && (
          <div>
            {aktiveSlots.length === 0 ? (
              <div className="bg-[#12121a] border border-white/5 rounded-2xl p-12 text-center">
                <div className="text-4xl mb-3">ð</div>
                <div className="text-lg font-semibold mb-1">Noch keine Zeitslots</div>
                <div className="text-sm text-white/40 mb-4">
                  Erstelle deinen ersten Slot und werde im Marktplatz sichtbar
                </div>
                <button
                  onClick={() => setTab("erstellen")}
                  className="text-sm font-bold bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] text-black px-6 py-3 rounded-xl hover:brightness-110 transition-all"
                >
                  + Ersten Zeitslot erstellen
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {aktiveSlots.map((s) => {
                  const preis = s.dynamischer_preis || s.basis_preis_stunde
                  const gebotsCount = (s.gebote as any[])?.length || 0
                  return (
                    <div
                      key={s.id}
                      className="bg-[#12121a] border border-white/5 rounded-xl p-4 hover:border-[#00D4AA]/20 transition-all"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[50px]">
                            <div className="text-xs text-white/30">
                              {new Date(s.datum).toLocaleDateString("de", {
                                weekday: "short",
                              })}
                            </div>
                            <div className="text-lg font-bold">
                              {new Date(s.datum).getDate()}.
                              {new Date(s.datum).getMonth() + 1}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium flex items-center gap-2">
                              {s.titel}
                              {s.ist_luecke && (
                                <span className="text-[9px] bg-[#8B5CF6]/15 text-[#8B5CF6] px-1.5 py-0.5 rounded-full">
                                  Luecke
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-white/40">
                              {s.von} - {s.bis} ({s.stunden}h) Â·{" "}
                              {GEWERK_LABELS[s.gewerk || "allgemein"]}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {gebotsCount > 0 && (
                            <span className="text-[10px] bg-[#F59E0B]/15 text-[#F59E0B] px-2 py-0.5 rounded-full font-medium animate-pulse">
                              {gebotsCount}{" "}
                              {gebotsCount === 1 ? "Anfrage" : "Anfragen"}
                            </span>
                          )}
                          <div className="text-right">
                            <div className="text-lg font-bold text-[#00D4AA]">
                              {preis} EUR/h
                            </div>
                            {s.preisfaktor > 1.0 && (
                              <div className="text-[10px] text-[#F59E0B]">
                                Ã{s.preisfaktor} Surge
                              </div>
                            )}
                          </div>
                          <span
                            className={`text-[10px] px-2 py-1 rounded-full font-medium border ${
                              statusColors[s.status]
                            }`}
                          >
                            {statusLabels[s.status]}
                          </span>
                          {s.status === "verfuegbar" && (
                            <button
                              onClick={() => deleteSlot(s.id)}
                              className="text-[10px] text-white/20 hover:text-red-400 transition-colors ml-1"
                              title="Slot loeschen"
                            >
                              â
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Vergangene Slots */}
        {tab === "vergangen" && (
          <div>
            {vergangeneSlots.length === 0 ? (
              <div className="bg-[#12121a] border border-white/5 rounded-2xl p-8 text-center">
                <div className="text-sm text-white/40">
                  Keine vergangenen Slots vorhanden
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {vergangeneSlots.map((s) => {
                  const preis = s.dynamischer_preis || s.basis_preis_stunde
                  return (
                    <div
                      key={s.id}
                      className="bg-[#12121a] border border-white/5 rounded-xl p-4 opacity-60"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[50px]">
                            <div className="text-xs text-white/30">
                              {new Date(s.datum).toLocaleDateString("de", {
                                weekday: "short",
                              })}
                            </div>
                            <div className="text-lg font-bold">
                              {new Date(s.datum).getDate()}.
                              {new Date(s.datum).getMonth() + 1}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium">{s.titel}</div>
                            <div className="text-xs text-white/40">
                              {s.von} - {s.bis} ({s.stunden}h)
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-lg font-bold text-white/40">
                            {preis} EUR/h
                          </div>
                          <span
                            className={`text-[10px] px-2 py-1 rounded-full font-medium border ${
                              statusColors[s.status]
                            }`}
                          >
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
        )}
      </div>
    </div>
  )
}
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile, Zeitslot, Gewerk, GEWERK_LABELS } from "@/types"
import {
  berechneDynamischenPreis,
  GEWERK_BASIS_PREISE,
  erkenneLuecken,
  Luecke,
} from "@/lib/yield-management"

type Tab = "aktiv" | "vergangen" | "erstellen"

export default function ZeitslotsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [slots, setSlots] = useState<Zeitslot[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("aktiv")
  const [luecken, setLuecken] = useState<Luecke[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState("")

  // Form State
  const [form, setForm] = useState({
    titel: "",
    datum: "",
    von: "08:00",
    bis: "16:00",
    gewerk: "" as string,
    notizen: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }

    const [{ data: prof }, { data: mySlots }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("zeitslots")
        .select("*, gebote:zeitslot_gebote(*)")
        .eq("handwerker_id", user.id)
        .order("datum", { ascending: false }),
    ])

    setProfile(prof)
    setSlots(mySlots || [])

    // Luecken erkennen
    if (mySlots && mySlots.length > 0) {
      const termine = mySlots
        .filter((s: Zeitslot) => s.status === "vergeben")
        .map((s: Zeitslot) => ({
          datum: s.datum,
          von: s.von,
          bis: s.bis,
          titel: s.titel,
        }))
      const gefundeneLuecken = erkenneLuecken(mySlots, termine)
      setLuecken(gefundeneLuecken)
    }

    setLoading(false)
  }

  async function createSlot(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)

    const supabase = createClient()
    const basisPreis =
      profile.basis_preis ||
      GEWERK_BASIS_PREISE[profile.gewerk || "allgemein"] ||
      50

    // Stunden berechnen
    const [vonH, vonM] = form.von.split(":").map(Number)
    const [bisH, bisM] = form.bis.split(":").map(Number)
    const stunden = Math.round(((bisH * 60 + bisM - (vonH * 60 + vonM)) / 60) * 10) / 10

    if (stunden <= 0) {
      setToast("Endzeit muss nach Startzeit liegen")
      setSaving(false)
      return
    }

    // Dynamischen Preis berechnen
    const preisInfo = berechneDynamischenPreis(
      basisPreis,
      form.datum,
      form.von,
      0,
      slots.filter((s) => s.status === "verfuegbar").length,
      false
    )

    const { error } = await supabase.from("zeitslots").insert({
      handwerker_id: profile.id,
      titel: form.titel || `${GEWERK_LABELS[form.gewerk || profile.gewerk || "allgemein"]} Slot`,
      gewerk: form.gewerk || profile.gewerk || "allgemein",
      datum: form.datum,
      von: form.von,
      bis: form.bis,
      stunden,
      basis_preis_stunde: basisPreis,
      dynamischer_preis: preisInfo.dynamischerPreis,
      preisfaktor: preisInfo.gesamtFaktor,
      status: "verfuegbar",
      ist_luecke: false,
      notizen: form.notizen || null,
    })

    if (error) {
      setToast("Fehler beim Erstellen: " + error.message)
    } else {
      setToast("Zeitslot erfolgreich erstellt!")
      setForm({ titel: "", datum: "", von: "08:00", bis: "16:00", gewerk: "", notizen: "" })
      setTab("aktiv")
      await loadData()
    }
    setSaving(false)
    setTimeout(() => setToast(""), 3000)
  }

  async function createLueckenSlot(luecke: Luecke) {
    if (!profile) return
    setSaving(true)

    const supabase = createClient()
    const basisPreis =
      profile.basis_preis ||
      GEWERK_BASIS_PREISE[profile.gewerk || "allgemein"] ||
      50

    const preisInfo = berechneDynamischenPreis(
      basisPreis,
      luecke.datum,
      luecke.von,
      0,
      slots.filter((s) => s.status === "verfuegbar").length,
      true // ist_luecke = true â 15% Rabatt
    )

    const { error } = await supabase.from("zeitslots").insert({
      handwerker_id: profile.id,
      titel: `Luecken-Slot (${luecke.vorher} â ${luecke.nachher})`,
      gewerk: profile.gewerk || "allgemein",
      datum: luecke.datum,
      von: luecke.von,
      bis: luecke.bis,
      stunden: luecke.stunden,
      basis_preis_stunde: basisPreis,
      dynamischer_preis: preisInfo.dynamischerPreis,
      preisfaktor: preisInfo.gesamtFaktor,
      status: "verfuegbar",
      ist_luecke: true,
      notizen: `Automatisch erkannte Luecke zwischen "${luecke.vorher}" und "${luecke.nachher}"`,
    })

    if (error) {
      setToast("Fehler: " + error.message)
    } else {
      setToast("Luecken-Slot erstellt! (-15% Rabatt fuer schnelle Buchung)")
      await loadData()
    }
    setSaving(false)
    setTimeout(() => setToast(""), 3000)
  }

  async function deleteSlot(id: string) {
    const supabase = createClient()
    await supabase.from("zeitslots").delete().eq("id", id)
    setToast("Slot geloescht")
    await loadData()
    setTimeout(() => setToast(""), 3000)
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
          <span className="text-sm text-white/40">Zeitslots laden...</span>
        </div>
      </div>
    )

  const heute = new Date().toISOString().split("T")[0]
  const aktiveSlots = slots.filter(
    (s) => s.status === "verfuegbar" || s.status === "reserviert" || (s.status === "vergeben" && s.datum >= heute)
  )
  const vergangeneSlots = slots.filter(
    (s) => s.status === "abgelaufen" || (s.status === "vergeben" && s.datum < heute)
  )
ÛÚ[ÙO^ÊJHOÙ]ÜJÈÜK][NK\Ù][YHJ_BZ[^Ú]]_BÛ\ÜÓ[YOHËY[Ë]Ú]KÍHÜ\Ü\]Ú]KÌLÝ[Y^MKLH^\ÛH^]Ú]HØÝ\ÎÜ\VÈÌ
PWKÍØÝ\ÎÝ][K[ÛH[Ú][ÛXÛÛÜÈÏÙ]]Û\ÜÓ[YOHÜYÜYXÛÛËLØ\LÈ]X[Û\ÜÓ[YOH^^È^]Ú]KÍXLHØÚÈÛ
ÛX[[]\OH[YH\]Z\Y[YO^ÙÜKÛBÛÚ[ÙO^ÊJHOÙ]ÜJÈÜKÛK\Ù][YHJ_BÛ\ÜÓ[YOHËY[Ë]Ú]KÍHÜ\Ü\]Ú]KÌLÝ[Y^MKLH^\ÛH^]Ú]HØÝ\ÎÜ\VÈÌ
PWKÍØÝ\ÎÝ][K[ÛH[Ú][ÛXÛÛÜÈÏÙ]]X[Û\ÜÓ[YOH^^È^]Ú]KÍXLHØÚÈ\È
ÛX[[]\OH[YH\]Z\Y[YO^ÙÜK\ßBÛÚ[ÙO^ÊJHOÙ]ÜJÈÜK\ÎK\Ù][YHJ_BÛ\ÜÓ[YOHËY[Ë]Ú]KÍHÜ\Ü\]Ú]KÌLÝ[Y^MKLH^\ÛH^]Ú]HØÝ\ÎÜ\VÈÌ
PWKÍØÝ\ÎÝ][K[ÛH[Ú][ÛXÛÛÜÈÏÙ]Ù]]Û\ÜÓ[YOHÛNÛÛ\Ü[LX[Û\ÜÓ[YOH^^È^]Ú]KÍXLHØÚÈÝ^[
Ü[Û[
OÛX[^\XB[YO^ÙÜKÝ^[BÛÚ[ÙO^ÊJHOÙ]ÜJÈÜKÝ^[K\Ù][YHJ_BXÙZÛ\H\ÛZ[\\]\[X^ÌÛH[ZÜZ\ËÝÜÏ^ÌBÛ\ÜÓ[YOHËY[Ë]Ú]KÍHÜ\Ü\]Ú]KÌLÝ[Y^MKLH^\ÛH^]Ú]HXÙZÛ\^]Ú]KÌØÝ\ÎÜ\VÈÌ
PWKÍØÝ\ÎÝ][K[ÛH[Ú][ÛXÛÛÜÈ\Ú^K[ÛHÏÙ]Ù]ËÊZ\ËT]Y]È
ßBÙÜK][H	ÜKÛ	
]Û\ÜÓ[YOH]MË]Ú]KÍHÝ[Y^M]Û\ÜÓ[YOH^^È^]Ú]KÍXLZ\ËUÜØÚ]H
[[Z\ØÚ
OÙ]Ê

HOÂÛÛÝ\Ú\ÔZ\ÈBÙ[OË\Ú\×ÜZ\ÈÑUÑT×ÐTÒT×ÔRTÑVÜÙ[OËÙ]Ù\È[Ù[YZ[H
LÛÛÝZ\Ò[ÈH\XÚQ[[Z\ØÚ[Z\Ê\Ú\ÔZ\ËÜK][KÜKÛÛÝË[\
ÊHOËÝ]\ÈOOH\YYØ\K[Ý[ÙB
B]\
]Û\ÜÓ[YOH^][\ËXÙ[\Ø\M]]Û\ÜÓ[YOH^LÛXÛÝ[O^ÞÈÛÛÜZ\Ò[Ë\H_OÜZ\Ò[Ë[[Z\ØÚ\Z\ßHUTÚÙ]]Û\ÜÓ[YOH^VÌLH^]Ú]KÌÌ\Ú\ÎØ\Ú\ÔZ\ßHUT0åÈÜZ\Ò[ËÙ\Ø[]ZÝÜBÙ]Ù]]Û\ÜÓ[YOH^^ÈLÈKLHÝ[YY[Û[YY][HÝ[O^ÞÂXÚÙÜÝ[ÛÛÜZ\Ò[Ë\H
ÈÛÛÜZ\Ò[Ë\K_BÜZ\Ò[ËX[BÙ]]Û\ÜÓ[YOH^LH^\YÚ]Û\ÜÓ[YOH^VÌLH^]Ú]KÌÌÜXÙK^KLH]YÙ\ÞZ]0åÞÜZ\Ò[ËZÝÜ[YÙ\ÞZ]OÙ]]ÛØÚ[YÎ0åÞÜZ\Ò[ËZÝÜ[ÛØÚ[YßOÙ]]Û\Z]0åÞÜZ\Ò[ËZÝÜ[Û\Z]OÙ]Ù]Ù]Ù]
BJJ
_BÙ]
_B]Û\ÜÓ[YOH]M^Ø\LÈ]Û\OHÝXZ]\ØXY^ÜØ][ßBÛ\ÜÓ[YOH^LH^\ÛHÛXÛËYÜYY[]Ë\ÛKVÈÌ
PWHËVÈÌH^XXÚÈKLÈÝ[Y^Ý\YÚ\ÜËLLL[Ú][ÛX[\ØXYÜXÚ]KMLÜØ][ÈÈÚ\\Ý[Z]ÛÝ\ÙY[XÚ[BØ]Û]Û\OH]ÛÛÛXÚÏ^Ê
HOÙ]XZÝ]_BÛ\ÜÓ[YOH^\ÛH^]Ú]KÍÜ\Ü\]Ú]KÌLMKLÈÝ[Y^Ý\Ë]Ú]KÍH[Ú][ÛX[XXÚ[Ø]ÛÙ]ÙÜO
_BËÊXZÝ]HÛÝÈ
ßBÝXOOHZÝ]	
]ØZÝ]TÛÝË[ÝOOHÈ
]Û\ÜÓ[YOHËVÈÌLLXWHÜ\Ü\]Ú]KÍHÝ[YLLL^XÙ[\]Û\ÜÓ[YOH^MXLÈ¼'äáOÙ]]Û\ÜÓ[YOH^[ÈÛ\Ù[ZXÛXLHØÚÙZ[HZ]ÛÝÏÙ]]Û\ÜÓ[YOH^\ÛH^]Ú]KÍXM\Ý[HZ[[\Ý[ÛÝ[Ù\H[HX\Ý]ÚXÚ\Ù]]ÛÛÛXÚÏ^Ê
HOÙ]X\Ý[[_BÛ\ÜÓ[YOH^\ÛHÛXÛËYÜYY[]Ë\ÛKVÈÌ
PWHËVÈÌH^XXÚÈMKLÈÝ[Y^Ý\YÚ\ÜËLLL[Ú][ÛX[
È\Ý[Z]ÛÝ\Ý[[Ø]ÛÙ]
H
]Û\ÜÓ[YOH^^XÛÛØ\LØZÝ]TÛÝËX\

ÊHOÂÛÛÝZ\ÈHË[[Z\ØÚ\ÜZ\ÈË\Ú\×ÜZ\×ÜÝ[BÛÛÝÙXÝÐÛÝ[H
ËÙXÝH\È[V×JOË[Ý]\
]Ù^O^ÜËYBÛ\ÜÓ[YOHËVÈÌLLXWHÜ\Ü\]Ú]KÍHÝ[Y^MÝ\Ü\VÈÌ
PWKÌ[Ú][ÛX[]Û\ÜÓ[YOH^][\ËXÙ[\\ÝYKX]ÙY[^]Ü\Ø\LÈ]Û\ÜÓ[YOH^][\ËXÙ[\Ø\LÈ]Û\ÜÓ[YOH^XÙ[\Z[]ËVÍLH]Û\ÜÓ[YOH^^È^]Ú]KÌÌÛ]È]JË][JKÓØØ[Q]TÝ[ÊHÂÙYZÙ^NÚÜJ_BÙ]]Û\ÜÓ[YOH^[ÈÛXÛÛ]È]JË][JKÙ]]J
_KÛ]È]JË][JKÙ][Û

H
È_BÙ]Ù]]]Û\ÜÓ[YOH^\ÛHÛ[YY][H^][\ËXÙ[\Ø\LÜË][BÜË\ÝÛYXÚÙH	
Ü[Û\ÜÓ[YOH^VÎ\HËVÈÎPÑKÌMH^VÈÎPÑHLKHKLHÝ[YY[YXÚÙBÜÜ[
_BÙ]]Û\ÜÓ[YOH^^È^]Ú]KÍÜËÛHHÜË\ßH
ÜËÝ[[Z
H0­ÞÈBÑÑUÑT×ÓPSÖÜËÙ]Ù\È[Ù[YZ[_BÙ]Ù]Ù]]Û\ÜÓ[YOH^][\ËXÙ[\Ø\LÈÙÙXÝÐÛÝ[	
Ü[Û\ÜÓ[YOH^VÌLHËVÈÑNQLKÌMH^VÈÑNQLHLKLHÝ[YY[Û[YY][H[[X]K\[ÙHÙÙXÝÐÛÝ[^ÈBÙÙXÝÐÛÝ[OOHHÈ[YÙH[YÙ[BÜÜ[
_B]Û\ÜÓ[YOH^\YÚ]Û\ÜÓ[YOH^[ÈÛXÛ^VÈÌ
PWHÜZ\ßHUTÚÙ]ÜËZ\ÙZÝÜK	
]Û\ÜÓ[YOH^VÌLH^VÈÑNQLH0åÞÜËZ\ÙZÝÜHÝ\ÙBÙ]
_BÙ]Ü[Û\ÜÓ[YO^Ø^VÌLHLKLHÝ[YY[Û[YY][HÜ\	ÂÝ]\ÐÛÛÜÖÜËÝ]\×BXBÜÝ]\ÓX[ÖÜËÝ]\×_BÜÜ[ÜËÝ]\ÈOOH\YYØ\	
]ÛÛÛXÚÏ^Ê
HO[]TÛÝ
ËY
_BÛ\ÜÓ[YOH^VÌLH^]Ú]KÌÝ\^\YM[Ú][ÛXÛÛÜÈ[LH]OHÛÝÙ\ØÚ[8§%BØ]Û
_BÙ]Ù]Ù]
BJ_BÙ]
_BÙ]
_BËÊX\Ø[Ù[HÛÝÈ
ßBÝXOOH\Ø[Ù[	
]Ý\Ø[Ù[TÛÝË[ÝOOHÈ
]Û\ÜÓ[YOHËVÈÌLLXWHÜ\Ü\]Ú]KÍHÝ[YLN^XÙ[\]Û\ÜÓ[YOH^\ÛH^]Ú]KÍÙZ[H\Ø[Ù[[ÛÝÈÜ[[Ù]Ù]
H
]Û\ÜÓ[YOH^^XÛÛØ\LÝ\Ø[Ù[TÛÝËX\

ÊHOÂÛÛÝZ\ÈHË[[Z\ØÚ\ÜZ\ÈË\Ú\×ÜZ\×ÜÝ[B]\
]Ù^O^ÜËYBÛ\ÜÓ[YOHËVÈÌLLXWHÜ\Ü\]Ú]KÍHÝ[Y^MÜXÚ]KM]Û\ÜÓ[YOH^][\ËXÙ[\\ÝYKX]ÙY[^]Ü\Ø\LÈ]Û\ÜÓ[YOH^][\ËXÙ[\Ø\LÈ]Û\ÜÓ[YOH^XÙ[\Z[]ËVÍLH]Û\ÜÓ[YOH^^È^]Ú]KÌÌÛ]È]JË][JKÓØØ[Q]TÝ[ÊHÂÙYZÙ^NÚÜJ_BÙ]]Û\ÜÓ[YOH^[ÈÛXÛÛ]È]JË][JKÙ]]J
_KÛ]È]JË][JKÙ][Û

H
È_BÙ]Ù]]]Û\ÜÓ[YOH^\ÛHÛ[YY][HÜË][OÙ]]Û\ÜÓ[YOH^^È^]Ú]KÍÜËÛHHÜË\ßH
ÜËÝ[[Z
BÙ]Ù]Ù]]Û\ÜÓ[YOH^][\ËXÙ[\Ø\LÈ]Û\ÜÓ[YOH^[ÈÛXÛ^]Ú]KÍÜZ\ßHUTÚÙ]Ü[Û\ÜÓ[YO^Ø^VÌLHLKLHÝ[YY[Û[YY][HÜ\	ÂÝ]\ÐÛÛÜÖÜËÝ]\×BXBÜÝ]\ÓX[ÖÜËÝ]\×_BÜÜ[Ù]Ù]Ù]
BJ_BÙ]
_BÙ]
_BÙ]Ù]
BB
