"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Input, Select, Card } from "@/components/ui"
import { Rolle } from "@/types"

export default function RegistrierungPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", password: "", rolle: "verwalter" as Rolle, firma: "", gewerk: "", plz_bereich: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleRegister() {
    setLoading(true); setError("")
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (error || !data.user) { setError(error?.message || "Fehler bei Registrierung"); setLoading(false); return }

    await supabase.from("profiles").insert({
      id: data.user.id, email: form.email, name: form.name,
      rolle: form.rolle, firma: form.firma, gewerk: form.gewerk, plz_bereich: form.plz_bereich,
    })

    if (form.rolle === "verwalter") router.push("/dashboard-verwalter")
    else if (form.rolle === "handwerker") router.push("/dashboard-handwerker")
    else router.push("/dashboard-mieter")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="logo text-3xl mb-2">Craft<span className="text-[#1D9E75]">ly</span></div>
          <p className="text-sm text-gray-500">Konto erstellen</p>
        </div>
        <Card>
          <div className="flex flex-col gap-4">
            <Select label="Ich bin..." value={form.rolle} onChange={e => set("rolle", e.target.value)}>
              <option value="verwalter">Hausverwaltung</option>
              <option value="handwerker">Handwerksbetrieb</option>
              <option value="mieter">Mieter</option>
            </Select>
            <Input label="Vollständiger Name" placeholder="Max Mustermann" value={form.name} onChange={e => set("name", e.target.value)} />
            <Input label="E-Mail" type="email" placeholder="name@firma.de" value={form.email} onChange={e => set("email", e.target.value)} />
            <Input label="Passwort" type="password" placeholder="Mindestens 8 Zeichen" value={form.password} onChange={e => set("password", e.target.value)} />
            {form.rolle === "handwerker" && <>
              <Input label="Firmenname" placeholder="Klimatec GmbH" value={form.firma} onChange={e => set("firma", e.target.value)} />
              <Input label="Gewerk / Spezialisierung" placeholder="Heizung, Sanitär" value={form.gewerk} onChange={e => set("gewerk", e.target.value)} />
              <Input label="PLZ-Einzugsgebiet" placeholder="60xxx, 65xxx" value={form.plz_bereich} onChange={e => set("plz_bereich", e.target.value)} />
            </>}
            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <Button onClick={handleRegister} disabled={loading} className="w-full justify-center">
              {loading ? "Wird erstellt..." : "Konto erstellen"}
            </Button>
            <p className="text-center text-xs text-gray-500">
              Bereits registriert?{" "}
              <a href="/login" className="text-[#1D9E75] hover:underline">Einloggen</a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
