"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile } from "@/types"
import AddressAutocomplete from "@/components/AddressAutocomplete"
import { useToast } from "@/components/Toast"

type FormState = {
  name: string
  firma: string
  gewerk: string
  // Sprint L — Stamm-Gewerke (1-3 aus fester Liste)
  handwerker_gewerke: string[]
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
  // U7-Fix Audit (27.05.): Arbeitszeit-Fenster — bestimmt die Stunden-Achse
  // im Kalender. Defaults DB-seitig 7-20.
  arbeitszeit_von: number
  arbeitszeit_bis: number
}

const GEWERK_AUSWAHL = [
  { key: "heizung_sanitaer", label: "Heizung / Sanitär" },
  { key: "elektro", label: "Elektro" },
  { key: "schreiner", label: "Schreiner / Tischler" },
  { key: "maler", label: "Maler" },
  { key: "dachdecker", label: "Dachdecker" },
  { key: "bodenleger", label: "Bodenleger" },
  { key: "schluessel", label: "Schlüsseldienst" },
  { key: "allgemein", label: "Allgemein" },
] as const
const MAX_GEWERKE = 3

export default function ProfilPage() {
  const router = useRouter()
  const { show } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [form, setForm] = useState<FormState>({
    name: "", firma: "", gewerk: "", handwerker_gewerke: [],
    plz_bereich: "", telefon: "",
    adresse: "", lat: null, lng: null, radius_km: 25,
    basis_stundensatz: null, mindest_stundensatz: null, fahrtkosten_pro_km: 0.5,
    startort_adresse: "", startort_lat: null, startort_lng: null,
    arbeitszeit_von: 7, arbeitszeit_bis: 20,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase
        .from("profiles")
        .select("id, email, name, rolle, telefon, firma, gewerk, handwerker_gewerke, plz_bereich, radius_km, basis_stundensatz, mindest_stundensatz, fahrtkosten_pro_km, startort_adresse, startort_lat, startort_lng, arbeitszeit_von, arbeitszeit_bis, bewertung_avg, auftraege_anzahl, created_at")
        .eq("id", user.id)
        .single()
      if (data) {
        setProfile(data)
        setForm({
          name: data.name || "",
          firma: data.firma || "",
          gewerk: data.gewerk || "",
          handwerker_gewerke: Array.isArray((data as { handwerker_gewerke?: string[] }).handwerker_gewerke)
            ? ((data as { handwerker_gewerke?: string[] }).handwerker_gewerke ?? [])
            : [],
          plz_bereich: data.plz_bereich || "",
          telefon: data.telefon || "",
          adresse: "",
          lat: null,
          lng: null,
          radius_km: data.radius_km ?? 25,
          basis_stundensatz: data.basis_stundensatz ?? null,
          mindest_stundensatz: data.mindest_stundensatz ?? null,
          fahrtkosten_pro_km: data.fahrtkosten_pro_km ?? 0.5,
          startort_adresse: data.startort_adresse || "",
          startort_lat: data.startort_lat ?? null,
          startort_lng: data.startort_lng ?? null,
          arbeitszeit_von: typeof (data as { arbeitszeit_von?: number | null }).arbeitszeit_von === "number"
            ? (data as { arbeitszeit_von: number }).arbeitszeit_von
            : 7,
          arbeitszeit_bis: typeof (data as { arbeitszeit_bis?: number | null }).arbeitszeit_bis === "number"
            ? (data as { arbeitszeit_bis: number }).arbeitszeit_bis
            : 20,
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
      const { adresse: _adresse, lat: _lat, lng: _lng, ...persisted } = form
      // handwerker_gewerke leer → NULL persistieren (CHECK erlaubt NULL,
      // aber kein leeres Array). Empty filter erlaubt graceful Spalten-
      // Fehlen pre-migration: dann wird das Feld einfach ignoriert.
      const payload: Record<string, unknown> = { ...persisted }
      if (Array.isArray(payload.handwerker_gewerke) &&
          (payload.handwerker_gewerke as string[]).length === 0) {
        payload.handwerker_gewerke = null
      }
      // Audit-QF: single profile.gewerk auf handwerker_gewerke[0] syncen,
      // damit ältere Code-Stellen die noch das single-Feld lesen (z.B.
      // Marktplatz-Slots, Verwalter-HW-Karten) den ersten Stamm-Gewerk
      // sehen. Verhindert Drift zwischen den beiden Repräsentationen.
      if (Array.isArray(form.handwerker_gewerke) && form.handwerker_gewerke.length > 0) {
        payload.gewerk = form.handwerker_gewerke[0]
      }
      // Sprint Final 47f62752: ein vereinheitlichter Standort statt
      // Werkstatt + Startort. Beim Save spiegeln wir den Startort auf
      // adresse/lat/lng damit alte Code-Pfade (z.B. scoring-pipeline
      // Fallback lat/lng wenn startort_* null) weiter funktionieren.
      if (form.startort_adresse && form.startort_lat != null && form.startort_lng != null) {
        payload.adresse = form.startort_adresse
        payload.lat = form.startort_lat
        payload.lng = form.startort_lng
      }
      let updateErr = (await supabase.from("profiles").update(payload).eq("id", user.id)).error
      if (updateErr && /handwerker_gewerke|column.*does not exist/i.test(updateErr.message)) {
        // Migration noch nicht angewandt — ohne das Feld retry
        const { handwerker_gewerke: _ignored, ...ohneGewerke } = payload
        void _ignored
        updateErr = (await supabase.from("profiles").update(ohneGewerke).eq("id", user.id)).error
      }
      // U7-Fix Audit (27.05.): falls Migration `audit_u7_profile_arbeitszeit`
      // auf der Ziel-DB noch fehlt, retry ohne diese Felder.
      if (updateErr && /arbeitszeit_(von|bis)|column.*does not exist/i.test(updateErr.message)) {
        const { arbeitszeit_von: _av, arbeitszeit_bis: _ab, ...ohneArb } = payload
        void _av; void _ab
        updateErr = (await supabase.from("profiles").update(ohneArb).eq("id", user.id)).error
      }
      if (updateErr) {
        show("Speichern fehlgeschlagen: " + updateErr.message, "error")
        setSaving(false)
        return
      }
      show("Profil gespeichert", "success")
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      show("Ein unerwarteter Fehler ist aufgetreten.", "error")
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-[#3D8B7A] rounded-full animate-spin" />
        <span className="text-sm text-ink-muted">Lädt…</span>
      </div>
    </div>
  )

  const standortGesetzt = form.lat != null && form.lng != null
  const startortGesetzt = form.startort_lat != null && form.startort_lng != null
  const stundensatzGesetzt = form.basis_stundensatz != null && form.basis_stundensatz > 0

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto pt-16 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Mein Profil</h1>
        <p className="text-sm text-ink-muted mt-1">Diese Angaben sehen Hausverwaltungen, wenn du Aufträge findest</p>
      </div>

      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl border border-line p-6 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-accent text-2xl font-bold">
            {(profile.firma || profile.name || "H").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-ink text-lg">{profile.firma || profile.name}</div>
            <div className="text-sm text-ink-muted">{profile.email}</div>
            <div className="text-xs mt-1">
              {profile.bewertung_avg ? (
                <span className="text-warm font-medium">★ {profile.bewertung_avg} · {profile.auftraege_anzahl || 0} Aufträge</span>
              ) : (
                <span className="text-ink-muted">Noch keine Bewertungen</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sprint L — Meine Gewerke (max 3 Stamm-Gewerke) */}
      <div className={`rounded-2xl border p-6 mb-4 transition-colors ${
        form.handwerker_gewerke.length > 0 ? "bg-white border-line" : "bg-warm-light border-warm/40"
      }`}>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-ink">Meine Gewerke</h2>
          <p className="text-xs text-ink-muted mt-1">
            Max {MAX_GEWERKE} — wir wollen Spezialisten, keine Allrounder.
            Tickets in anderen Gewerken siehst du nicht im Marktplatz.
          </p>
        </div>
        {form.handwerker_gewerke.length === 0 && (
          <div className="mb-3 text-xs text-warm-dark bg-warm/15 rounded-lg px-3 py-2">
            Noch kein Gewerk gesetzt — du siehst keine Tickets bis du mindestens eins auswählst.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {GEWERK_AUSWAHL.map(g => {
            const checked = form.handwerker_gewerke.includes(g.key)
            const disabled = !checked && form.handwerker_gewerke.length >= MAX_GEWERKE
            return (
              <label
                key={g.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition ${
                  checked
                    ? "border-accent bg-accent/5 text-ink"
                    : disabled
                      ? "border-line text-ink-faint cursor-not-allowed"
                      : "border-line text-ink hover:border-accent/40"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={e => {
                    setForm(f => ({
                      ...f,
                      handwerker_gewerke: e.target.checked
                        ? [...f.handwerker_gewerke, g.key]
                        : f.handwerker_gewerke.filter(k => k !== g.key),
                    }))
                  }}
                  className="accent-accent"
                />
                {g.label}
              </label>
            )
          })}
        </div>
        <div className="text-[11px] text-ink-muted mt-2 tabular-nums">
          {form.handwerker_gewerke.length} / {MAX_GEWERKE} ausgewählt
        </div>
      </div>

      {/* Standort & Radius — Feedback 47f62752 (Lennart 18.05.):
          "Warum unterscheiden wir zwischen Werkstatt und morgens los?
          Macht es nicht Sinn..." → vereinheitlicht. Vorher zwei
          separate Cards (Werkstatt-Adresse + Startort-morgens) mit
          praktisch identischem Use-Case. Jetzt: ein Adress-Block,
          der Startort wird beim Save auf adresse gespiegelt damit
          alte Code-Pfade (scoring-pipeline lat/lng-Fallback) weiter
          funktionieren. */}
      <div className={`rounded-2xl border p-6 mb-4 transition-colors ${
        standortGesetzt ? "bg-white border-line" : "bg-warm-light border-warm/40"
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-ink flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Einsatzradius
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              Bestimmt, welche Aufträge dir vorgeschlagen werden — gerechnet ab deinem Startort (siehe unten).
            </p>
          </div>
          {standortGesetzt && (
            <span className="text-xs text-accent bg-accent/10 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
              ✓ Aktiv
            </span>
          )}
        </div>

        <div className="space-y-4 mt-4">
          {/* Werkstatt-Adress-Block entfernt (Sprint Final 47f62752).
              Startort-Block weiter unten ist die einzige Wahrheit. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-ink">Einsatzradius</label>
              <span className="text-2xl font-bold text-accent tabular-nums">
                {form.radius_km}<span className="text-sm font-normal text-ink-muted ml-1">km</span>
              </span>
            </div>
            <input
              type="range" min="5" max="100" step="5"
              value={form.radius_km}
              onChange={e => setForm(f => ({ ...f, radius_km: Number(e.target.value) }))}
              className="w-full accent-[#3D8B7A] cursor-pointer"
              aria-label="Einsatzradius in Kilometern"
            />
            <div className="flex justify-between text-xs text-ink-muted mt-1">
              <span>5 km</span><span>50 km</span><span>100 km</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stundensätze & Fahrtkosten — neu */}
      <div className={`rounded-2xl border p-6 mb-4 transition-colors ${
        stundensatzGesetzt ? "bg-white border-line" : "bg-warm-light border-warm/40"
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-ink flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Stundensätze &amp; Fahrtkosten
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              Basis für Auktionen — der Effektivpreis berechnet sich aus Stundensatz + anteiliger Fahrtkosten.
            </p>
          </div>
          {stundensatzGesetzt && (
            <span className="text-xs text-accent bg-accent/10 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
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
          <p className="text-xs text-danger mt-3">
            ⚠ Mindest-Stundensatz ist höher als Basis — bitte prüfen.
          </p>
        )}
      </div>

      {/* Startort */}
      <div className="bg-white rounded-2xl border border-line p-6 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-ink flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Startort (morgens)
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              Wo du morgens losfährst — wichtig für die Routen-Berechnung des ersten Termins.
            </p>
          </div>
          {startortGesetzt && (
            <span className="text-xs text-accent bg-accent/10 px-2.5 py-1 rounded-full font-medium flex-shrink-0">
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
            className="mt-2 text-xs text-accent hover:text-[#2D6B5A] font-medium"
          >
            Wie Werkstatt-Standort übernehmen
          </button>
        )}
      </div>

      {/* Stammdaten */}
      <div className="bg-white rounded-2xl border border-line p-6">
        <h2 className="text-base font-semibold text-ink mb-4">Stammdaten</h2>

        <div className="flex flex-col gap-4">
          <Field label="Vollständiger Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
          <Field label="Firmenname" value={form.firma} onChange={v => setForm(f => ({ ...f, firma: v }))} />
          <Field label="Gewerk / Spezialisierung" value={form.gewerk} onChange={v => setForm(f => ({ ...f, gewerk: v }))} placeholder="z.B. Heizung, Sanitär" />
          <Field label="PLZ-Einzugsgebiet (zusätzlich, optional)" value={form.plz_bereich} onChange={v => setForm(f => ({ ...f, plz_bereich: v }))} placeholder="z.B. 60xxx, 65xxx" />
          <Field label="Telefon" value={form.telefon} onChange={v => setForm(f => ({ ...f, telefon: v }))} type="tel" placeholder="+49 …" />

          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={save}
              disabled={saving}
              className="text-sm font-bold bg-accent text-white px-6 py-2.5 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {saving ? "Speichert…" : "Profil speichern"}
            </button>
            {saved && (
              <span className="text-xs text-accent font-medium">✓ Gespeichert</span>
            )}
          </div>
        </div>
      </div>

      {/* U7-Fix Audit (27.05.): Arbeitszeit-Fenster für Kalender-Anzeige.
          Bestimmt die früheste und späteste Stunde, die in der Stunden-Achse
          des Kalenders erscheinen. Default 7-20 für Standard-Arbeitstage,
          aber Frühdienst (5-15) oder Notdienst (8-24) sind genauso möglich. */}
      <div className="bg-white rounded-2xl border border-line p-6 mt-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Arbeitszeit-Fenster
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            Bestimmt, welche Stunden in deinem Kalender angezeigt werden. Standard 7–20 Uhr.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label htmlFor="arbeitszeit-von" className="text-xs text-ink-muted mb-1.5 block font-medium">
              Frühestens ab
            </label>
            <div className="relative">
              <input
                id="arbeitszeit-von"
                type="number"
                inputMode="numeric"
                min="0"
                max="23"
                step="1"
                value={form.arbeitszeit_von}
                onChange={e => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v) && v >= 0 && v <= 23) {
                    setForm(f => ({ ...f, arbeitszeit_von: v }))
                  }
                }}
                className="w-full bg-surface border border-line rounded-xl pl-4 pr-12 py-2.5 text-sm text-ink focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted pointer-events-none">Uhr</span>
            </div>
          </div>
          <div>
            <label htmlFor="arbeitszeit-bis" className="text-xs text-ink-muted mb-1.5 block font-medium">
              Spätestens bis
            </label>
            <div className="relative">
              <input
                id="arbeitszeit-bis"
                type="number"
                inputMode="numeric"
                min="1"
                max="24"
                step="1"
                value={form.arbeitszeit_bis}
                onChange={e => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v) && v >= 1 && v <= 24) {
                    setForm(f => ({ ...f, arbeitszeit_bis: v }))
                  }
                }}
                className="w-full bg-surface border border-line rounded-xl pl-4 pr-12 py-2.5 text-sm text-ink focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted pointer-events-none">Uhr</span>
            </div>
          </div>
        </div>
        {form.arbeitszeit_bis <= form.arbeitszeit_von && (
          <p className="text-xs text-danger mt-3">
            ⚠ &bdquo;Bis&ldquo; muss nach &bdquo;Von&ldquo; liegen — sonst bleibt der Kalender leer.
          </p>
        )}
        <p className="text-[11px] text-ink-muted mt-3">
          Beispiele: Frühdienst <span className="tabular-nums">5–15</span> · Standard <span className="tabular-nums">7–20</span> · Notdienst <span className="tabular-nums">8–24</span>
        </p>
      </div>

      {/* Sprint AE — Google-Kalender-Sync (OAuth-Flow live, ENVs evtl. noch nicht gesetzt). */}
      <GoogleCalSection />
    </div>
  )
}

// ============================================================
// Sprint AE — Google-Kalender-Verbindung
// ============================================================

function GoogleCalSection() {
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected" | "error">("loading")
  const [connectedAt, setConnectedAt] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let aktiv = true
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (aktiv) setStatus("disconnected"); return }
      const { data, error } = await supabase
        .from("hw_google_oauth")
        .select("connected_at, last_sync_at, last_error")
        .eq("user_id", user.id)
        .maybeSingle<{ connected_at: string; last_sync_at: string | null; last_error: string | null }>()
      if (!aktiv) return
      if (error) { setStatus("error"); setErrorMsg(error.message); return }
      if (!data) { setStatus("disconnected"); return }
      setConnectedAt(data.connected_at)
      setLastSyncAt(data.last_sync_at)
      setStatus("connected")
      if (data.last_error) setErrorMsg(data.last_error)
    })()

    // Query-Param-Feedback nach OAuth-Redirect parsen
    const url = new URL(window.location.href)
    const flag = url.searchParams.get("google")
    if (flag === "connected") {
      setStatus("connected")
      url.searchParams.delete("google")
      window.history.replaceState({}, "", url.toString())
    } else if (flag === "error") {
      const reason = url.searchParams.get("reason") ?? "unbekannt"
      setErrorMsg(`OAuth fehlgeschlagen: ${decodeURIComponent(reason)}`)
      url.searchParams.delete("google")
      url.searchParams.delete("reason")
      window.history.replaceState({}, "", url.toString())
    }

    return () => { aktiv = false }
  }, [])

  async function connect() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      window.location.href = "/login"
      return
    }
    const res = await fetch("/api/auth/google/connect", {
      headers: { authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      setErrorMsg("Google-Verbindung konnte nicht gestartet werden — Login abgelaufen?")
      return
    }
    const data = await res.json() as { redirectUrl?: string }
    if (data.redirectUrl) window.location.href = data.redirectUrl
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch("/api/auth/google/disconnect", {
        method: "POST",
        headers: session?.access_token ? { authorization: `Bearer ${session.access_token}` } : undefined,
      })
      if (res.ok) {
        setStatus("disconnected")
        setConnectedAt(null)
        setLastSyncAt(null)
        setErrorMsg(null)
      } else {
        const j = await res.json().catch(() => ({}))
        setErrorMsg(j.error ?? "Trennen fehlgeschlagen")
      }
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-line p-6 mt-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-base font-semibold text-ink mb-1">
            Google Kalender verbinden
          </h2>
          <p className="text-sm text-ink-muted">
            Verbinde deinen Google-Kalender, damit Reparo deine freien Zeiten
            automatisch nutzt und neue Aufträge direkt im Kalender erscheinen.
          </p>
          {status === "connected" && (
            <div className="mt-3 text-xs text-ink-secondary space-y-0.5">
              <div className="text-emerald-700 font-medium">🟢 Verbunden</div>
              {connectedAt && <div>Seit: {new Date(connectedAt).toLocaleDateString("de-DE")}</div>}
              {lastSyncAt && <div>Letzte Synchronisation: {new Date(lastSyncAt).toLocaleString("de-DE")}</div>}
            </div>
          )}
          {errorMsg && (
            <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {errorMsg}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status === "loading" && (
            <span className="text-xs text-ink-muted">Lädt…</span>
          )}
          {status === "disconnected" && (
            <button
              type="button"
              onClick={connect}
              className="text-xs font-semibold bg-accent text-white border border-accent px-4 py-2 rounded-xl hover:bg-accent-hover transition-colors"
            >
              Mit Google verbinden
            </button>
          )}
          {status === "connected" && (
            <button
              type="button"
              onClick={disconnect}
              disabled={disconnecting}
              className="text-xs font-semibold bg-white text-rose-700 border border-rose-200 px-4 py-2 rounded-xl hover:bg-rose-50 transition-colors disabled:opacity-50"
            >
              {disconnecting ? "Trennt…" : "Trennen"}
            </button>
          )}
          {status === "error" && (
            <button
              type="button"
              onClick={connect}
              className="text-xs font-semibold bg-accent text-white px-4 py-2 rounded-xl hover:bg-accent-hover transition-colors"
            >
              Erneut verbinden
            </button>
          )}
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
  const id = `profile-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  return (
    <div>
      <label htmlFor={id} className="text-xs text-ink-muted mb-1.5 block font-medium">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
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
  const id = `profile-num-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  return (
    <div>
      <label htmlFor={id} className="text-xs text-ink-muted mb-1.5 block font-medium">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
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
          className="w-full bg-surface border border-line rounded-xl pl-4 pr-14 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors tabular-nums"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted pointer-events-none">
          {unit}
        </span>
      </div>
      {help && <p className="text-[10px] text-ink-muted mt-1.5">{help}</p>}
    </div>
  )
}
