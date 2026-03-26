"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Input, Select, Textarea, Card } from "@/components/ui"

export default function MeldenPage() {
  const router = useRouter()
  const [form, setForm] = useState({ titel: "", beschreibung: "", wohnung: "", prioritaet: "normal" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    if (!form.titel) { setError("Bitte kurz beschreiben was passiert ist"); return }
    setLoading(true); setError("")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data, error } = await supabase.from("tickets").insert({
      titel: form.titel, beschreibung: form.beschreibung,
      wohnung: form.wohnung, prioritaet: form.prioritaet,
      status: "offen", vergabemodus: "direkt", erstellt_von: user.id,
    }).select().single()

    if (error) { setError("Fehler: " + error.message); setLoading(false); return }
    router.push(`/ticket/${data.id}`)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 mb-3">â ZurÃ¼ck</button>
        <h1 className="text-xl font-medium">Schaden melden</h1>
        <p className="text-sm text-gray-500 mt-0.5">Deine Verwaltung wird sofort benachrichtigt</p>
      </div>

      <Card>
        <div className="flex flex-col gap-4">
          <Select label="Was ist passiert?" value={form.titel} onChange={e => set("titel", e.target.value)}>
            <option value="">Bitte wÃ¤hlen...</option>
            <option value="Heizung / Warmwasser ausgefallen">Heizung / Warmwasser ausgefallen</option>
            <option value="Wasserschaden / Feuchtigkeit">Wasserschaden / Feuchtigkeit</option>
            <option value="Elektroproblem">Elektroproblem</option>
            <option value="TÃ¼r / Fenster defekt">TÃ¼r / Fenster defekt</option>
            <option value="Schimmel entdeckt">Schimmel entdeckt</option>
            <option value="Sonstiger Schaden">Sonstiger Schaden</option>
          </Select>
          <Textarea label="Beschreibung" placeholder="Was genau ist passiert? Wann ist es aufgetreten?"
            value={form.beschreibung} onChange={e => set("beschreibung", e.target.value)} />
          <Input label="Wohnung / Raum" placeholder="z.B. KÃ¼che, Bad, Whg. 3"
            value={form.wohnung} onChange={e => set("wohnung", e.target.value)} />
          <Select label="Dringlichkeit" value={form.prioritaet} onChange={e => set("prioritaet", e.target.value)}>
            <option value="normal">Normal</option>
            <option value="hoch">Hoch â bitte bald</option>
            <option value="dringend">Dringend â kein Wasser / Heizung</option>
          </Select>

          {form.prioritaet === "dringend" && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-xs text-red-700">
              Bei akuten NotfÃ¤llen (Wasserrohrbruch, Gasleck) ruf bitte sofort deinen Notdienst an.
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={loading || !form.titel}>
              {loading ? "Wird gesendet..." : "Meldung absenden"}
            </Button>
            <Button variant="ghost" onClick={() => router.back()}>Abbrechen</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
