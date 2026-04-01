"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { UserProfile } from "@/types"

function kiProfilScore(form: any): { score: number; tipps: string[] } {
  let score = 0
  const tipps: string[] = []
  if (form.name) score += 20; else tipps.push("Name hinzufuegen")
  if (form.firma) score += 20; else tipps.push("Firmenname macht professionellen Eindruck")
  if (form.gewerk) score += 25; else tipps.push("Gewerk angeben fuer besseres Matching")
  if (form.plz_bereich) score += 20; else tipps.push("PLZ-Bereich fuer regionale Auftraege")
  if (form.telefon) score += 15; else tipps.push("Telefon erleichtert Kontaktaufnahme")
  return { score, tipps }
}

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

  if (!profile) return (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
      <div className="w-8 h-8 border-2 border-[#00D4AA]/30 border-t-[#00D4AA] rounded-full animate-spin" />
    </div>
  )

  const { score, tipps } = kiProfilScore(form)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-2xl mx-auto p-6">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Mein Profil</h1>
          <p className="text-white/40 text-sm mt-1">Angaben fuer Hausverwaltungen sichtbar</p>
        </div>

        {/* Profile Card */}
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#00D4AA] to-[#00B4D8] flex items-center justify-center text-black font-bold text-lg">
              {(profile.firma || profile.name || "H").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-medium text-lg">{profile.firma || profile.name}</div>
              <div className="text-sm text-white/40">{profile.email}</div>
              <div className="text-xs text-[#00D4AA] mt-0.5">
                {profile.bewertung_avg ? (profile.bewertung_avg + "/5 Sterne | " + (profile.auftraege_anzahl || 0) + " Auftraege") : "Noch keine Bewertungen"}
              </div>
            </div>
          </div>

          {/* KI Profil-Score */}
          <div className="bg-[#0a0a0f] rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">KI Profil-Score</div>
              <div className="text-sm font-semibold" style={{ color: score >= 80 ? "#00D4AA" : score >= 50 ? "#F59E0B" : "#EF4444" }}>
                {score}%
              </div>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: score + "%",
                  backgroundColor: score >= 80 ? "#00D4AA" : score >= 50 ? "#F59E0B" : "#EF4444"
                }} />
            </div>
            {tipps.length > 0 && (
              <div className="text-xs text-white/40">
                Tipp: {tipps[0]}
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="flex flex-col gap-4">
            {[
              { key: "name", label: "Vollstaendiger Name", placeholder: "Max Mustermann", type: "text" },
              { key: "firma", label: "Firmenname", placeholder: "Mustermann GmbH", type: "text" },
              { key: "gewerk", label: "Gewerk / Spezialisierung", placeholder: "z.B. Heizung, Sanitaer, Klimaanlagen", type: "text" },
              { key: "plz_bereich", label: "PLZ-Einzugsgebiet", placeholder: "z.B. 60xxx, 65xxx, 63xxx", type: "text" },
              { key: "telefon", label: "Telefon", placeholder: "+49 69 ...", type: "tel" },
            ].map(field => (
              <div key={field.key}>
                <label className="text-xs text-white/50 mb-1.5 block">{field.label}</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={(form as any)[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/20 transition-colors"
                />
              </div>
            ))}

            <div className="flex items-center gap-3 mt-2">
              <button onClick={save} disabled={saving}
                className={"px-5 py-2.5 rounded-lg text-sm font-medium transition-all " +
                  (saving
                    ? "bg-white/10 text-white/40 cursor-not-allowed"
                    : "bg-[#00D4AA] text-black hover:bg-[#00D4AA]/90")}>
                {saving ? "Speichert..." : "Profil speichern"}
              </button>
              {saved && (
                <span className="text-xs text-[#00D4AA] bg-[#00D4AA]/10 px-3 py-1 rounded-full">
                  Gespeichert
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KI Tipps Card */}
        {tipps.length > 0 && (
          <div className="bg-gradient-to-r from-[#00D4AA]/10 to-[#00B4D8]/10 border border-[#00D4AA]/20 rounded-xl p-4">
            <div className="text-sm font-medium text-[#00D4AA] mb-2">KI-Empfehlungen fuer dein Profil</div>
            <div className="flex flex-col gap-1.5">
              {tipps.map((tipp, i) => (
                <div key={i} className="text-xs text-white/50 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-[#00D4AA] flex-shrink-0" />
                  {tipp}
                </div>
              ))}
            </div>
            <div className="text-[10px] text-white/30 mt-2">
              Ein vollstaendiges Profil erhoet deine Sichtbarkeit um bis zu 40%
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
