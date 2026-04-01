"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { Button, Input, Select, Card } from "@/components/ui"
import { Rolle } from "@/types"

export default function RegistrierungPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    rolle: "verwalter" as Rolle,
    firma: "",
    gewerk: "",
    plz_bereich: ""
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleRegister() {
    if (!form.name.trim()) { setError("Bitte Name eingeben."); return }
    if (!form.email.trim()) { setError("Bitte E-Mail eingeben."); return }
    if (form.password.length < 8) { setError("Passwort muss mindestens 8 Zeichen lang sein."); return }
    setLoading(true); setError("")
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (error || !data.user) { setError(error?.message || "Fehler bei Registrierung"); setLoading(false); return }
    await supabase.from("profiles").insert({
      id: data.user.id,
      email: form.email,
      name: form.name,
      rolle: form.rolle,
      firma: form.firma,
      gewerk: form.gewerk,
      plz_bereich: form.plz_bereich,
    })
    if (form.rolle === "verwalter") window.location.href = "/dashboard-verwalter"
    else if (form.rolle === "handwerker") window.location.href = "/dashboard-handwerker"
    else window.location.href = "/dashboard-mieter"
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#00D4AA]/[0.07] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#00B4D8]/[0.05] rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="logo text-3xl mb-2">
            <span className="text-white">Craft</span>
            <span className="gradient-text">ly</span>
          </div>
          <p className="text-sm text-gray-500">Konto erstellen</p>
        </div>

        <Card>
          <div className="flex flex-col gap-4">
            <Select label="Ich bin..." value={form.rolle} onChange={e => set("rolle", e.target.value)}>
              <option value="verwalter">Hausverwaltung</option>
              <option value="handwerker">Handwerksbetrieb</option>
              <option value="mieter">Mieter</option>
            </Select>

            <Input label="Vollständiger Name" placeholder="Max Mustermann"
              value={form.name} onChange={e => set("name", e.target.value)} />
            <Input label="E-Mail" type="email" placeholder="name@firma.de"
              value={form.email} onChange={e => set("email", e.target.value)} />
            <Input label="Passwort" type="password" placeholder="Mindestens 8 Zeichen"
              value={form.password} onChange={e => set("password", e.target.value)} />

            {form.rolle === "handwerker" && <>
              <Input label="Firmenname" placeholder="Klimatec GmbH"
                value={form.firma} onChange={e => set("firma", e.target.value)} />
              <Input label="Gewerk / Spezialisierung" placeholder="Heizung, Sanitär"
                value={form.gewerk} onChange={e => set("gewerk", e.target.value)} />
              <Input label="PLZ-Einzugsgebiet" placeholder="60xxx, 65xxx"
                value={form.plz_bereich} onChange={e => set("plz_bereich", e.target.value)} />
            </>}

            {error && (
              <p className="text-xs text-[#FF6363] bg-[#FF6363]/10 border border-[#FF6363]/20 px-4 py-2.5 rounded-xl font-medium">
                {error}
              </p>
            )}

            <Button onClick={handleRegister} disabled={loading} className="w-full justify-center">
              {loading ? "Wird erstellt..." : "Konto erstellen"}
            </Button>

            <p className="text-center text-xs text-gray-600">
              Bereits registriert?{" "}
              <a href="/login" className="text-[#00D4AA] hover:text-[#00B4D8] font-medium transition-colors">Einloggen</a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
