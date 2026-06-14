"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import AddressAutocomplete from "@/components/AddressAutocomplete"
import { Button } from "@/components/ui"
import { useToast } from "@/components/Toast"
import { UserCircle, MapPin, Mail, Phone } from "lucide-react"

// F3: Mieter-Profil — Stammdaten plus "Meine Wohnung" hinterlegen, damit
// der Schaden-melden-Wizard die Adresse beim nächsten Mal mit einem Klick
// vorausfüllen kann. profiles.adresse + lat + lng existieren bereits;
// hier ist die Edit-Surface.

interface MieterProfil {
  id: string
  email: string | null
  name: string | null
  telefon: string | null
  adresse: string | null
  lat: number | null
  lng: number | null
}

export default function MieterProfilPage() {
  const router = useRouter()
  const toast = useToast()
  const [profil, setProfil] = useState<MieterProfil | null>(null)
  const [name, setName] = useState("")
  const [telefon, setTelefon] = useState("")
  const [adresse, setAdresse] = useState("")
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, name, telefon, adresse, lat, lng")
      .eq("id", user.id)
      .maybeSingle<MieterProfil>()
    if (error) {
      toast.show("Profil konnte nicht geladen werden: " + error.message, "error")
    } else if (data) {
      setProfil(data)
      setName(data.name ?? "")
      setTelefon(data.telefon ?? "")
      setAdresse(data.adresse ?? "")
      setLat(data.lat)
      setLng(data.lng)
    }
    setLoading(false)
  }, [router, toast])

  useEffect(() => { void load() }, [load])

  async function speichern() {
    if (!profil) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({
        name: name.trim() || null,
        telefon: telefon.trim() || null,
        adresse: adresse.trim() || null,
        lat,
        lng,
      })
      .eq("id", profil.id)
    setSaving(false)
    if (error) {
      toast.show("Speichern fehlgeschlagen: " + error.message, "error")
      return
    }
    toast.show("Profil gespeichert.", "success")
    await load()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent/20 border-t-[#3D8B7A] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-2xl mx-auto pl-14 pr-4 py-4 md:p-6 space-y-5">
        <header className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rolle-mieter/15 flex items-center justify-center">
            <UserCircle size={22} className="text-rolle-mieter" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">Mein Profil</h1>
            <p className="text-xs text-ink-muted">{profil?.email ?? "—"}</p>
          </div>
        </header>

        {/* Wohnung */}
        <section className="bg-white border border-line rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-rolle-mieter" />
            <h2 className="text-sm font-semibold text-ink">Meine Wohnung</h2>
          </div>
          <p className="text-xs text-ink-muted">
            Adresse wird bei jeder Schadens-Meldung automatisch vorausgefüllt.
          </p>
          <AddressAutocomplete
            label="Adresse"
            placeholder="Straße, Hausnummer, Ort"
            initialAdresse={adresse}
            onSelect={({ adresse: a, lat: la, lng: ln }) => {
              setAdresse(a)
              setLat(la)
              setLng(ln)
            }}
          />
          {adresse && (
            <div className="text-[11px] text-ink-muted">
              Aktuell gespeichert: {adresse}
            </div>
          )}
        </section>

        {/* Kontakt */}
        <section className="bg-white border border-line rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-ink">Kontakt</h2>
          <div>
            <label className="block text-[11px] font-medium text-ink-muted mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Vor- und Nachname"
              className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-accent/40"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-ink-muted mb-1 flex items-center gap-1.5">
              <Mail size={11} /> E-Mail
            </label>
            <input
              value={profil?.email ?? ""}
              readOnly
              className="w-full bg-surface-muted border border-line rounded-xl px-3 py-2.5 text-sm text-ink-muted cursor-not-allowed"
            />
            <p className="text-[10px] text-ink-muted mt-1">
              Mail ändern geht aktuell nur über den Reparo-Support.
            </p>
          </div>
          <div>
            <label className="text-[11px] font-medium text-ink-muted mb-1 flex items-center gap-1.5">
              <Phone size={11} /> Telefon <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              value={telefon}
              onChange={e => setTelefon(e.target.value)}
              placeholder="+49 …"
              className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-accent/40"
            />
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={speichern} disabled={saving}>
            {saving ? "Speichert …" : "Speichern"}
          </Button>
        </div>
      </div>
    </div>
  )
}
