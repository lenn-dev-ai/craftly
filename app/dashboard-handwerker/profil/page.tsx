"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile } from "@/types"
import AddressAutocomplete from "@/components/AddressAutocomplete"

type FormState = {
  name: string
  firma: string
  gewerk: string
  plz_bereich: string
  telefon: string
  adresse: string
  lat: number | null
  lng: number | null
  radius_km: number
  // Neu — Stundensätze + Fahrtkosten + Startort
  basis_stundensatz: number | null
  mindest_stundensatz: number | null
  fahrtkosten_pro_km: number
  startort_adresse: string
  startort_lat: number | null
  startort_lng: number | null
}

export default function ProfilPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [form, setForm] = useState<FormState>({
    name: "", firma: "", gewerk: "", plz_bereich: "", telefon: "",
    adresse: "", lat: null, lng: null, radius_km: 25,
    basis_stundensatz: null, mindest_stundensatz: null, fahrtkosten_pro_km: 0.5,
    startort_adresse: "", startort_lat: null, startort_lng: null,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      if (data) {
        setProfile(data)
        setForm({
          name: data.name || "",
          firma: data.firma || "",
          gewerk: data.gewerk || "",
          plz_bereich: data.plz_bereich || "",
          telefon: data.telefon || "",
          adresse: data.adresse || "",
          lat: data.lat ?? null,
          lng: data.lng ?? null,
          radius_km: data.radius_km ?? 25,
          basis_stundensatz: data.basis_stundensatz ?? null,
          mindest_stundensatz: data.mindest_stundensatz ?? null,
          fahrtkosten_pro_km: data.fahrtkosten_pro_km ?? 0.5,
          startort_adresse: data.startort_adresse || "",
          startort_lat: data.startort_lat ?? null,
          startort_lng: data.startort_lng ?? null,
        })
      }
    }
    load()
  }, [router])

  async function save() {
    setSaving(true)
    setError("")
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error: updateErr } = await supabase.from("profiles").update(form).eq("id", user.id)
      if (updateErr) {
        setError("Speichern fehlgeschlagen: " + updateErr.message)
        setSaving(false)
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.")
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#3D8B7A]/30 border-t-[#3D8B7A] rounded-full animate-spin" />
        <span className="text-sm text-[#8C857B]">Lädt…</span>
      </div>
    </div>
  )

  const standortGesetzt = form.lat != null && form.lng != null
  const startortGesetzt = form.startort_lat != null && form.startort_lng != null
  const stundensatzGesetzt = form.basis_stundensatz != null && form.basis_stundensatz > 0

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto pt-16 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D2A26]">Mein Profil</h1>
        <p className="text-sm text-[#8C857B] mt-1">Diese Angaben sehen Hausverwaltungen, wenn du Aufträge findest</p>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl border border-[#EDE8E1] p-6 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#3D8B7A]/10 flex items-center justify-center text-[#3D8B7A] text-2xl font-bold">
            {(profile.firma || profile.name || "H").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[#2D2A26] text-lg">{profile.firma || profile.name}</div>
            <div className="text-sm text-[#8C857B]">{profile.email}</div>
            <div className="text-xs mt-1">
              {profile.bewertung_avg ? (
                <span className="text-[#C4956A] font-medium">★ {profile.bewertung_avg} · {profile.auftraege_anzahl || 0} Aufträge</span>
              ) : (
                <span className="text-[#8C857B]">Noch keine Bewertungen</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Standort & Radius */}
      <div className={`rounded-2xl border p-6 mb-4 transition-colors ${
        standortGesetzt ? "bg-white border-[#EDE8E1]" : "bg-[#FAF1DE] border-[#C4956A]/40"
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-[#2D2A26] flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Standort &amp; Einsatzradius
            </h2>
            <p className="text-xs text-[#8C857B] mt-1">
              Bestimmt, welche Aufträge dir vorgeschlagen werden.
            </p>
          </div>
          {standortGesetzt && (
            <span className="text-xs text-[#3D8B7A] bg-[#3D8B7A]/10 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
              ✓ Aktiv
            </span>
          )}
        </div>

        <div className="space-y-4 mt-4">
          <AddressAutocomplete
            label="Werkstatt / Büro-Standort"
            placeholder="Straße, Hausnummer, Ort"
            initialAdresse={form.adresse}
            onSelect={({ adresse, lat, lng }) =>
              setForm(f => ({ ...f, adresse, lat, lng }))
            }
          />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#2D2A26]">Einsatzradius</label>
              <span className="text-2xl font-bold text-[#3D8B7A] tabular-nums">
                {form.radius_km}<span className="text-sm font-normal text-[#8C857B] ml-1">km</span>
              </span>
            </div>
            <input
              type="range" min="5" max="100" step="5"
              value={form.radius_km}
              onChange={e => setForm(f => ({ ...f, radius_km: Number(e.target.value) }))}
              className="w-full accent-[#3D8B7A] cursor-pointer"
              aria-label="Einsatzradius in Kilometern"
            />
            <div className="flex justify-between text-xs text-[#8C857B] mt-1">
              <span>5 km</span><span>50 km</span><span>100 km</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stundensätze & Fahrtkosten — neu */}
      <div className={`rounded-2xl border p-6 mb-4 transition-colors ${
        stundensatzGesetzt ? "bg-white border-[#EDE8E1]" : "bg-[#FAF1DE] border-[#C4956A]/40"
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-[#2D2A26] flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Stundensätze &amp; Fahrtkosten
            </h2>
            <p className="text-xs text-[#8C857B] mt-1">
              Basis für Auktionen — der Effektivpreis berechnet sich aus Stundensatz + anteiliger Fahrtkosten.
            </p>
          </div>
          {stundensatzGesetzt && (
            <span className="text-xs text-[#3D8B7A] bg-[#3D8B7A]/10 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
              ✓ Aktiv
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <NumField
            label="Basis-Stundensatz"
            unit="€/Std"
            value={form.basis_stundensatz}
            onChange={v => setForm(f => ({ ...f, basis_stundensatz: v }))}
            placeholder="z.B. 55"
            required
          />
          <NumField
            label="Mindest-Stundensatz"
            unit="€/Std"
            value={form.mindest_stundensatz}
            onChange={v => setForm(f => ({ ...f, mindest_stundensatz: v }))}
            placeholder="z.B. 45"
            help="Aufträge unter diesem Preis bekommst du nicht angezeigt"
          />
          <NumField
            label="Fahrtkosten"
            unit="€/km"
            value={form.fahrtkosten_pro_km}
            onChange={v => setForm(f => ({ ...f, fahrtkosten_pro_km: v ?? 0 }))}
            placeholder="0.50"
            step="0.05"
          />
        </div>
        {form.basis_stundensatz != null && form.mindest_stundensatz != null && form.basis_stundensatz < form.mindest_stundensatz && (
          <p className="text-xs text-[#C4574B] mt-3">
            ⚠ Mindest-Stundensatz ist höher als Basis — bitte prüfen.
          </p>
        )}
      </div>

      {/* Startort */}
      <div className="bg-white rounded-2xl border border-[#EDE8E1] p-6 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-[#2D2A26] flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Startort (morgens)
            </h2>
            <p className="text-xs text-[#8C857B] mt-1">
              Wo du morgens losfährst — wichtig für die Routen-Berechnung des ersten Termins.
            </p>
          </div>
          {startortGesetzt && (
            <span className="text-xs text-[#3D8B7A] bg-[#3D8B7A]/10 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
              ✓ Gesetzt
            </span>
          )}
        </div>
        <AddressAutocomplete
          label="Adresse"
          placeholder="Privatadresse oder Werkstatt"
          initialAdresse={form.startort_adresse}
          onSelect={({ adresse, lat, lng }) =>
            setForm(f => ({ ...f, startort_adresse: adresse, startort_lat: lat, startort_lng: lng }))
          }
        />
        {form.adresse && form.startort_adresse !== form.adresse && (
          <button
            type="button"
            onClick={() =>
              setForm(f => ({
                ...f,
                startort_adresse: f.adresse,
                startort_lat: f.lat,
                startort_lng: f.lng,
              }))
            }
            className="mt-2 text-xs text-[#3D8B7A] hover:text-[#2D6B5A] font-medium"
          >
            Wie Werkstatt-Standort übernehmen
          </button>
        )}
      </div>

      {/* Stammdaten */}
      <div className="bg-white rounded-2xl border border-[#EDE8E1] p-6">
        <h2 className="text-base font-semibold text-[#2D2A26] mb-4">Stammdaten</h2>

        <div className="flex flex-col gap-4">
          <Field label="Vollständiger Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
          <Field label="Firmenname" value={form.firma} onChange={v => setForm(f => ({ ...f, firma: v }))} />
          <Field label="Gewerk / Spezialisierung" value={form.gewerk} onChange={v => setForm(f => ({ ...f, gewerk: v }))} placeholder="z.B. Heizung, Sanitär" />
          <Field label="PLZ-Einzugsgebiet (zusätzlich, optional)" value={form.plz_bereich} onChange={v => setForm(f => ({ ...f, plz_bereich: v }))} placeholder="z.B. 60xxx, 65xxx" />
          <Field label="Telefon" value={form.telefon} onChange={v => setForm(f => ({ ...f, telefon: v }))} type="tel" placeholder="+49 …" />

          {error && (
            <div className="p-3 rounded-lg bg-[#C4574B]/10 border border-[#C4574B]/20 text-sm text-[#C4574B]">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={save}
              disabled={saving}
              className="text-sm font-bold bg-[#3D8B7A] text-white px-6 py-2.5 rounded-xl hover:bg-[#2D6B5A] transition-colors disabled:opacity-50"
            >
              {saving ? "Speichert…" : "Profil speichern"}
            </button>
            {saved && (
              <span className="text-xs text-[#3D8B7A] font-medium">✓ Gespeichert</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-[#8C857B] mb-1.5 block font-medium">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#8C857B]/60 focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors"
      />
    </div>
  )
}

function NumField({
  label, unit, value, onChange, placeholder, help, step = "1", required = false,
}: {
  label: string
  unit: string
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  help?: string
  step?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="text-xs text-[#8C857B] mb-1.5 block font-medium">
        {label} {required && <span className="text-[#C4574B]">*</span>}
      </label>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min="0"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={e => {
            const v = e.target.value
            onChange(v === "" ? null : Number(v))
          }}
          className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl pl-4 pr-14 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#8C857B]/60 focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors tabular-nums"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8C857B] pointer-events-none">
          {unit}
        </span>
      </div>
      {help && <p className="text-[10px] text-[#8C857B] mt-1.5">{help}</p>}
    </div>
  )
}
