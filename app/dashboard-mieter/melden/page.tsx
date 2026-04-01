"use client"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Card } from "@/components/ui"

type Step = "foto" | "analyse" | "details" | "ort" | "dringlichkeit" | "zusammenfassung" | "gesendet"

const KI_ANALYSEN: Record<string, { titel: string; gewerk: string; dringlichkeit: string; tipp: string; zeit: string }> = {
  heizung: { titel: "Heizung / Warmwasser ausgefallen", gewerk: "heizung_sanitaer", dringlichkeit: "hoch", tipp: "Pruefen Sie ob der Thermostat auf mind. Stufe 3 steht und ob andere Heizkoerper betroffen sind.", zeit: "~24h" },
  wasser: { titel: "Wasserschaden / Feuchtigkeit", gewerk: "heizung_sanitaer", dringlichkeit: "dringend", tipp: "Hauptwasserhahn zudrehen falls moeglich! Handtuecher unterlegen um Ausbreitung zu verhindern.", zeit: "~4h" },
  elektro: { titel: "Elektroproblem", gewerk: "elektro", dringlichkeit: "hoch", tipp: "Beruehren Sie keine freiliegenden Kabel. Schalten Sie die betroffene Sicherung aus.", zeit: "~12h" },
  tuer: { titel: "Tuer / Fenster defekt", gewerk: "schreiner", dringlichkeit: "normal", tipp: "Sichern Sie die Stelle provisorisch ab, besonders bei Zugluft oder Einbruchgefahr.", zeit: "~3 Tage" },
  schimmel: { titel: "Schimmel entdeckt", gewerk: "maler", dringlichkeit: "hoch", tipp: "Gut lueften! Nicht selbst mit Bleiche behandeln - das verschlimmert es oft.", zeit: "~5 Tage" },
  sonstiges: { titel: "Sonstiger Schaden", gewerk: "allgemein", dringlichkeit: "normal", tipp: "Je genauer die Beschreibung, desto schneller die Loesung.", zeit: "~3-5 Tage" },
}

function analyseText(text: string): string {
  const lower = text.toLowerCase()
  if (lower.match(/heiz|warm.?wasser|thermostat|radiator|kalt.*(wohnung|zimmer)/)) return "heizung"
  if (lower.match(/wasser|feucht|tropf|nass|rohr|leck|ueber.?schwemm/)) return "wasser"
  if (lower.match(/strom|elektr|sicher|steck|licht|flacker|kurz.?schluss/)) return "elektro"
  if (lower.match(/tuer|fenster|schloss|klinke|scharnier|glas|zerbroch/)) return "tuer"
  if (lower.match(/schimmel|schwarz.*fleck|pilz|feucht.*wand|stock.?fleck/)) return "schimmel"
  return "sonstiges"
}

export default function MeldenPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("foto")
  const [beschreibung, setBeschreibung] = useState("")
  const [kiResult, setKiResult] = useState<string | null>(null)
  const [form, setForm] = useState({ titel: "", beschreibung: "", wohnung: "", prioritaet: "normal", gewerk: "allgemein" })
  const [loading, setLoading] = useState(false)
  const [analyseProgress, setAnalyseProgress] = useState(0)
  const [error, setError] = useState("")

  function startAnalyse() {
    if (!beschreibung.trim()) return
    setStep("analyse")
    setAnalyseProgress(0)
    const kategorie = analyseText(beschreibung)
    const analyse = KI_ANALYSEN[kategorie]

    const interval = setInterval(() => {
      setAnalyseProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100 }
        return p + Math.random() * 15 + 5
      })
    }, 200)

    setTimeout(() => {
      clearInterval(interval)
      setAnalyseProgress(100)
      setKiResult(kategorie)
      setForm(f => ({
        ...f,
        titel: analyse.titel,
        beschreibung: beschreibung,
        prioritaet: analyse.dringlichkeit,
        gewerk: analyse.gewerk,
      }))
      setTimeout(() => setStep("details"), 500)
    }, 2000)
  }

  async function handleSubmit() {
    setLoading(true); setError("")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }
    const { error: dbError } = await supabase.from("tickets").insert({
      titel: form.titel,
      beschreibung: form.beschreibung,
      wohnung: form.wohnung,
      prioritaet: form.prioritaet,
      gewerk: form.gewerk,
      status: "offen",
      erstellt_von: user.id,
    })
    if (dbError) { setError("Fehler: " + dbError.message); setLoading(false); return }
    setStep("gesendet")
    setLoading(false)
  }

  const analyse = kiResult ? KI_ANALYSEN[kiResult] : null
  const stepIndex = ["foto", "analyse", "details", "ort", "dringlichkeit", "zusammenfassung", "gesendet"].indexOf(step)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-300">&larr; Zurueck</button>
          <h1 className="text-sm font-medium text-gray-300">Schaden melden</h1>
          <span className="text-xs text-gray-600">{Math.min(stepIndex + 1, 5)}/5</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-0.5 bg-white/5">
        <div className="h-full bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] transition-all duration-700" style={{ width: Math.min((stepIndex + 1) / 5 * 100, 100) + "%" }} />
      </div>

      <div className="max-w-xl mx-auto px-6 py-8">

        {/* STEP 1: Foto + Beschreibung */}
        {step === "foto" && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-[#00D4AA]/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">AI</span>
              </div>
              <h2 className="text-xl font-semibold mb-2">Was ist passiert?</h2>
              <p className="text-sm text-gray-500">Beschreibe den Schaden -- unsere KI erkennt automatisch Kategorie, Gewerk und Dringlichkeit.</p>
            </div>

            {/* Foto Upload Area */}
            <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center mb-6 hover:border-[#00D4AA]/30 transition-colors cursor-pointer">
              <div className="text-3xl mb-2">CAM</div>
              <p className="text-sm text-gray-400">Foto aufnehmen oder hochladen</p>
              <p className="text-xs text-gray-600 mt-1">KI erkennt Schaeden automatisch aus Bildern</p>
            </div>

            {/* Text Beschreibung */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-2">Oder beschreibe den Schaden</label>
              <textarea
                value={beschreibung}
                onChange={e => setBeschreibung(e.target.value)}
                placeholder="z.B. Wasser tropft von der Decke im Bad, der Fleck wird groesser..."
                rows={4}
                className="w-full bg-[#12121a] border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#00D4AA]/50 resize-none"
              />
            </div>

            {/* Quick-Select Buttons */}
            <div className="mb-6">
              <p className="text-xs text-gray-500 mb-2">Oder schnell auswaehlen:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Heizung aus", icon: "!", val: "Heizung funktioniert nicht mehr, Wohnung wird kalt" },
                  { label: "Wasserschaden", icon: "~", val: "Wasser tropft oder laeuft aus, Feuchtigkeit an Wand" },
                  { label: "Strom/Elektrik", icon: "#", val: "Strom ausgefallen oder Steckdose funktioniert nicht" },
                  { label: "Tuer/Fenster", icon: "|", val: "Tuer oder Fenster laesst sich nicht richtig schliessen" },
                  { label: "Schimmel", icon: "o", val: "Schimmelflecken an Wand oder Decke entdeckt" },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => { setBeschreibung(item.val); }}
                    className="text-xs bg-white/5 hover:bg-[#00D4AA]/10 border border-white/10 hover:border-[#00D4AA]/30 rounded-full px-3 py-1.5 transition-all text-gray-400 hover:text-[#00D4AA]"
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={startAnalyse} disabled={!beschreibung.trim()} className="w-full justify-center">
              KI-Analyse starten
            </Button>
          </div>
        )}

        {/* STEP 2: KI Analyse Animation */}
        {step === "analyse" && (
          <div className="animate-fade-in text-center py-16">
            <div className="w-20 h-20 rounded-full bg-[#00D4AA]/10 flex items-center justify-center mx-auto mb-6 animate-pulse">
              <span className="text-2xl">AI</span>
            </div>
            <h2 className="text-lg font-semibold mb-2">KI analysiert deinen Schaden...</h2>
            <p className="text-sm text-gray-500 mb-8">Kategorie, Gewerk und Dringlichkeit werden erkannt</p>
            <div className="w-64 h-2 bg-white/5 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] rounded-full transition-all duration-300" style={{ width: Math.min(analyseProgress, 100) + "%" }} />
            </div>
            <div className="mt-4 space-y-2 text-xs text-gray-500">
              {analyseProgress > 20 && <p className="animate-fade-in">Schadensbeschreibung wird analysiert...</p>}
              {analyseProgress > 50 && <p className="animate-fade-in">Gewerk und Fachgebiet erkannt...</p>}
              {analyseProgress > 80 && <p className="animate-fade-in">Dringlichkeit wird bewertet...</p>}
            </div>
          </div>
        )}

        {/* STEP 3: KI-Ergebnis + Details */}
        {step === "details" && analyse && (
          <div className="animate-fade-in">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-[#00D4AA]/10 border border-[#00D4AA]/20 rounded-full px-4 py-1.5 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#00D4AA]" />
                <span className="text-xs text-[#00D4AA] font-medium">KI-Analyse abgeschlossen</span>
              </div>
              <h2 className="text-lg font-semibold">{analyse.titel}</h2>
            </div>

            {/* KI Insight Card */}
            <Card className="mb-4 bg-[#12121a] border border-white/5">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Dringlichkeit</div>
                  <div className={"text-sm font-semibold " + (form.prioritaet === "dringend" ? "text-red-400" : form.prioritaet === "hoch" ? "text-amber-400" : "text-[#00D4AA]")}>
                    {form.prioritaet === "dringend" ? "DRINGEND" : form.prioritaet === "hoch" ? "HOCH" : "NORMAL"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Geschaetzte Zeit</div>
                  <div className="text-sm font-semibold text-gray-200">{analyse.zeit}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Fachgebiet</div>
                  <div className="text-sm font-semibold text-gray-200">{form.gewerk === "heizung_sanitaer" ? "Sanitaer" : form.gewerk === "elektro" ? "Elektro" : form.gewerk === "schreiner" ? "Schreiner" : form.gewerk === "maler" ? "Maler" : "Allgemein"}</div>
                </div>
              </div>
            </Card>

            {/* KI Tipp */}
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl px-4 py-3 mb-6">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 text-sm mt-0.5">!</span>
                <div>
                  <div className="text-xs font-medium text-amber-400 mb-0.5">KI-Soforttipp</div>
                  <p className="text-xs text-gray-400">{analyse.tipp}</p>
                </div>
              </div>
            </div>

            {/* Beschreibung Review */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-2">Deine Beschreibung</label>
              <textarea
                value={form.beschreibung}
                onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
                rows={3}
                className="w-full bg-[#12121a] border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-[#00D4AA]/50 resize-none"
              />
            </div>

            {/* Dringlichkeit Override */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-400 mb-2">Dringlichkeit anpassen</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: "normal", label: "Normal", sub: "Kein Eile", color: "border-[#00D4AA]/30 bg-[#00D4AA]/5 text-[#00D4AA]" },
                  { val: "hoch", label: "Hoch", sub: "Bitte bald", color: "border-amber-400/30 bg-amber-500/5 text-amber-400" },
                  { val: "dringend", label: "Notfall", sub: "Sofort", color: "border-red-400/30 bg-red-500/5 text-red-400" },
                ].map(d => (
                  <button
                    key={d.val}
                    onClick={() => setForm(f => ({ ...f, prioritaet: d.val }))}
                    className={"rounded-xl p-3 border text-center transition-all " + (form.prioritaet === d.val ? d.color : "border-white/5 bg-white/[0.02] text-gray-500")}
                  >
                    <div className="text-sm font-medium">{d.label}</div>
                    <div className="text-[10px] mt-0.5 opacity-70">{d.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => setStep("ort")} className="w-full justify-center">
              Weiter -- Ort angeben
            </Button>
          </div>
        )}

        {/* STEP 4: Ort */}
        {step === "ort" && (
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold mb-2">Wo ist das Problem?</h2>
            <p className="text-sm text-gray-500 mb-6">Wohnung, Raum oder Bereich angeben</p>

            <div className="mb-4">
              <input
                value={form.wohnung}
                onChange={e => setForm(f => ({ ...f, wohnung: e.target.value }))}
                placeholder="z.B. Whg. 3 OG, Bad"
                className="w-full bg-[#12121a] border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#00D4AA]/50"
              />
            </div>

            <div className="mb-6">
              <p className="text-xs text-gray-500 mb-2">Schnellauswahl:</p>
              <div className="flex flex-wrap gap-2">
                {["Kueche", "Bad", "Wohnzimmer", "Schlafzimmer", "Flur", "Keller", "Balkon"].map(r => (
                  <button
                    key={r}
                    onClick={() => setForm(f => ({ ...f, wohnung: f.wohnung ? f.wohnung + ", " + r : r }))}
                    className="text-xs bg-white/5 hover:bg-[#00D4AA]/10 border border-white/10 hover:border-[#00D4AA]/30 rounded-full px-3 py-1.5 transition-all text-gray-400 hover:text-[#00D4AA]"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => setStep("zusammenfassung")} disabled={!form.wohnung.trim()} className="w-full justify-center">
              Weiter -- Zusammenfassung
            </Button>
          </div>
        )}

        {/* STEP 5: Zusammenfassung */}
        {step === "zusammenfassung" && analyse && (
          <div className="animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold">Meldung pruefen</h2>
              <p className="text-sm text-gray-500">Alles korrekt? Dann ab damit.</p>
            </div>

            <Card className="mb-6 bg-[#12121a] border border-white/5">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-500">Problem</span>
                  <span className="text-sm font-medium text-gray-200 text-right">{form.titel}</span>
                </div>
                <div className="border-t border-white/5" />
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-500">Beschreibung</span>
                  <span className="text-sm text-gray-300 text-right max-w-[65%]">{form.beschreibung}</span>
                </div>
                <div className="border-t border-white/5" />
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Ort</span>
                  <span className="text-sm text-gray-200">{form.wohnung}</span>
                </div>
                <div className="border-t border-white/5" />
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Dringlichkeit</span>
                  <span className={"text-sm font-medium " + (form.prioritaet === "dringend" ? "text-red-400" : form.prioritaet === "hoch" ? "text-amber-400" : "text-[#00D4AA]")}>
                    {form.prioritaet === "dringend" ? "Notfall" : form.prioritaet === "hoch" ? "Hoch" : "Normal"}
                  </span>
                </div>
                <div className="border-t border-white/5" />
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Geschaetzte Bearbeitung</span>
                  <span className="text-sm text-gray-200">{analyse.zeit}</span>
                </div>
              </div>
            </Card>

            {/* Was passiert als naechstes */}
            <div className="bg-[#00D4AA]/5 border border-[#00D4AA]/10 rounded-xl px-4 py-3 mb-6">
              <div className="text-xs font-medium text-[#00D4AA] mb-2">Was passiert jetzt?</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-4 h-4 rounded-full bg-[#00D4AA]/20 flex items-center justify-center text-[8px] text-[#00D4AA] font-bold">1</div>
                  Hausverwaltung wird sofort benachrichtigt
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-4 h-4 rounded-full bg-[#00D4AA]/20 flex items-center justify-center text-[8px] text-[#00D4AA] font-bold">2</div>
                  KI schlaegt passende Handwerker vor
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-4 h-4 rounded-full bg-[#00D4AA]/20 flex items-center justify-center text-[8px] text-[#00D4AA] font-bold">3</div>
                  Handwerker bieten per Smart-Auktion
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="w-4 h-4 rounded-full bg-[#00D4AA]/20 flex items-center justify-center text-[8px] text-[#00D4AA] font-bold">4</div>
                  Du wirst ueber jeden Schritt informiert
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl mb-4">{error}</p>}

            <div className="flex gap-3">
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 justify-center">
                {loading ? "Wird gesendet..." : "Meldung absenden"}
              </Button>
              <button onClick={() => setStep("details")} className="text-sm text-gray-500 hover:text-gray-300 px-4">Zurueck</button>
            </div>
          </div>
        )}

        {/* STEP 6: Gesendet - Erfolg */}
        {step === "gesendet" && (
          <div className="animate-fade-in text-center py-12">
            <div className="w-20 h-20 rounded-full bg-[#00D4AA]/10 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl text-[#00D4AA]">OK</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Meldung erfolgreich gesendet</h2>
            <p className="text-sm text-gray-500 mb-8">Deine Hausverwaltung wurde benachrichtigt. Du erhaeltst Updates zu jedem Schritt.</p>

            {/* Mini Pipeline */}
            <div className="flex items-center justify-center gap-2 mb-10">
              {["Gemeldet", "Freigabe", "Handwerker", "Reparatur", "Fertig"].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={"w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium " + (i === 0 ? "bg-[#00D4AA] text-black" : "bg-white/5 text-gray-600")}>
                    {i + 1}
                  </div>
                  {i < 4 && <div className={"w-6 h-0.5 " + (i === 0 ? "bg-[#00D4AA]/30" : "bg-white/5")} />}
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <Button onClick={() => router.push("/dashboard-mieter")}>Meine Meldungen</Button>
              <Button variant="ghost" onClick={() => { setStep("foto"); setBeschreibung(""); setKiResult(null); setForm({ titel: "", beschreibung: "", wohnung: "", prioritaet: "normal", gewerk: "allgemein" }) }}>
                Weiteren Schaden melden
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
            }
