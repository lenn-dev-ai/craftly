"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile } from "@/types"
import { Button, Input, Select, Card, Avatar, LoadingSpinner } from "@/components/ui"

export default function ProfilPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [form, setForm] = useState({ name: "", firma: "", gewerk: "", plz_bereich: "", telefon: "" })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      if (data) {
        setProfile(data)
        setForm({ name: data.name || "", firma: data.firma || "", gewerk: data.gewerk || "", plz_bereich: data.plz_bereich || "", telefon: data.telefon || "" })
      }
    }
    load()
  }, [router])

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from("profiles").update(form).eq("id", user.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!profile) return <LoadingSpinner />

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-medium">Mein Profil</h1>
        <p className="text-sm text-gray-500 mt-0.5">Angaben für Hausverwaltungen sichtbar</p>
      </div>

      <Card className="mb-4">
        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
          <Avatar name={profile.firma || profile.name} size="lg" />
          <div>
            <div className="font-medium">{profile.firma || profile.name}</div>
            <div className="text-sm text-gray-500">{profile.email}</div>
            <div className="text-xs text-amber-600 mt-0.5">
              {profile.bewertung_avg ? `★ ${profile.bewertung_avg} · ${profile.auftraege_anzahl} Aufträge` : "Noch keine Bewertungen"}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Input label="Vollständiger Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Firmenname" value={form.firma} onChange={e => setForm(f => ({ ...f, firma: e.target.value }))} />
          <Input label="Gewerk / Spezialisierung" placeholder="z.B. Heizung, Sanitär, Klimaanlagen"
            value={form.gewerk} onChange={e => setForm(f => ({ ...f, gewerk: e.target.value }))} />
          <Input label="PLZ-Einzugsgebiet" placeholder="z.B. 60xxx, 65xxx, 63xxx"
            value={form.plz_bereich} onChange={e => setForm(f => ({ ...f, plz_bereich: e.target.value }))} />
          <Input label="Telefon" type="tel" placeholder="+49 69 ..."
            value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving}>{saving ? "Speichert..." : "Profil speichern"}</Button>
            {saved && <span className="text-xs text-[#1D9E75]">✓ Gespeichert</span>}
          </div>
        </div>
      </Card>
    </div>
  )
}
