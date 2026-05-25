"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Input, Select, Textarea } from "@/components/ui"
import AddressAutocomplete from "@/components/AddressAutocomplete"
import { authFetch } from "@/lib/auth/clientFetch"
import { Phone, Home, Wrench, MapPin, Camera, Check, ChevronRight, ChevronLeft, X } from "lucide-react"

// Sprint G — Verwalter-Wizard. Pre-Pivot-Investition (P2):
// Verwalter telefoniert mit Mieter, tippt Schaden selbst ein.
// Schlanker als der Mieter-Wizard: keine KI-Vision (Verwalter weiß
// meist schon was es ist), kein Foto-Zwang, weniger Steps.

type Step = "anrufer" | "schaden" | "ort" | "foto" | "zusammenfassung" | "gesendet"

const GEWERKE = [
  "heizung_sanitaer", "elektro", "schreiner", "maler",
  "dachdecker", "bodenleger", "schluessel", "allgemein",
] as const

const GEWERK_LABEL: Record<string, string> = {
  heizung_sanitaer: "Heizung / Sanitär",
  elektro: "Elektro",
  schreiner: "Schreiner / Tischler",
  maler: "Maler",
  dachdecker: "Dachdecker",
  bodenleger: "Bodenleger",
  schluessel: "Schlüsseldienst",
  allgemein: "Allgemein",
}

const DRINGLICHKEIT = [
  {
    key: "planbar",
    label: "Planbar",
    sub: "Diese Woche",
    help: "Auktion läuft bis zu 72h, Handwerker vergleichen in Ruhe Preise",
  },
  {
    key: "zeitnah",
    label: "Zeitnah",
    sub: "Bald bitte",
    help: "Auktion läuft maximal 24h, dann automatische Vergabe an besten Treffer",
  },
  {
    key: "notfall",
    label: "Notfall",
    sub: "Sofort",
    help: "Direkt-Vergabe an erstbesten HW im Radius, kein Auktions-Loop",
  },
] as const

const STEPS: Step[] = ["anrufer", "schaden", "ort", "foto", "zusammenfassung"]
const STEP_LABEL: Record<Step, string> = {
  anrufer: "Anrufer",
  schaden: "Schaden",
  ort: "Ort & Dringlichkeit",
  foto: "Foto",
  zusammenfassung: "Zusammenfassung",
  gesendet: "Fertig",
}

export default function NeuesTicketPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("anrufer")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Step 1 — Anrufer
  const [mieterName, setMieterName] = useState("")
  const [mieterTelefon, setMieterTelefon] = useState("")

  // Step 2 — Schaden
  const [titel, setTitel] = useState("")
  const [beschreibung, setBeschreibung] = useState("")
  const [gewerk, setGewerk] = useState<string>("allgemein")

  // Step 3 — Ort + Dringlichkeit
  const [adresse, setAdresse] = useState("")
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [wohnung, setWohnung] = useState("")
  const [prioritaet, setPrioritaet] = useState<string>("planbar")

  // Step 4 — Fotos (optional)
  const [fotoFiles, setFotoFiles] = useState<File[]>([])

  function next() {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }
  function prev() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  function canProceed(): boolean {
    if (step === "anrufer") return mieterName.trim().length > 0
    if (step === "schaden") return titel.trim().length > 0 && beschreibung.trim().length > 0
    if (step === "ort") return adresse.trim().length > 0
    return true
  }

  async function submit() {
    setSubmitting(true)
    setError("")
    try {
      const res = await authFetch("/api/tickets/create-by-verwalter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mieter_name: mieterName.trim(),
          mieter_telefon: mieterTelefon.trim() || null,
          titel: titel.trim(),
          beschreibung: beschreibung.trim(),
          gewerk,
          einsatzort_adresse: adresse.trim(),
          einsatzort_lat: lat,
          einsatzort_lng: lng,
          wohnung: wohnung.trim() || null,
          prioritaet,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setStep("gesendet")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler beim Speichern.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Neues Ticket</h1>
          <p className="text-sm text-ink-muted mt-1">Schadensmeldung telefonisch aufnehmen</p>
        </div>
        <button
          onClick={() => router.push("/dashboard-verwalter")}
          className="text-ink-muted hover:text-ink transition"
          aria-label="Abbrechen"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {step !== "gesendet" && <StepIndicator current={step} />}

      <Card className="p-6">
        {step === "anrufer" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rolle-verwalter">
              <Phone className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Wer ruft an?</h2>
            </div>
            <Input
              label="Mieter-Name *"
              value={mieterName}
              onChange={e => setMieterName(e.target.value)}
              placeholder="z.B. Anna Schulze"
              autoFocus
            />
            <Input
              label="Telefon (optional)"
              value={mieterTelefon}
              onChange={e => setMieterTelefon(e.target.value)}
              placeholder="z.B. 0151 123 456 78"
              inputMode="tel"
            />
          </div>
        )}

        {step === "schaden" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rolle-verwalter">
              <Wrench className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Was ist passiert?</h2>
            </div>
            <Input
              label="Kurze Überschrift *"
              value={titel}
              onChange={e => setTitel(e.target.value)}
              placeholder="z.B. Wasserhahn tropft in der Küche"
              autoFocus
            />
            <Textarea
              label="Beschreibung *"
              value={beschreibung}
              onChange={e => setBeschreibung(e.target.value)}
              placeholder="Was der Mieter am Telefon erzählt — möglichst konkret (was, wo, seit wann)"
              rows={4}
            />
            <Select
              label="Gewerk *"
              value={gewerk}
              onChange={e => setGewerk(e.target.value)}
            >
              {GEWERKE.map(g => (
                <option key={g} value={g}>{GEWERK_LABEL[g]}</option>
              ))}
            </Select>
          </div>
        )}

        {step === "ort" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rolle-verwalter">
              <MapPin className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Wo & wie dringend?</h2>
            </div>
            <AddressAutocomplete
              label="Einsatzort-Adresse *"
              initialAdresse={adresse}
              onSelect={t => {
                setAdresse(t.adresse)
                setLat(t.lat)
                setLng(t.lng)
              }}
              placeholder="z.B. Hauptstr. 5, 10115 Berlin"
            />
            <Input
              label="Wohnung (optional)"
              value={wohnung}
              onChange={e => setWohnung(e.target.value)}
              placeholder="z.B. 3. OG rechts"
            />
            <div>
              <label className="text-sm font-medium text-ink mb-2 block">Dringlichkeit</label>
              <div className="grid grid-cols-3 gap-2">
                {DRINGLICHKEIT.map(d => (
                  <button
                    key={d.key}
                    onClick={() => setPrioritaet(d.key)}
                    title={d.help}
                    className={`p-3 rounded-lg border text-left transition ${
                      prioritaet === d.key
                        ? "border-rolle-verwalter bg-rolle-verwalter/5"
                        : "border-line hover:border-rolle-verwalter/30"
                    }`}
                  >
                    <div className="font-semibold text-sm">{d.label}</div>
                    <div className="text-xs text-ink-muted">{d.sub}</div>
                  </button>
                ))}
              </div>
              {/* Audit-L2: explizite Erklärung was die gewählte Stufe auslöst */}
              <p className="text-[11px] text-ink-muted mt-2">
                {DRINGLICHKEIT.find(d => d.key === prioritaet)?.help}
              </p>
            </div>
          </div>
        )}

        {step === "foto" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rolle-verwalter">
              <Camera className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Fotos (optional)</h2>
            </div>
            <p className="text-sm text-ink-muted">
              In den meisten Fällen hat der Mieter dir keine Fotos geschickt — das ist okay,
              überspring den Step einfach.
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={e => setFotoFiles(Array.from(e.target.files || []))}
              className="block w-full text-sm text-ink file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-rolle-verwalter file:text-white file:font-semibold"
            />
            {fotoFiles.length > 0 && (
              <p className="text-xs text-ink-muted">{fotoFiles.length} Foto(s) ausgewählt — werden mit dem Ticket hochgeladen.</p>
            )}
          </div>
        )}

        {step === "zusammenfassung" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rolle-verwalter">
              <Check className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Bereit zum Speichern?</h2>
            </div>
            <SummaryRow label="Anrufer" value={mieterName + (mieterTelefon ? ` · ${mieterTelefon}` : "")} />
            <SummaryRow label="Schaden" value={titel} />
            <SummaryRow label="Gewerk" value={GEWERK_LABEL[gewerk]} />
            <SummaryRow label="Ort" value={adresse + (wohnung ? ` · ${wohnung}` : "")} />
            <SummaryRow label="Dringlichkeit" value={DRINGLICHKEIT.find(d => d.key === prioritaet)?.label || prioritaet} />
            {fotoFiles.length > 0 && <SummaryRow label="Fotos" value={`${fotoFiles.length}`} />}
            {error && (
              <div className="bg-danger/10 text-danger text-sm p-3 rounded-lg">{error}</div>
            )}
          </div>
        )}

        {step === "gesendet" && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-status-erledigt/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-status-erledigt" />
            </div>
            <h2 className="text-xl font-bold text-ink">Ticket angelegt</h2>
            <p className="text-sm text-ink-muted">
              Das Ticket erscheint jetzt in deiner Ticket-Liste mit dem Badge &bdquo;📞 telefonisch&ldquo;.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => {
                setStep("anrufer")
                setMieterName(""); setMieterTelefon("")
                setTitel(""); setBeschreibung(""); setGewerk("allgemein")
                setAdresse(""); setLat(null); setLng(null); setWohnung("")
                setPrioritaet("planbar"); setFotoFiles([])
              }}>Noch eins anlegen</Button>
              <Button onClick={() => router.push("/dashboard-verwalter")}>Zum Dashboard</Button>
            </div>
          </div>
        )}

        {step !== "gesendet" && step !== "zusammenfassung" && (
          <div className="flex justify-between mt-6 pt-6 border-t border-line">
            <Button variant="secondary" onClick={prev} disabled={step === "anrufer"}>
              <ChevronLeft className="w-4 h-4" /> Zurück
            </Button>
            <Button onClick={next} disabled={!canProceed()}>
              {step === "foto" ? "Weiter zur Zusammenfassung" : "Weiter"} <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {step === "zusammenfassung" && (
          <div className="flex justify-between mt-6 pt-6 border-t border-line">
            <Button variant="secondary" onClick={prev} disabled={submitting}>
              <ChevronLeft className="w-4 h-4" /> Zurück
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Speichere…" : "Ticket speichern"} <Check className="w-4 h-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current)
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2 flex-1">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              i < idx ? "bg-rolle-verwalter text-white"
                : i === idx ? "bg-rolle-verwalter text-white ring-4 ring-rolle-verwalter/20"
                : "bg-line text-ink-muted"
            }`}
          >
            {i < idx ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          <span className={`text-xs hidden md:inline ${i === idx ? "font-semibold text-ink" : "text-ink-muted"}`}>
            {STEP_LABEL[s]}
          </span>
          {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < idx ? "bg-rolle-verwalter" : "bg-line"}`} />}
        </div>
      ))}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-line last:border-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-medium text-ink text-right">{value}</span>
    </div>
  )
}
