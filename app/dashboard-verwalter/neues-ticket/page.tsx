"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Input, Select, Textarea, Card } from "@/components/ui"

export default function NeuesTicketPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    titel: "", beschreibung: "", wohnung: "",
    prioritaet: "normal", vergabemodus: "auktion",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleCreate() {
    if (!form.titel) { setError("Bitte Titel eingeben"); return }
    setLoading(true); setError("")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const auktion_ende = form.vergabemodus === "auktion"
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null

    const { data, error } = await supabase.from("tickets").insert({
      titel: form.titel, beschreibung: form.beschreibung,
      wohnung: form.wohnung, prioritaet: form.prioritaet,
      vergabemodus: form.vergabemodus,
      status: form.vergabemodus === "auktion" ? "auktion" : "offen",
      erstellt_von: user.id, auktion_ende,
    }).select().single()

    if (error) { setError("Fehler beim Erstellen: " + error.message); setLoading(false); return }
    router.push(`/ticket/${data.id}`)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1">
          â ZurÃ¼ck
        </button>
        <h1 className="text-xl font-medium">Neues Ticket erstellen</h1>
        <p className="text-sm text-gray-500 mt-0.5">Schaden melden und Handwerker beauftragen</p>
      </div>

      <Card>
        <div className="flex flex-col gap-4">
          <Input label="Titel / Schadensbeschreibung *" placeholder="z.B. Heizung ausgefallen"
            value={form.titel} onChange={e => set("titel", e.target.value)} />
          <Textarea label="Detailbeschreibung" placeholder="Was genau ist passiert? Wann ist es aufgetreten?"
            value={form.beschreibung} onChange={e => set("beschreibung", e.target.value)} />
          <Input label="Wohnung / Bereich" placeholder="z.B. Whg. 3 oder Treppenhaus"
            value={form.wohnung} onChange={e => set("wohnung", e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="PrioritÃ¤t" value={form.prioritaet} onChange={e => set("prioritaet", e.target.value)}>
              <option value="normal">Normal</option>
              <option value="hoch">Hoch</option>
              <option value="dringend">Dringend</option>
            </Select>
            <Select label="Vergabemodus" value={form.vergabemodus} onChange={e => set("vergabemodus", e.target.value)}>
              <option value="auktion">Auktion (24h)</option>
              <option value="direkt">Direkt vergeben</option>
            </Select>
          </div>

          {form.vergabemodus === "auktion" && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700">
              Handwerker kÃ¶nnen 24 Stunden lang Angebote einreichen. Du wÃ¤hlst danach das beste aus.
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? "Wird erstellt..." : "Ticket erstellen"}
            </Button>
            <Button variant="ghost" onClick={() => router.back()}>Abbrechen</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
