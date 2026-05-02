"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile } from "@/types"
import AddressAutocomplete from "@/components/AddressAutocomplete"
import { haversineKm, schaetzeFahrzeitMin, formatiereFahrzeit, formatiereDistanz } from "@/lib/distance"

type Termin = {
  id: string
  source: "auftrag" | "privat"
  datum: string
  von: string
  bis: string
  titel: string
  adresse: string | null
  lat: number | null
  lng: number | null
  ticket_id?: string | null
}

function isoHeute(): string {
  return new Date().toISOString().slice(0, 10)
}

function deutschesDatum(iso: string): string {
  const d = new Date(iso + "T12:00:00")
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })
}

function shiftDatum(iso: string, tage: number): string {
  const d = new Date(iso + "T12:00:00")
  d.setDate(d.getDate() + tage)
  return d.toISOString().slice(0, 10)
}

function parseTimeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + (m || 0)
}

function formatStunden(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m === 0 ? `${h} Std` : `${h} Std ${m} min`
}

export default function TerminePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [datum, setDatum] = useState(isoHeute())
  const [termine, setTermine] = useState<Termin[]>([])
  const [loading, setLoading] = useState(true)
  const [showPrivatForm, setShowPrivatForm] = useState(false)
  const [privatForm, setPrivatForm] = useState({
    bezeichnung: "Privat",
    von: "12:00",
    bis: "13:00",
    adresse: "",
    lat: null as number | null,
    lng: null as number | null,
  })
  const [privatSaving, setPrivatSaving] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data: prof } = await supabase
      .from("profiles").select("*").eq("id", user.id).single()
    setProfile(prof)

    // Auftrags-Termine
    const { data: auftragsTermine } = await supabase
      .from("termine")
      .select("*, ticket:tickets(titel, einsatzort_adresse, einsatzort_lat, einsatzort_lng)")
      .eq("handwerker_id", user.id)
      .eq("datum", datum)

    // Private Termine
    const { data: privateTermine } = await supabase
      .from("private_termine")
      .select("*")
      .eq("handwerker_id", user.id)
      .eq("datum", datum)

    const liste: Termin[] = []
    for (const t of auftragsTermine || []) {
      const tk = (t as { ticket?: { titel?: string; einsatzort_adresse?: string; einsatzort_lat?: number; einsatzort_lng?: number } }).ticket
      liste.push({
        id: t.id,
        source: "auftrag",
        datum: t.datum,
        von: t.von?.slice(0, 5) || "",
        bis: t.bis?.slice(0, 5) || "",
        titel: t.titel || tk?.titel || "Auftrag",
        adresse: t.einsatzort_adresse || tk?.einsatzort_adresse || null,
        lat: t.einsatzort_lat ?? tk?.einsatzort_lat ?? null,
        lng: t.einsatzort_lng ?? tk?.einsatzort_lng ?? null,
        ticket_id: t.ticket_id,
      })
    }
    for (const t of privateTermine || []) {
      liste.push({
        id: t.id,
        source: "privat",
        datum: t.datum,
        von: t.von?.slice(0, 5) || "",
        bis: t.bis?.slice(0, 5) || "",
        titel: t.bezeichnung || "Privat",
        adresse: t.adresse,
        lat: t.lat,
        lng: t.lng,
      })
    }
    liste.sort((a, b) => parseTimeToMin(a.von) - parseTimeToMin(b.von))
    setTermine(liste)
    setLoading(false)
  }, [datum, router])

  useEffect(() => { load() }, [load])

  async function privatSpeichern() {
    setPrivatSaving(true)
    setError("")
    if (privatForm.bis <= privatForm.von) {
      setError("Endzeit muss nach Startzeit liegen.")
      setPrivatSaving(false)
      return
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: insertErr } = await supabase.from("private_termine").insert({
      handwerker_id: user.id,
      datum,
      von: privatForm.von,
      bis: privatForm.bis,
      adresse: privatForm.adresse || null,
      lat: privatForm.lat,
      lng: privatForm.lng,
      bezeichnung: privatForm.bezeichnung || "Privat",
    })
    if (insertErr) {
      setError("Speichern fehlgeschlagen: " + insertErr.message)
      setPrivatSaving(false)
      return
    }
    setShowPrivatForm(false)
    setPrivatForm({ bezeichnung: "Privat", von: "12:00", bis: "13:00", adresse: "", lat: null, lng: null })
    setPrivatSaving(false)
    await load()
  }

  async function privatLoeschen(id: string) {
    if (!confirm("Privattermin löschen?")) return
    const supabase = createClient()
    await supabase.from("private_termine").delete().eq("id", id)
    await load()
  }

  // Routen-Hops berechnen
  type Hop = { vonOrt: string | null; nachOrt: string | null; fahrzeit: number; distanz: number }
  const hops: Hop[] = []
  for (let i = 0; i < termine.length; i++) {
    const t = termine[i]
    const vorher = i === 0
      ? (profile?.startort_lat != null && profile?.startort_lng != null
          ? { lat: profile.startort_lat, lng: profile.startort_lng, name: profile.startort_adresse || "Startort" }
          : null)
      : (termine[i - 1].lat != null && termine[i - 1].lng != null
          ? { lat: termine[i - 1].lat!, lng: termine[i - 1].lng!, name: termine[i - 1].adresse || termine[i - 1].titel }
          : null)
    if (vorher && t.lat != null && t.lng != null) {
      const dKm = haversineKm(vorher.lat, vorher.lng, t.lat, t.lng)
      hops.push({
        vonOrt: vorher.name,
        nachOrt: t.adresse || t.titel,
        fahrzeit: schaetzeFahrzeitMin(dKm),
        distanz: dKm,
      })
    } else {
      hops.push({ vonOrt: null, nachOrt: t.adresse || t.titel, fahrzeit: 0, distanz: 0 })
    }
  }

  const startortGesetzt = profile?.startort_lat != null && profile?.startort_lng != null

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#3D8B7A]/30 border-t-[#3D8B7A] rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto pt-16 md:pt-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D2A26]">Termine &amp; Route</h1>
        <p className="text-sm text-[#8C857B] mt-1">
          Tagesplan mit Adressen — Basis für die Routen-Optimierung in Auktionen
        </p>
      </div>

      {/* Datums-Picker */}
      <div className="bg-white rounded-2xl border border-[#EDE8E1] p-4 mb-4 flex items-center justify-between">
        <button
          onClick={() => setDatum(d => shiftDatum(d, -1))}
          aria-label="Vorheriger Tag"
          className="w-10 h-10 rounded-xl border border-[#EDE8E1] hover:bg-[#FAF8F5] transition-colors flex items-center justify-center"
        >
          ←
        </button>
        <div className="text-center">
          <div className="text-base font-semibold text-[#2D2A26]">
            {datum === isoHeute() ? "Heute" : deutschesDatum(datum)}
          </div>
          {datum !== isoHeute() && (
            <button
              onClick={() => setDatum(isoHeute())}
              className="text-xs text-[#3D8B7A] hover:text-[#2D6B5A] mt-0.5 font-medium"
            >
              Zurück zu Heute
            </button>
          )}
        </div>
        <button
          onClick={() => setDatum(d => shiftDatum(d, 1))}
          aria-label="Nächster Tag"
          className="w-10 h-10 rounded-xl border border-[#EDE8E1] hover:bg-[#FAF8F5] transition-colors flex items-center justify-center"
        >
          →
        </button>
      </div>

      {/* Startort-Hint */}
      {!startortGesetzt && (
        <div className="mb-4 p-4 rounded-2xl bg-[#FAF1DE] border border-[#C4956A]/40 text-sm text-[#854F0B]">
          Tipp: Setze deinen <a href="/dashboard-handwerker/profil" className="underline font-semibold">Startort</a> im Profil — dann kann das System die Anfahrt zum ersten Termin mit einrechnen.
        </div>
      )}

      {/* Routen-Übersicht */}
      {termine.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#EDE8E1] p-5 mb-4">
          <h2 className="text-sm font-semibold text-[#2D2A26] uppercase tracking-wide mb-3">Tagesroute</h2>
          <div className="space-y-3">
            {/* Startort */}
            {startortGesetzt && (
              <div className="flex items-center gap-3 text-xs">
                <span className="w-2 h-2 rounded-full bg-[#3D8B7A]" />
                <span className="text-[#2D2A26] font-medium">Start: {profile?.startort_adresse || "Startort"}</span>
              </div>
            )}
            {termine.map((t, i) => {
              const hop = hops[i]
              const istErster = i === 0
              const zeigeHop = (istErster && startortGesetzt) || (!istErster && hop.fahrzeit > 0)
              return (
                <div key={t.id}>
                  {zeigeHop && (
                    <div className="ml-1 flex items-center gap-2 text-[10px] text-[#8C857B] my-1">
                      <span className="w-px h-4 bg-[#EDE8E1] ml-px" />
                      <span>↓ {formatiereFahrzeit(hop.fahrzeit)} · {formatiereDistanz(hop.distanz)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`w-2 h-2 rounded-full ${t.source === "auftrag" ? "bg-[#3D8B7A]" : "bg-[#8C857B]"}`} />
                    <span className="text-[#2D2A26] font-medium tabular-nums">{t.von}–{t.bis}</span>
                    <span className="text-[#6B665E]">·</span>
                    <span className="text-[#2D2A26] truncate">{t.adresse || t.titel}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Termine-Liste */}
      <div className="space-y-2 mb-4">
        {termine.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#EDE8E1] p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FAF8F5] flex items-center justify-center mb-3">
              <span className="text-xl">📅</span>
            </div>
            <div className="text-sm font-medium text-[#2D2A26] mb-1">Keine Termine an diesem Tag</div>
            <div className="text-xs text-[#8C857B]">Privattermine eintragen, damit die Auktion deine echte Route kennt.</div>
          </div>
        ) : (
          termine.map(t => (
            <div
              key={t.id}
              className={`bg-white rounded-2xl border p-4 ${
                t.source === "auftrag" ? "border-[#3D8B7A]/30" : "border-[#EDE8E1]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[#2D2A26] tabular-nums">
                      {t.von} – {t.bis}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded ${
                      t.source === "auftrag"
                        ? "bg-[#3D8B7A]/10 text-[#3D8B7A]"
                        : "bg-[#EDE8E1] text-[#6B665E]"
                    }`}>
                      {t.source === "auftrag" ? "Auftrag" : "Privat"}
                    </span>
                  </div>
                  <div className="text-sm text-[#2D2A26]">{t.titel}</div>
                  {t.adresse && (
                    <div className="text-xs text-[#8C857B] mt-1 flex items-start gap-1">
                      <span className="flex-shrink-0">📍</span>
                      <span>{t.adresse}</span>
                    </div>
                  )}
                </div>
                {t.source === "privat" && (
                  <button
                    onClick={() => privatLoeschen(t.id)}
                    aria-label="Privattermin löschen"
                    className="text-xs text-[#C4574B] hover:bg-[#C4574B]/10 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
                  >
                    Löschen
                  </button>
                )}
                {t.source === "auftrag" && t.ticket_id && (
                  <button
                    onClick={() => router.push(`/ticket/${t.ticket_id}`)}
                    className="text-xs text-[#3D8B7A] hover:text-[#2D6B5A] font-medium flex-shrink-0"
                  >
                    Details →
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Privattermin hinzufügen */}
      {!showPrivatForm ? (
        <button
          onClick={() => setShowPrivatForm(true)}
          className="w-full bg-white border-2 border-dashed border-[#EDE8E1] hover:border-[#3D8B7A]/40 hover:bg-[#FAF8F5] transition-colors rounded-2xl p-4 text-sm font-medium text-[#6B665E] hover:text-[#2D2A26]"
        >
          + Privattermin eintragen
        </button>
      ) : (
        <div className="bg-white rounded-2xl border border-[#3D8B7A]/30 p-5">
          <h3 className="text-base font-semibold text-[#2D2A26] mb-3">Privattermin eintragen</h3>
          <p className="text-xs text-[#8C857B] mb-4">
            Auch Termine außerhalb von Reparo eintragen (Mittagessen, Privattermin) — damit das System deine echte Route kennt. Details bleiben privat.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#8C857B] mb-1.5 block font-medium">Bezeichnung</label>
              <input
                type="text"
                value={privatForm.bezeichnung}
                onChange={e => setPrivatForm(f => ({ ...f, bezeichnung: e.target.value }))}
                placeholder="z.B. Mittagessen, Arzttermin, Privat"
                className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm focus:border-[#3D8B7A]/40 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#8C857B] mb-1.5 block font-medium">Von</label>
                <input
                  type="time"
                  value={privatForm.von}
                  onChange={e => setPrivatForm(f => ({ ...f, von: e.target.value }))}
                  className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm focus:border-[#3D8B7A]/40 focus:outline-none tabular-nums"
                />
              </div>
              <div>
                <label className="text-xs text-[#8C857B] mb-1.5 block font-medium">Bis</label>
                <input
                  type="time"
                  value={privatForm.bis}
                  onChange={e => setPrivatForm(f => ({ ...f, bis: e.target.value }))}
                  className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm focus:border-[#3D8B7A]/40 focus:outline-none tabular-nums"
                />
              </div>
            </div>
            <AddressAutocomplete
              label="Ort (optional, aber empfohlen für die Routen-Berechnung)"
              placeholder="Adresse"
              initialAdresse={privatForm.adresse}
              onSelect={({ adresse, lat, lng }) =>
                setPrivatForm(f => ({ ...f, adresse, lat, lng }))
              }
            />

            {error && (
              <div className="text-xs text-[#C4574B] bg-[#C4574B]/10 border border-[#C4574B]/20 rounded-lg p-2.5">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={privatSpeichern}
                disabled={privatSaving}
                className="text-sm font-bold bg-[#3D8B7A] text-white px-5 py-2.5 rounded-xl hover:bg-[#2D6B5A] transition-colors disabled:opacity-50"
              >
                {privatSaving ? "Speichert…" : "Speichern"}
              </button>
              <button
                onClick={() => { setShowPrivatForm(false); setError("") }}
                className="text-sm text-[#6B665E] hover:text-[#2D2A26] px-4 py-2.5 transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistik */}
      {termine.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white rounded-xl border border-[#EDE8E1] p-3">
            <div className="text-xl font-bold text-[#2D2A26] tabular-nums">{termine.length}</div>
            <div className="text-[10px] text-[#8C857B] uppercase tracking-wide mt-0.5">Termine</div>
          </div>
          <div className="bg-white rounded-xl border border-[#EDE8E1] p-3">
            <div className="text-xl font-bold text-[#3D8B7A] tabular-nums">
              {formatStunden(hops.reduce((s, h) => s + h.fahrzeit, 0))}
            </div>
            <div className="text-[10px] text-[#8C857B] uppercase tracking-wide mt-0.5">Fahrzeit</div>
          </div>
          <div className="bg-white rounded-xl border border-[#EDE8E1] p-3">
            <div className="text-xl font-bold text-[#C4956A] tabular-nums">
              {formatiereDistanz(hops.reduce((s, h) => s + h.distanz, 0))}
            </div>
            <div className="text-[10px] text-[#8C857B] uppercase tracking-wide mt-0.5">Distanz</div>
          </div>
        </div>
      )}
    </div>
  )
}
