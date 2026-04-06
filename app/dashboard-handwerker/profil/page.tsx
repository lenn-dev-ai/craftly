"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile } from "@/types"

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
        setForm({
          name: data.name || "",
          firma: data.firma || "",
          gewerk: data.gewerk || "",
          plz_bereich: data.plz_bereich || "",
          telefon: data.telefon || "",
        })
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
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!profile) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#3D8B7A]/30 border-t-[#3D8B7A] rounded-full animate-spin" />
        <span className="text-sm text-[#8C857B]">Lädt...</span>
      </div>
    </div>
  )

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto pt-16 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2D2A26]">Mein Profil</h1>
        <p className="text-sm text-[#8C857B] mt-1">Angaben für Hausverwaltungen sichtbar</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#EDE8E1] p-6">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[#EDE8E1]">
          <div className="w-14 h-14 rounded-2xl bg-[#3D8B7A]/10 flex items-center justify-center text-[#3D8B7A] text-xl font-bold">
            {(profile.firma || profile.name || "H").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-[#2D2A26]">{profile.firma || profile.name}</div>
            <div className="text-sm text-[#8C857B]">{profile.email}</div>
            <div className="text-xs mt-1">
              {profile.bewertung_avg ? (
                <span className="text-[#C4956A]">★ {profile.bewertung_avg} · {profile.auftraege_anzahl} Aufträge</span>
              ) : (
                <span className="text-[#8C857B]">Noch keine Bewertungen</span>
              )}
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-[#8C857B] mb-1.5 block font-medium">Vollständiger Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-[#8C857B] mb-1.5 block font-medium">Firmenname</label>
            <input
              type="text"
              value={form.firma}
              onChange={e => setForm(f => ({ ...f, firma: e.target.value }))}
              className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-[#8C857B] mb-1.5 block font-medium">Gewerk / Spezialisierung</label>
            <input
              type="text"
              value={form.gewerk}
              onChange={e => setForm(f => ({ ...f, gewerk: e.target.value }))}
              placeholder="z.B. Heizung, Sanitär, Klimaanlagen"
              className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#8C857B]/60 focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-[#8C857B] mb-1.5 block font-medium">PLZ-Einzugsgebiet</label>
            <input
              type="text"
              value={form.plz_bereich}
              onChange={e => setForm(f => ({ ...f, plz_bereich: e.target.value }))}
              placeholder="z.B. 60xxx, 65xxx, 63xxx"
              className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#8C857B]/60 focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-[#8C857B] mb-1.5 block font-medium">Telefon</label>
            <input
              type="tel"
              value={form.telefon}
              onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))}
              placeholder="+49 69 ..."
              className="w-full bg-[#FAF8F5] border border-[#EDE8E1] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#8C857B]/60 focus:border-[#3D8B7A]/40 focus:outline-none focus:ring-1 focus:ring-[#3D8B7A]/20 transition-colors"
            />
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={save}
              disabled={saving}
              className="text-sm font-bold bg-[#3D8B7A] text-white px-6 py-2.5 rounded-xl hover:bg-[#2D7A6A] transition-colors disabled:opacity-50"
            >
              {saving ? "Speichert..." : "Profil speichern"}
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
