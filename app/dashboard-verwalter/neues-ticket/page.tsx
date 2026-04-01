"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Input, Select, Textarea, Card } from "@/components/ui"
import { GEWERK_LABELS, UserProfile } from "@/types"
import { berechnePreisfaktor, berechneRichtpreis } from "@/lib/preisfaktor"

type VergabeModus = "sofort" | "auktion" | "plan"

const VERGABE_MODI: { id: VergabeModus; label: string; icon: string; desc: string; zeit: string; color: string }[] = [
  { id: "sofort", label: "Sofort-Vergabe", icon: "!", desc: "Notfall — schnellster verfügbarer Handwerker wird automatisch zugewiesen", zeit: "< 4 Stunden", color: "#FF6363" },
  { id: "auktion", label: "Smart-Auktion", icon: "#", desc: "Handwerker bieten mit Preis + Termin — bestes Gesamtpaket gewinnt", zeit: "24–48 Stunden", color: "#00D4AA" },
  { id: "plan", label: "Planauftrag", icon: "~", desc: "Für geplante Wartung — Handwerker bieten auf Wochenzeiträume", zeit: "1–2 Wochen", color: "#00B4D8" },
]

export default function NeuesTicketPage() {
  const router = useRouter()
  const [modus, setModus] = useState<VergabeModus>("auktion")
  const [form, setForm] = useState({
    titel: "", beschreibung: "", wohnung: "",
    prioritaet: "normal", gewerk: "allgemein",
    auktionsDauer: "48", planWoche: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [hwCount, setHwCount] = useState(0)
  const [hwPreview, setHwPreview] = useState<Partial<UserProfile>[]>([])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    async function checkSupply() {
      const supabase = createClient()
      let query = supabase.from("profiles")
        .select("id, name, firma, gewerk, bewertung_avg, basis_preis, auftraege_anzahl")
        .eq("rolle", "handwerker")
      if (form.gewerk !== "allgemein") query = query.eq("gewerk", form.gewerk)
      const { data } = await query.order("bewertung_avg", { ascending: false }).limit(10)
      setHwPreview(data || [])
      setHwCount(data?.length || 0)
    }
    checkSupply()
  }, [form.gewerk])

  useEffect(() => {
    if (modus === "sofort") set("prioritaet", "dringend")
    else if (modus === "plan") set("prioritaet", "normal")
  }, [modus])

  const pf = berechnePreisfaktor(
    (modus === "sofort" ? "dringend" : form.prioritaet) as "normal" | "hoch" | "dringend",
    hwCount
  )

  async function handleCreate() {
    if (!form.titel) { setError("Bitte Titel eingeben"); return }
    setLoading(true); setError("")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    const auktionEnde = new Date()
    if (modus === "sofort") auktionEnde.setHours(auktionEnde.getHours() + 4)
    else if (modus === "auktion") auktionEnde.setHours(auktionEnde.getHours() + parseInt(form.auktionsDauer))
    else auktionEnde.setDate(auktionEnde.getDate() + 14)

    const { data, error: insertErr } = await supabase.from("tickets").insert({
      titel: form.titel, beschreibung: form.beschreibung, wohnung: form.wohnung,
      prioritaet: modus === "sofort" ? "dringend" : form.prioritaet,
      gewerk: form.gewerk, vergabemodus: modus,
      status: modus === "sofort" ? "sofort" : "offen",
      erstellt_von: user.id,
    }).select().single()

    if (insertErr) { setError("Fehler: " + insertErr.message); setLoading(false); return }
    if (modus === "sofort") {
      router.push(`/ticket/${data.id}`)
    } else {
      router.push(`/dashboard-verwalter/tickets/${data.id}/handwerker`)
    }
  }

  const aktiverModus = VERGABE_MODI.find(m => m.id === modus)!

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-[#00D4AA] mb-3 flex items-center gap-1 transition-colors">
          &#8592; Zurück
        </button>
        <h1 className="text-2xl font-bold text-white tracking-tight">Neuer Auftrag</h1>
        <p className="text-sm text-gray-500 mt-1">Schaden melden und Vergabemodus wählen</p>
      </div>

      {/* Vergabe-Modus Auswahl */}
      <div className="mb-6">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Vergabemodus</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {VERGABE_MODI.map(m => (
            <button key={m.id} onClick={() => setModus(m.id)}
              className={`relative p-4 rounded-2xl border-2 transition-all text-left ${
                modus === m.id
                  ? "border-[" + m.color + "] bg-[" + m.color + "]/5"
                  : "border-white/[0.08] bg-[#12121a] hover:border-white/[0.15]"
              }`}
              style={modus === m.id ? { borderColor: m.color, background: m.color + "08" } : {}}>
              <div className="text-2xl mb-2" style={{ color: modus === m.id ? m.color : "#666" }}>{m.icon}</div>
              <div className={`text-sm font-semibold mb-1 ${modus === m.id ? "text-white" : "text-gray-400"}`}>
                {m.label}
              </div>
              <div className="text-[11px] text-gray-500 leading-relaxed">{m.desc}</div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: m.color }}>{m.zeit}</div>
              {modus === m.id && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: m.color }}>
                  <span className="text-white text-xs">&#10003;</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Auftragsdetails */}
      <Card className="mb-4">
        <h2 className="text-sm font-semibold text-white mb-4">Auftragsdetails</h2>
        <div className="flex flex-col gap-4">
          <Input label="Titel / Schadensbeschreibung *"
            placeholder={modus === "sofort" ? "z.B. Wasserrohrbruch Keller" : modus === "plan" ? "z.B. Jährliche Heizungswartung" : "z.B. Heizung ausgefallen"}
            value={form.titel} onChange={e => set("titel", e.target.value)} />
          <Textarea label="Detailbeschreibung" placeholder="Was genau ist passiert? Wo befindet sich der Schaden?"
            value={form.beschreibung} onChange={e => set("beschreibung", e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Wohnung / Bereich" placeholder="z.B. Whg. 3"
              value={form.wohnung} onChange={e => set("wohnung", e.target.value)} />
            <Select label="Gewerk *" value={form.gewerk} onChange={e => set("gewerk", e.target.value)}>
              {Object.entries(GEWERK_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          {modus === "auktion" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select label="Dringlichkeit" value={form.prioritaet} onChange={e => set("prioritaet", e.target.value)}>
                <option value="normal">Normal (7 Tage)</option>
                <option value="hoch">Hoch (2–3 Tage)</option>
                <option value="dringend">Dringend (heute/morgen)</option>
              </Select>
              <Select label="Auktionsdauer" value={form.auktionsDauer} onChange={e => set("auktionsDauer", e.target.value)}>
                <option value="24">24 Stunden</option>
                <option value="48">48 Stunden (empfohlen)</option>
                <option value="72">72 Stunden</option>
              </Select>
            </div>
          )}
        </div>
      </Card>

      {/* Modus-Info + Marktpreis */}
      <Card className="mb-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: aktiverModus.color + "15", color: aktiverModus.color }}>
            {aktiverModus.icon}
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-white mb-1">
              {modus === "sofort" ? "So funktioniert die Sofort-Vergabe" :
               modus === "auktion" ? "So funktioniert die Smart-Auktion" :
               "So funktioniert der Planauftrag"}
            </h2>
            {modus === "sofort" && (
              <div className="text-xs text-gray-400 space-y-1.5">
                <p>1. Ihr Auftrag wird sofort an alle verfügbaren Handwerker gesendet</p>
                <p>2. Der erste Handwerker der zusagt, erhält den Auftrag</p>
                <p>3. Preis wird zum Sofort-Tarif berechnet (Faktor {pf.faktor}x)</p>
                <p className="text-[#FF6363] font-medium mt-2">Erwartete Reaktionszeit: unter 4 Stunden</p>
              </div>
            )}
            {modus === "auktion" && (
              <div className="text-xs text-gray-400 space-y-1.5">
                <p>1. Handwerker sehen Ihren Auftrag und bieten mit Preis + frühestem Termin</p>
                <p>2. Jedes Angebot erhält einen Value-Score aus Preis, Verfügbarkeit und Bewertung</p>
                <p>3. Sie sehen die Top-Angebote im Ranking und wählen das beste Paket</p>
                <p className="text-[#00D4AA] font-medium mt-2">Typisch 3–5 Angebote innerhalb von {form.auktionsDauer}h</p>
              </div>
            )}
            {modus === "plan" && (
              <div className="text-xs text-gray-400 space-y-1.5">
                <p>1. Handwerker bieten auf Ihren Wunschzeitraum mit reduziertem Preis</p>
                <p>2. Planbare Aufträge sind günstiger da Handwerker ihre Kapazität besser planen</p>
                <p>3. Ideal für Wartung, Renovierung und nicht-dringende Reparaturen</p>
                <p className="text-[#00B4D8] font-medium mt-2">Typisch 15–25% günstiger als Smart-Auktion</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Marktlage</span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${pf.color}`}>{pf.label}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-white">{hwCount}</div>
              <div className="text-[10px] text-gray-500 uppercase">Handwerker</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-white">{pf.faktor}x</div>
              <div className="text-[10px] text-gray-500 uppercase">Preisfaktor</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
              <div className="text-lg font-bold text-white">{aktiverModus.zeit}</div>
              <div className="text-[10px] text-gray-500 uppercase">Zeitrahmen</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Handwerker-Preview */}
      {hwPreview.length > 0 && modus !== "sofort" && (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">
            Verfügbare Handwerker ({hwPreview.length})
          </h2>
          <div className="flex flex-col gap-2">
            {hwPreview.slice(0, 4).map(hw => {
              const richtpreis = berechneRichtpreis(hw.basis_preis || 50, pf.faktor)
              return (
                <div key={hw.id} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: "linear-gradient(135deg, #00D4AA, #00B4D8)", color: "#fff" }}>
                      {(hw.firma || hw.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{hw.firma || hw.name}</div>
                      <div className="text-[11px] text-gray-500">
                        {hw.bewertung_avg ? `Bewertung ${hw.bewertung_avg}` : "Neu"} – {hw.auftraege_anzahl || 0} Aufträge
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[#00D4AA]">~ {richtpreis} EUR</div>
                    <div className="text-[10px] text-gray-500">Richtpreis</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl mb-4">{error}</div>
      )}

      <div className="flex gap-3">
        <Button onClick={handleCreate} disabled={loading}>
          {loading ? "Wird erstellt..." : modus === "sofort" ? "Sofort-Auftrag senden" : modus === "auktion" ? "Auktion starten" : "Planauftrag erstellen"}
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>Abbrechen</Button>
      </div>
    </div>
  )
}
