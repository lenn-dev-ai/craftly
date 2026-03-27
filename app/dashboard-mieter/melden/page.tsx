"use client"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Card } from "@/components/ui"

type Step = "start" | "kategorie" | "beschreibung" | "ort" | "dringlichkeit" | "zusammenfassung" | "gesendet"

interface Message {
  rolle: "assistent" | "nutzer"
  text: string
  optionen?: { label: string; value: string }[]
}

const kategorien = [
  { label: "🔥 Heizung / Warmwasser ausgefallen", value: "Heizung / Warmwasser ausgefallen" },
  { label: "💧 Wasserschaden / Feuchtigkeit", value: "Wasserschaden / Feuchtigkeit" },
  { label: "⚡ Elektroproblem", value: "Elektroproblem" },
  { label: "🚪 Tür / Fenster defekt", value: "Tür / Fenster defekt" },
  { label: "🟤 Schimmel entdeckt", value: "Schimmel entdeckt" },
  { label: "🔧 Sonstiger Schaden", value: "Sonstiger Schaden" },
]

const dringlichkeiten = [
  { label: "Normal — kein Eile", value: "normal" },
  { label: "Hoch — bitte bald", value: "hoch" },
  { label: "🚨 Dringend — Notfall", value: "dringend" },
]

export default function MeldenPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("start")
  const [messages, setMessages] = useState<Message[]>([])
  const [form, setForm] = useState({ titel: "", beschreibung: "", wohnung: "", prioritaet: "normal" })
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    // Startnachricht
    addAssistentMessage(
      "Hallo! 👋 Ich helfe dir, einen Schaden zu melden. Was ist passiert?",
      kategorien
    )
    setStep("kategorie")
  }, [])

  function addAssistentMessage(text: string, optionen?: { label: string; value: string }[]) {
    setMessages(prev => [...prev, { rolle: "assistent", text, optionen }])
  }

  function addNutzerMessage(text: string) {
    setMessages(prev => [...prev, { rolle: "nutzer", text }])
  }

  function handleKategorie(label: string, value: string) {
    addNutzerMessage(label)
    setForm(f => ({ ...f, titel: value }))

    setTimeout(() => {
      const followUp = getFollowUpForKategorie(value)
      addAssistentMessage(followUp)
      setStep("beschreibung")
    }, 400)
  }

  function getFollowUpForKategorie(kategorie: string): string {
    switch (kategorie) {
      case "Heizung / Warmwasser ausgefallen":
        return "Das klingt unangenehm! Seit wann funktioniert die Heizung oder das Warmwasser nicht mehr? Betrifft es die gesamte Wohnung oder nur einzelne Heizkörper?"
      case "Wasserschaden / Feuchtigkeit":
        return "Oh nein! Beschreib bitte genau wo du die Feuchtigkeit siehst — an der Decke, an der Wand, am Boden? Tropft es aktiv oder ist es nur feucht?"
      case "Elektroproblem":
        return "Vorsicht bei Strom! Was genau passiert — fallen Sicherungen raus, flackert Licht, funktionieren Steckdosen nicht? Bitte beschreib es möglichst genau."
      case "Tür / Fenster defekt":
        return "Welche Tür oder welches Fenster ist betroffen? Lässt es sich nicht mehr öffnen, schließen oder ist etwas gebrochen?"
      case "Schimmel entdeckt":
        return "Wo genau siehst du den Schimmel — Bad, Schlafzimmer, Küche? Wie groß ist die betroffene Stelle ungefähr? (z.B. handtellergroß, größer als ein Blatt Papier)"
      default:
        return "Kannst du bitte genauer beschreiben, was passiert ist? Je mehr Details, desto schneller können wir helfen."
    }
  }

  function handleBeschreibung() {
    if (!input.trim()) return
    addNutzerMessage(input)
    setForm(f => ({ ...f, beschreibung: input }))
    setInput("")

    setTimeout(() => {
      addAssistentMessage("Danke für die Details! In welcher Wohnung oder welchem Raum ist das Problem?")
      setStep("ort")
    }, 400)
  }

  function handleOrt() {
    if (!input.trim()) return
    addNutzerMessage(input)
    setForm(f => ({ ...f, wohnung: input }))
    setInput("")

    setTimeout(() => {
      addAssistentMessage("Wie dringend ist es?", dringlichkeiten)
      setStep("dringlichkeit")
    }, 400)
  }

  function handleDringlichkeit(label: string, value: string) {
    addNutzerMessage(label)
    setForm(f => ({ ...f, prioritaet: value }))

    setTimeout(() => {
      if (value === "dringend") {
        addAssistentMessage(
          "⚠️ Bei akuten Notfällen (Wasserrohrbruch, Gasleck) ruf bitte sofort deinen Notdienst an!\n\nHier ist deine Zusammenfassung:"
        )
      } else {
        addAssistentMessage("Perfekt, hier ist deine Zusammenfassung:")
      }
      setStep("zusammenfassung")
    }, 400)
  }

  async function handleSubmit() {
    setLoading(true)
    setError("")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const { data, error: dbError } = await supabase.from("tickets").insert({
      titel: form.titel,
      beschreibung: form.beschreibung,
      wohnung: form.wohnung,
      prioritaet: form.prioritaet,
      status: "offen",
      vergabemodus: "direkt",
      erstellt_von: user.id,
    }).select().single()

    if (dbError) {
      setError("Fehler: " + dbError.message)
      setLoading(false)
      return
    }

    addNutzerMessage("Absenden!")
    setTimeout(() => {
      addAssistentMessage("Deine Meldung wurde erfolgreich gesendet! ✅ Deine Hausverwaltung wurde benachrichtigt und kümmert sich darum.")
      setStep("gesendet")
      setLoading(false)
    }, 500)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (step === "beschreibung") handleBeschreibung()
      else if (step === "ort") handleOrt()
    }
  }

  const showInput = step === "beschreibung" || step === "ort"
  const placeholder = step === "beschreibung"
    ? "Beschreibe was passiert ist..."
    : step === "ort"
    ? "z.B. Küche, Bad, Whg. 3 OG..."
    : ""

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← Zurück</button>
          <div>
            <h1 className="text-lg font-medium">Schaden melden</h1>
            <p className="text-xs text-gray-400">KI-Assistent hilft dir Schritt für Schritt</p>
          </div>
        </div>
      </div>

      {/* Chat-Bereich */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-gray-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.rolle === "nutzer" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] ${msg.rolle === "nutzer"
              ? "bg-[#1D9E75] text-white rounded-2xl rounded-br-md px-4 py-2.5"
              : "bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm"
            }`}>
              <p className="text-sm whitespace-pre-line">{msg.text}</p>
              {msg.optionen && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.optionen.map(opt => (
                    <button key={opt.value}
                      onClick={() => {
                        if (step === "kategorie") handleKategorie(opt.label, opt.value)
                        else if (step === "dringlichkeit") handleDringlichkeit(opt.label, opt.value)
                      }}
                      className="text-xs bg-gray-50 hover:bg-[#1D9E75] hover:text-white border border-gray-200 hover:border-[#1D9E75] rounded-full px-3 py-1.5 transition-colors">
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Zusammenfassung */}
        {step === "zusammenfassung" && (
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Problem:</span>
                  <span className="font-medium">{form.titel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Beschreibung:</span>
                  <span className="font-medium text-right max-w-[60%]">{form.beschreibung}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ort:</span>
                  <span className="font-medium">{form.wohnung}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dringlichkeit:</span>
                  <span className={`font-medium ${form.prioritaet === "dringend" ? "text-red-600" : form.prioritaet === "hoch" ? "text-orange-600" : "text-gray-700"}`}>
                    {form.prioritaet === "dringend" ? "🚨 Dringend" : form.prioritaet === "hoch" ? "⚠️ Hoch" : "Normal"}
                  </span>
                </div>
              </div>
              {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
              <div className="mt-4 flex gap-2">
                <Button onClick={handleSubmit} disabled={loading} size="sm">
                  {loading ? "Wird gesendet..." : "✅ Meldung absenden"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  setMessages([])
                  setForm({ titel: "", beschreibung: "", wohnung: "", prioritaet: "normal" })
                  setStep("start")
                  setTimeout(() => {
                    addAssistentMessage("Hallo! 👋 Ich helfe dir, einen Schaden zu melden. Was ist passiert?", kategorien)
                    setStep("kategorie")
                  }, 200)
                }}>
                  Neu starten
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Gesendet — Link zum Ticket */}
        {step === "gesendet" && (
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-2 mt-1">
                <Button size="sm" onClick={() => router.push("/dashboard-mieter/tickets")}>
                  Meine Tickets anzeigen
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  setMessages([])
                  setForm({ titel: "", beschreibung: "", wohnung: "", prioritaet: "normal" })
                  setStep("start")
                  setTimeout(() => {
                    addAssistentMessage("Hallo! 👋 Ich helfe dir, einen Schaden zu melden. Was ist passiert?", kategorien)
                    setStep("kategorie")
                  }, 200)
                }}>
                  Weiteren Schaden melden
                </Button>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input-Bereich */}
      {showInput && (
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          <div className="flex gap-2 items-end max-w-2xl mx-auto">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75]"
              style={{ minHeight: "42px", maxHeight: "120px" }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = "42px"
                t.style.height = Math.min(t.scrollHeight, 120) + "px"
              }}
            />
            <Button
              onClick={() => { if (step === "beschreibung") handleBeschreibung(); else if (step === "ort") handleOrt() }}
              disabled={!input.trim()}
              size="sm"
              className="rounded-xl px-4"
            >
              Senden
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
