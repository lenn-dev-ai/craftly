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
import { formatZeit } from "@/lib/format"

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const [{ data: prof }, { data: mySlots }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("zeitslots").select("*, gebote:zeitslot_gebote(*)").eq("handwerker_id", user.id).order("datum", { ascending: false }),
    ])

    setProfile(prof)
    setSlots(mySlots || [])

    if (mySlots && mySlots.length > 0) {
      const termine = mySlots
        .filter((s: Zeitslot) => s.status === "vergeben")
        .map((s: Zeitslot) => ({ datum: s.datum, von: s.von, bis: s.bis, titel: s.titel }))
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
    const basisPreis = profile.basis_preis || GEWERK_BASIS_PREISE[profile.gewerk || "allgemein"] || 50

    const [vonH, vonM] = form.von.split(":").map(Number)
    const [bisH, bisM] = form.bis.split(":").map(Number)
    const stunden = Math.round(((bisH * 60 + bisM - (vonH * 60 + vonM)) / 60) * 10) / 10

    if (stunden <= 0) {
      setToast("Endzeit muss nach Startzeit liegen")
      setSaving(false)
      return
    }

    const preisInfo = berechneDynamischenPreis(basisPreis, form.datum, form.von, 0, slots.filter((s) => s.status === "verfuegbar").length, false)

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
    const basisPreis = profile.basis_preis || GEWERK_BASIS_PREISE[profile.gewerk || "allgemein"] || 50

    const preisInfo = berechneDynamischenPreis(basisPreis, luecke.datum, luecke.von, 0, slots.filter((s) => s.status === "verfuegbar").length, true)

    const { error } = await supabase.from("zeitslots").insert({
      handwerker_id: profile.id,
      titel: `Lücken-Slot (${luecke.vorher} → ${luecke.nachher})`,
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
      notizen: `Automatisch erkannte Lücke zwischen "${luecke.vorher}" und "${luecke.nachher}"`,
    })

    if (error) {
      setToast("Fehler: " + error.message)
    } else {
      setToast("Lücken-Slot erstellt! (-15% Rabatt für schnelle Buchung)")
      await loadData()
    }
    setSaving(false)
    setTimeout(() => setToast(""), 3000)
  }

  async function deleteSlot(id: string) {
    if (!window.confirm("Zeitslot wirklich löschen?")) return
    const supabase = createClient()
    await supabase.from("zeitslots").delete().eq("id", id)
    setToast("Slot gelöscht")
    await loadData()
    setTimeout(() => setToast(""), 3000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#3D8B7A]/30 border-t-[#3D8B7A] rounded-full animate-spin" />
        <span className="text-sm text-[#8C857B]">Zeitslots laden...</span>
      </div>
    </div>
  )

  const heute = new Date().toISOString().split("T")[0]
  const aktiveSlots = slots.filter(s => s.status === "verfuegbar" || s.status === "reserviert" || (s.status === "vergeben" && s.datum >= heute))
  const vergangeneSlots = slots.filter(s => s.status === "abgelaufen" || (s.status === "vergeben" && s.datum < heute))

  const statusColors: Record<string, string> = {
    verfuegbar: "bg-[#3D8B7A]/8 text-[#3D8B7A] border-[#3D8B7A]/15",
    reserviert: "bg-[#C4956A]/10 text-[#C4956A] border-[#C4956A]/15",
    vergeben: "bg-[#2D2A26]/8 text-[#2D2A26] border-[#2D2A26]/15",
    abgelaufen: "bg-[#EDE8E1] text-[#8C857B] border-[#EDE8E1]",
  }
  const statusLabels: Record<string, string> = {
    verfuegbar: "Online",
    reserviert: "Reserviert",
    vergeben: "Gebucht",
    abgelaufen: "Abgelaufen",
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto pt-16 md:pt-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-white border border-[#3D8B7A]/30 text-[#2D2A26] text-sm px-4 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2A26]">Meine Zeitslots</h1>
          <p className="text-sm text-[#8C857B] mt-1">Verwalte deine Verfügbarkeit — Dynamisches Pricing inklusive</p>
        </div>
        <button
          onClick={() => setTab("erstellen")}
          className="text-xs font-bold bg-[#3D8B7A] text-white px-4 py-2.5 rounded-xl hover:bg-[#2D7A6A] transition-colors"
        >
          + Neuer Slot
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white p-1 rounded-xl mb-6 border border-[#EDE8E1]">
        {([
          { key: "aktiv", label: `Aktiv (${aktiveSlots.length})` },
          { key: "vergangen", label: `Vergangen (${vergangeneSlots.length})` },
          { key: "erstellen", label: "Erstellen" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-xs font-medium py-2.5 rounded-lg transition-all ${
              tab === t.key
                ? "bg-[#3D8B7A]/8 text-[#3D8B7A] border border-[#3D8B7A]/15 font-semibold"
                : "text-[#8C857B] hover:text-[#6B665E]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Lücken-Erkennung Banner */}
      {luecken.length > 0 && tab === "aktiv" && (
        <div className="bg-[#C4956A]/5 border border-[#C4956A]/15 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs bg-[#C4956A]/15 text-[#C4956A] px-2 py-0.5 rounded-full font-bold">AI</span>
            <span className="text-sm font-semibold text-[#2D2A26]">
              {luecken.length} Lücke{luecken.length > 1 ? "n" : ""} erkannt
            </span>
            <span className="text-xs text-[#8C857B]">— Monetarisiere leere Zeitfenster mit –15% Rabatt</span>
          </div>
          <div className="flex flex-col gap-2">
            {luecken.slice(0, 3).map((l, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3 border border-[#EDE8E1]">
                <div>
                  <div className="text-xs font-medium text-[#2D2A26]">
                    {new Date(l.datum).toLocaleDateString("de", { weekday: "short", day: "numeric", month: "short" })}
                    {" — "}
                    {formatZeit(l.von)} bis {formatZeit(l.bis)} ({l.stunden}h)
                  </div>
                  <div className="text-[10px] text-[#8C857B] mt-0.5">
                    Zwischen &ldquo;{l.vorher}&rdquo; und &ldquo;{l.nachher}&rdquo;
                  </div>
                </div>
                <button
                  onClick={() => createLueckenSlot(l)}
                  disabled={saving}
                  className="text-xs font-semibold bg-[#C4956A]/10 text-[#C4956A] border border-[#C4956A]/20 px-3 py-1.5 rounded-lg hover:bg-[#C4956A]/20 transition-colors"
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
        <form onSubmit={createSlot} className="bg-white border border-[#EDE8E1] rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#2D2A26] mb-4">Neuen Zeitslot erstellen</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#8C857B] mb-1 block font-medium">Titel (optional)</label>
              <input
                type="text"
                value={form.titel}
                onChange={(e) => setForm({ ...form, titel: e.target.value })}
                placeholder="z.B. Sanitär-Einsatz Vormittag"
                className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#8C857B]/60 focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#8C857B] mb-1 block font-medium">Gewerk</label>
              <select
                value={form.gewerk}
                onChange={(e) => setForm({ ...form, gewerk: e.target.value })}
                className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors"
              >
                <option value="">Standard ({GEWERK_LABELS[profile?.gewerk || "allgemein"]})</option>
                {Object.entries(GEWERK_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#8C857B] mb-1 block font-medium">Datum *</label>
              <input
                type="date"
                required
                value={form.datum}
                onChange={(e) => setForm({ ...form, datum: e.target.value })}
                min={heute}
                className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#8C857B] mb-1 block font-medium">Von *</label>
                <input
                  type="time"
                  required
                  value={form.von}
                  onChange={(e) => setForm({ ...form, von: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-[#8C857B] mb-1 block font-medium">Bis *</label>
                <input
                  type="time"
                  required
                  value={form.bis}
                  onChange={(e) => setForm({ ...form, bis: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-[#8C857B] mb-1 block font-medium">Notizen (optional)</label>
              <textarea
                value={form.notizen}
                onChange={(e) => setForm({ ...form, notizen: e.target.value })}
                placeholder="z.B. Nur Kleinreparaturen, max. 30km Umkreis..."
                rows={2}
                className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#8C857B]/60 focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Preis-Preview */}
          {form.datum && form.von && (
            <div className="mt-4 bg-[#FAF8F5] rounded-xl p-4 border border-[#EDE8E1]">
              <div className="text-xs text-[#8C857B] mb-2 font-medium">Preis-Vorschau (dynamisch)</div>
              {(() => {
                const basisPreis = profile?.basis_preis || GEWERK_BASIS_PREISE[profile?.gewerk || "allgemein"] || 50
                const preisInfo = berechneDynamischenPreis(basisPreis, form.datum, form.von, 0, slots.filter((s) => s.status === "verfuegbar").length, false)
                return (
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-2xl font-bold" style={{ color: preisInfo.farbe }}>
                        {preisInfo.dynamischerPreis} €/h
                      </div>
                      <div className="text-xs text-[#8C857B]">
                        Basis: {basisPreis} € × {preisInfo.gesamtFaktor}
                      </div>
                    </div>
                    <div
                      className="text-xs px-3 py-1 rounded-full font-medium"
                      style={{ backgroundColor: preisInfo.farbe + "15", color: preisInfo.farbe }}
                    >
                      {preisInfo.label}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-xs text-[#8C857B] space-y-0.5">
                        <div>Tageszeit: ×{preisInfo.faktoren.tageszeit}</div>
                        <div>Wochentag: ×{preisInfo.faktoren.wochentag}</div>
                        <div>Knappheit: ×{preisInfo.faktoren.knappheit}</div>
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
              className="flex-1 text-sm font-bold bg-[#3D8B7A] text-white py-3 rounded-xl hover:bg-[#2D7A6A] transition-colors disabled:opacity-50"
            >
              {saving ? "Wird erstellt..." : "Zeitslot veröffentlichen"}
            </button>
            <button
              type="button"
              onClick={() => setTab("aktiv")}
              className="text-sm text-[#6B665E] border border-[#EDE8E1] px-6 py-3 rounded-xl hover:bg-[#F5F0EB] transition-colors"
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
            <div className="bg-white border border-[#EDE8E1] rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">&#128197;</div>
              <div className="text-lg font-semibold text-[#2D2A26] mb-1">Noch keine Zeitslots</div>
              <div className="text-sm text-[#8C857B] mb-4">Erstelle deinen ersten Slot und werde im Marktplatz sichtbar</div>
              <button
                onClick={() => setTab("erstellen")}
                className="text-sm font-bold bg-[#3D8B7A] text-white px-6 py-3 rounded-xl hover:bg-[#2D7A6A] transition-colors"
              >
                + Ersten Zeitslot erstellen
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {aktiveSlots.map((s, idx) => {
                const preis = s.dynamischer_preis || s.basis_preis_stunde
                const gebotsCount = (s.gebote as any[])?.length || 0
                const showDateHeader = idx === 0 || aktiveSlots[idx - 1].datum !== s.datum
                return (
                  <div key={s.id}>
                    {showDateHeader && (
                      <div className={`flex items-center gap-3 ${idx>> 0 ? "mt-4" : ""} mb-2`}>
                        <div className="text-xs font-semibold text-[#6B665E]">
                          {new Date(s.datum).toLocaleDateString("de", { weekday: "long", day: "numeric", month: "long" })}
                        </div>
                        <div className="flex-1 h-px bg-[#EDE8E1]" />
                        <div className="text-xs text-[#8C857B]">
                          {aktiveSlots.filter(sl => sl.datum === s.datum).length} Slots
                        </div>
                      </div>
                    )}
                    <div className="bg-white border border-[#EDE8E1] rounded-xl p-4 hover:border-[#3D8B7A]/20 hover:shadow-sm transition-all">
                      <div className="flex items-center justify-between flex-wrap gap-3">
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
                            <div className="text-sm font-medium text-[#2D2A26] flex items-center gap-2">
                              {s.titel}
                              {s.ist_luecke && (
                                <span className="text-[9px] bg-[#C4956A]/10 text-[#C4956A] px-1.5 py-0.5 rounded-full font-medium">
                                  Lücke
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#8C857B]">
                              {formatZeit(s.von)} – {formatZeit(s.bis)} ({s.stunden}h) · {GEWERK_LABELS[s.gewerk || "allgemein"]}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {gebotsCount > 0 && (
                            <span className="text-xs bg-[#C4956A]/10 text-[#C4956A] px-2 py-0.5 rounded-full font-medium animate-pulse">
                              {gebotsCount} {gebotsCount === 1 ? "Anfrage" : "Anfragen"}
                            </span>
                          )}
                          <div className="text-right">
                            <div className="text-lg font-bold text-[#3D8B7A]">{preis} €/h</div>
                            {s.preisfaktor > 1.0 && (
                              <div className="text-xs text-[#C4956A]">×{s.preisfaktor} Surge</div>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium border ${statusColors[s.status]}`}>
                            {statusLabels[s.status]}
                          </span>
                          {s.status === "verfuegbar" && (
                            <button
                              onClick={() => deleteSlot(s.id)}
                              className="text-xs text-[#8C857B] hover:text-[#C4574B] transition-colors ml-1"
                              title="Slot löschen"
                            >
                              ✕
                            </button>
                          )}
                        </div>
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
            <div className="bg-white border border-[#EDE8E1] rounded-2xl p-8 text-center">
              <div className="text-sm text-[#8C857B]">Keine vergangenen Slots vorhanden</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {vergangeneSlots.map((s) => {
                const preis = s.dynamischer_preis || s.basis_preis_stunde
                return (
                  <div key={s.id} className="bg-white border border-[#EDE8E1] rounded-xl p-4 opacity-60">
                    <div className="flex items-center justify-between flex-wrap gap-3">
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
                          <div className="text-xs text-[#8C857B]">
                            {formatZeit(s.von)} – {formatZeit(s.bis)} ({s.stunden}h)
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-[#8C857B]">{preis} €/h</div>
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
      )}
    </div>
  )
}
