"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import AddressAutocomplete from "@/components/AddressAutocomplete"
import { Button } from "@/components/ui"
import { useToast } from "@/components/Toast"
import { formatGewerk } from "@/types"

// Sprint AI — Shared Wizard-Component (Mieter + Verwalter)
//
// Slimmed-down Reimplementation des Mieter-Wizards (915 LOC → ~400 LOC)
// + Verwalter-Variante als Variante-Switch.
// Bewusst KEIN Drop-in-Replacement für /dashboard-mieter/melden — Sprint
// AI wird in einer dedizierten Test-Session vollendet (Playwright-Run).
// Hier nur das Component-Fundament, das Tests dann gegen die alte Page
// vergleichen können.

type Step = "foto" | "analyse" | "details" | "ort" | "zusammenfassung"
type Variant = "mieter" | "verwalter"

interface PillItem {
  key: string
  label: string
  icon: string
  startText: string
  gewerkHint: string
}

interface KIResponse {
  schadensart?: string
  gewerk?: string
  dringlichkeit?: "notfall" | "zeitnah" | "planbar"
  titel_vorschlag?: string
  beschreibung_vorschlag?: string
  confidence?: number
  hinweis?: string
}

export interface TicketWizardProps {
  variant: Variant
  /** Verwalter: zusätzliche Felder Anrufer-Name + Telefon */
  showAnruferFelder?: boolean
  /** Default-Wohnungs-ID wenn nur 1 Wohnung verfügbar */
  defaultWohnungId?: string
  onSuccess?: (ticketId: string) => void
}

const STATIC_PILLS: PillItem[] = [
  { key: "heizung",  label: "Heizung aus",     icon: "!", startText: "Heizung funktioniert nicht mehr, Wohnung wird kalt", gewerkHint: "heizung_sanitaer" },
  { key: "wasser",   label: "Wasserschaden",   icon: "~", startText: "Wasser tropft oder läuft aus, Feuchtigkeit an Wand",  gewerkHint: "heizung_sanitaer" },
  { key: "elektro",  label: "Strom/Elektrik",  icon: "#", startText: "Strom ausgefallen oder Steckdose funktioniert nicht", gewerkHint: "elektro" },
  { key: "tuer",     label: "Tür/Fenster",     icon: "|", startText: "Tür oder Fenster lässt sich nicht richtig schließen", gewerkHint: "schreiner" },
  { key: "schimmel", label: "Schimmel",        icon: "o", startText: "Schimmelflecken an Wand oder Decke entdeckt",          gewerkHint: "maler" },
]

const MAX_FOTOS = 5
const MAX_FOTO_BYTES = 5 * 1024 * 1024
const ERLAUBTE_FOTO_TYPEN = ["image/jpeg", "image/png", "image/webp", "image/heic"]

export function TicketWizard({ variant, showAnruferFelder = false, defaultWohnungId, onSuccess }: TicketWizardProps) {
  const router = useRouter()
  const toast = useToast()
  const [step, setStep] = useState<Step>("foto")
  const [beschreibung, setBeschreibung] = useState("")
  const [pills, setPills] = useState<PillItem[]>(STATIC_PILLS)
  const [likelyPill, setLikelyPill] = useState<string | null>(null)
  const [fotoFiles, setFotoFiles] = useState<File[]>([])
  const [fotoPreviewUrls, setFotoPreviewUrls] = useState<string[]>([])
  const [analyseProgress, setAnalyseProgress] = useState(0)
  const [ki, setKi] = useState<KIResponse | null>(null)
  const [titel, setTitel] = useState("")
  const [gewerk, setGewerk] = useState("allgemein")
  const [dringlichkeit, setDringlichkeit] = useState<"notfall" | "zeitnah" | "planbar">("planbar")
  const [adresse, setAdresse] = useState("")
  const [adresseLat, setAdresseLat] = useState<number | null>(null)
  const [adresseLng, setAdresseLng] = useState<number | null>(null)
  const [wohnungId, setWohnungId] = useState<string>(defaultWohnungId ?? "")
  const [anruferName, setAnruferName] = useState("")
  const [anruferTel, setAnruferTel] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dynamic Pills laden
  useEffect(() => {
    let aktiv = true
    void (async () => {
      try {
        const url = wohnungId ? `/api/melden/pills?wohnung_id=${wohnungId}` : "/api/melden/pills"
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json() as { pills?: PillItem[] }
        if (aktiv && Array.isArray(data.pills) && data.pills.length > 0) setPills(data.pills)
      } catch {}
    })()
    return () => { aktiv = false }
  }, [wohnungId])

  // Foto-Preview-URLs verwalten
  useEffect(() => {
    const urls = fotoFiles.map(f => URL.createObjectURL(f))
    setFotoPreviewUrls(urls)
    return () => { urls.forEach(URL.revokeObjectURL) }
  }, [fotoFiles])

  // Foto-Prescan (Hintergrund, non-blocking)
  useEffect(() => {
    if (fotoFiles.length === 0) { setLikelyPill(null); return }
    let aktiv = true
    void (async () => {
      try {
        const form = new FormData()
        form.append("foto", fotoFiles[0])
        const res = await fetch("/api/ki/foto-prescan", { method: "POST", body: form })
        if (!res.ok) return
        const data = await res.json() as { likelyPill?: string }
        if (aktiv && data.likelyPill) setLikelyPill(data.likelyPill)
      } catch {}
    })()
    return () => { aktiv = false }
  }, [fotoFiles])

  function fotoHinzufuegen(files: FileList | null) {
    if (!files) return
    const platz = MAX_FOTOS - fotoFiles.length
    if (platz <= 0) return
    const akzeptiert: File[] = []
    for (const f of Array.from(files).slice(0, platz)) {
      if (!ERLAUBTE_FOTO_TYPEN.includes(f.type)) continue
      if (f.size > MAX_FOTO_BYTES) continue
      akzeptiert.push(f)
    }
    setFotoFiles(prev => [...prev, ...akzeptiert])
  }
  function fotoEntfernen(i: number) {
    setFotoFiles(prev => prev.filter((_, idx) => idx !== i))
  }

  async function startAnalyse() {
    if (!beschreibung.trim() && fotoFiles.length === 0) return
    setStep("analyse")
    setAnalyseProgress(0)
    const progressInterval = setInterval(() => {
      setAnalyseProgress(p => Math.min(p + 5, 90))
    }, 80)

    let kiResp: KIResponse = {}
    try {
      if (fotoFiles.length > 0) {
        const form = new FormData()
        form.append("foto", fotoFiles[0])
        const res = await fetch("/api/ki/schadenserkennung", { method: "POST", body: form })
        if (res.ok) kiResp = await res.json()
      }
    } catch {}
    clearInterval(progressInterval)
    setAnalyseProgress(100)
    setKi(kiResp)

    // KI-Werte ins Formular übernehmen
    setTitel(kiResp.titel_vorschlag ?? beschreibung.split(/\n/)[0]?.slice(0, 60) ?? "Schadensmeldung")
    if (kiResp.gewerk) {
      const map: Record<string, string> = {
        Klempner: "heizung_sanitaer", Elektriker: "elektro", Heizungsbauer: "heizung_sanitaer",
        Tischler: "schreiner", Dachdecker: "dachdecker", Maler: "maler",
        Bodenleger: "bodenleger", "Schimmel-Sanierer": "maler", Allgemein: "allgemein",
      }
      setGewerk(map[kiResp.gewerk] ?? "allgemein")
    }
    if (kiResp.dringlichkeit) setDringlichkeit(kiResp.dringlichkeit)
    if (kiResp.beschreibung_vorschlag && !beschreibung.trim()) {
      setBeschreibung(kiResp.beschreibung_vorschlag)
    }

    setTimeout(() => setStep("details"), 500)
  }

  async function uploadFotos(): Promise<string[]> {
    if (fotoFiles.length === 0) return []
    const supabase = createClient()
    const urls: string[] = []
    for (let i = 0; i < fotoFiles.length; i++) {
      const file = fotoFiles[i]
      const ext = file.name.split(".").pop() ?? "jpg"
      const path = `${Date.now()}_${i}.${ext}`
      const { data, error } = await supabase.storage.from("ticket-fotos").upload(path, file)
      if (error || !data) continue
      const { data: pub } = supabase.storage.from("ticket-fotos").getPublicUrl(data.path)
      if (pub?.publicUrl) urls.push(pub.publicUrl)
    }
    return urls
  }

  async function submit() {
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const fotoUrls = await uploadFotos()
      const body: Record<string, unknown> = {
        titel,
        beschreibung,
        gewerk,
        dringlichkeit,
        prioritaet: dringlichkeit === "notfall" ? "hoch" : dringlichkeit === "zeitnah" ? "mittel" : "planbar",
        wohnung: wohnungId || null,
        einsatzort_adresse: adresse || null,
        einsatzort_lat: adresseLat,
        einsatzort_lng: adresseLng,
        foto_urls: fotoUrls,
        eingetragen_via: variant === "verwalter" ? "verwalter_ui" : "mieter_ui",
        eingetragen_von_verwalter: variant === "verwalter",
      }
      if (variant === "verwalter" && showAnruferFelder) {
        body.anrufer_name = anruferName
        body.anrufer_telefon = anruferTel
      }

      const res = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.show(err.error ?? "Anlegen fehlgeschlagen", "error")
        return
      }
      const data = await res.json() as { ticket_id?: string; id?: string }
      const ticketId = data.ticket_id ?? data.id
      if (!ticketId) {
        toast.show("Ticket angelegt, aber keine ID erhalten", "error")
        return
      }
      toast.show("Schaden gemeldet — wir benachrichtigen die Verwaltung", "success")
      if (onSuccess) onSuccess(ticketId)
      else router.push(variant === "verwalter" ? `/dashboard-verwalter` : `/dashboard-mieter/vorgang/${ticketId}`)
    } finally {
      setSubmitting(false)
    }
  }

  const totalSteps = 5
  const stepIndex = ["foto", "analyse", "details", "ort", "zusammenfassung"].indexOf(step) + 1

  return (
    <div className="min-h-screen bg-surface text-ink">
      <div className="pl-14 pr-6 md:px-6 py-4 border-b border-line">
        <div className="flex items-center justify-between gap-3 max-w-xl mx-auto">
          <button onClick={() => router.back()} className="text-sm text-ink-muted hover:text-ink whitespace-nowrap">&larr; Zurück</button>
          <h1 className="text-sm font-medium text-ink truncate">
            {variant === "verwalter" ? "Schaden eintragen" : "Schaden melden"}
          </h1>
          <span className="text-xs font-medium text-ink-muted tabular-nums whitespace-nowrap">{Math.min(stepIndex, totalSteps)}/{totalSteps}</span>
        </div>
      </div>
      <div className="h-0.5 bg-surface-muted">
        <div className="h-full bg-gradient-to-r from-[#3D8B7A] to-[#4A9E8C] transition-all duration-700" style={{ width: `${Math.min(stepIndex / totalSteps * 100, 100)}%` }} />
      </div>
      <div className="max-w-xl mx-auto px-6 py-8">
        {step === "foto" && (
          <FotoStep
            beschreibung={beschreibung} setBeschreibung={setBeschreibung}
            pills={pills} likelyPill={likelyPill}
            fotoFiles={fotoFiles} fotoPreviewUrls={fotoPreviewUrls}
            onFotosHinzufuegen={fotoHinzufuegen} onFotoEntfernen={fotoEntfernen}
            fileInputRef={fileInputRef} onStartAnalyse={startAnalyse}
          />
        )}
        {step === "analyse" && (
          <AnalyseStep progress={analyseProgress} hinweis={ki?.hinweis} />
        )}
        {step === "details" && (
          <DetailsStep
            titel={titel} setTitel={setTitel}
            gewerk={gewerk} setGewerk={setGewerk}
            dringlichkeit={dringlichkeit} setDringlichkeit={setDringlichkeit}
            ki={ki}
            showAnruferFelder={variant === "verwalter" && showAnruferFelder}
            anruferName={anruferName} setAnruferName={setAnruferName}
            anruferTel={anruferTel} setAnruferTel={setAnruferTel}
            onWeiter={() => setStep("ort")}
            onZurueck={() => setStep("foto")}
          />
        )}
        {step === "ort" && (
          <OrtStep
            adresse={adresse} setAdresse={setAdresse}
            setAdresseLat={setAdresseLat} setAdresseLng={setAdresseLng}
            wohnungId={wohnungId} setWohnungId={setWohnungId}
            onWeiter={() => setStep("zusammenfassung")}
            onZurueck={() => setStep("details")}
          />
        )}
        {step === "zusammenfassung" && (
          <ZusammenfassungStep
            titel={titel} beschreibung={beschreibung} gewerk={gewerk} dringlichkeit={dringlichkeit}
            adresse={adresse} fotoCount={fotoFiles.length}
            submitting={submitting}
            onAbsenden={submit}
            onZurueck={() => setStep("ort")}
          />
        )}
      </div>
    </div>
  )
}

// ============================================================
// Step-Components
// ============================================================

function FotoStep(props: {
  beschreibung: string; setBeschreibung: (v: string) => void
  pills: PillItem[]; likelyPill: string | null
  fotoFiles: File[]; fotoPreviewUrls: string[]
  onFotosHinzufuegen: (files: FileList | null) => void
  onFotoEntfernen: (i: number) => void
  fileInputRef: React.RefObject<HTMLInputElement>
  onStartAnalyse: () => void
}) {
  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">AI</span>
        </div>
        <h2 className="text-xl font-semibold mb-2">Was ist passiert?</h2>
        <p className="text-sm text-ink-muted">Beschreibe den Schaden — KI erkennt Kategorie, Gewerk und Dringlichkeit.</p>
      </div>
      <input
        ref={props.fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        multiple
        onChange={e => { props.onFotosHinzufuegen(e.target.files); if (props.fileInputRef.current) props.fileInputRef.current.value = "" }}
        className="hidden"
      />
      {props.fotoPreviewUrls.length > 0 ? (
        <div className="mb-6 grid grid-cols-3 gap-2">
          {props.fotoPreviewUrls.map((url, i) => (
            <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              <button onClick={() => props.onFotoEntfernen(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#2D2A26]/80 text-white text-xs">×</button>
            </div>
          ))}
          {props.fotoFiles.length < MAX_FOTOS && (
            <button onClick={() => props.fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-line flex items-center justify-center text-ink-muted">+</button>
          )}
        </div>
      ) : (
        <button onClick={() => props.fileInputRef.current?.click()} className="w-full border-2 border-dashed border-line rounded-2xl p-8 text-center mb-6 hover:border-accent/40 transition-colors">
          <p className="text-sm font-medium">Fotos aufnehmen oder hochladen</p>
          <p className="text-xs text-ink-muted mt-1">max. {MAX_FOTOS} Fotos</p>
        </button>
      )}
      <div className="mb-4">
        <label className="block text-xs font-medium text-ink-muted mb-2">Beschreibung</label>
        <textarea
          value={props.beschreibung}
          onChange={e => props.setBeschreibung(e.target.value)}
          placeholder="z.B. Wasser tropft von der Decke im Bad..."
          rows={4}
          className="w-full bg-white border border-line rounded-xl px-4 py-3 text-sm"
        />
      </div>
      <div className="mb-6">
        <p className="text-xs text-ink-muted mb-1">Hilfe für den Anfang <span className="text-ink-faint font-normal">(optional)</span></p>
        <div className="flex flex-wrap gap-2">
          {props.pills.map(p => {
            const highlight = props.likelyPill === p.key
            return (
              <button
                key={p.key}
                onClick={() => props.setBeschreibung(p.startText)}
                className={`text-xs border rounded-full px-3 py-1.5 transition-all ${
                  highlight
                    ? "bg-accent/20 border-accent text-accent ring-2 ring-accent/30"
                    : "bg-surface-muted hover:bg-accent/10 border-line hover:border-accent/30 text-ink-muted hover:text-accent"
                }`}
              >
                {highlight && "✓ "}{p.icon} {p.label}
              </button>
            )
          })}
        </div>
      </div>
      <Button onClick={props.onStartAnalyse} disabled={!props.beschreibung.trim() && props.fotoFiles.length === 0} className="w-full justify-center">
        KI-Analyse starten
      </Button>
    </div>
  )
}

function AnalyseStep(props: { progress: number; hinweis?: string }) {
  return (
    <div className="animate-fade-in text-center py-16">
      <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6 animate-pulse">
        <span className="text-2xl">AI</span>
      </div>
      <h2 className="text-lg font-semibold mb-2">KI analysiert deinen Schaden...</h2>
      <p className="text-sm text-ink-muted mb-8">Kategorie, Gewerk und Dringlichkeit werden erkannt</p>
      <div className="w-64 h-2 bg-surface-muted rounded-full mx-auto overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#3D8B7A] to-[#4A9E8C] transition-all duration-300" style={{ width: `${Math.min(props.progress, 100)}%` }} />
      </div>
      {props.hinweis && <p className="text-xs text-ink-muted mt-4">{props.hinweis}</p>}
    </div>
  )
}

const GEWERK_OPTS = [
  { key: "heizung_sanitaer", label: "Heizung / Sanitär" },
  { key: "elektro",          label: "Elektro" },
  { key: "schreiner",        label: "Schreiner" },
  { key: "maler",            label: "Maler" },
  { key: "dachdecker",       label: "Dachdecker" },
  { key: "bodenleger",       label: "Bodenleger" },
  { key: "allgemein",        label: "Allgemein" },
]

function DetailsStep(props: {
  titel: string; setTitel: (v: string) => void
  gewerk: string; setGewerk: (v: string) => void
  dringlichkeit: "notfall" | "zeitnah" | "planbar"; setDringlichkeit: (v: "notfall" | "zeitnah" | "planbar") => void
  ki: KIResponse | null
  showAnruferFelder?: boolean
  anruferName: string; setAnruferName: (v: string) => void
  anruferTel: string; setAnruferTel: (v: string) => void
  onWeiter: () => void; onZurueck: () => void
}) {
  return (
    <div className="animate-fade-in space-y-4">
      <h2 className="text-xl font-semibold mb-2">Details prüfen</h2>
      {props.ki?.hinweis && (
        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">
          KI-Hinweis: {props.ki.hinweis}
        </div>
      )}
      <div>
        <label className="block text-xs text-ink-muted mb-1">Titel</label>
        <input value={props.titel} onChange={e => props.setTitel(e.target.value)} className="w-full bg-white border border-line rounded-xl px-4 py-2.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-ink-muted mb-1">Gewerk</label>
        <select value={props.gewerk} onChange={e => props.setGewerk(e.target.value)} className="w-full bg-white border border-line rounded-xl px-4 py-2.5 text-sm">
          {GEWERK_OPTS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-ink-muted mb-1">Dringlichkeit</label>
        <div className="grid grid-cols-3 gap-2">
          {(["notfall", "zeitnah", "planbar"] as const).map(d => (
            <button key={d} onClick={() => props.setDringlichkeit(d)} className={`text-xs border rounded-xl px-3 py-2 ${props.dringlichkeit === d ? "border-accent bg-accent/10 text-accent" : "border-line text-ink-muted hover:bg-surface-muted"}`}>
              {d === "notfall" ? "🔴 Notfall" : d === "zeitnah" ? "🟡 Zeitnah" : "🟢 Planbar"}
            </button>
          ))}
        </div>
      </div>
      {props.showAnruferFelder && (
        <div className="border-t border-line pt-4 space-y-3">
          <p className="text-xs font-medium text-ink-muted">Anrufer-Daten (Mieter der gemeldet hat)</p>
          <input value={props.anruferName} onChange={e => props.setAnruferName(e.target.value)} placeholder="Name des Anrufers" className="w-full bg-white border border-line rounded-xl px-4 py-2.5 text-sm" />
          <input value={props.anruferTel}  onChange={e => props.setAnruferTel(e.target.value)}  placeholder="Telefon für Rückruf" className="w-full bg-white border border-line rounded-xl px-4 py-2.5 text-sm" />
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <Button onClick={props.onZurueck} variant="ghost" className="flex-1 justify-center">Zurück</Button>
        <Button onClick={props.onWeiter} disabled={!props.titel.trim()} className="flex-1 justify-center">Weiter</Button>
      </div>
    </div>
  )
}

function OrtStep(props: {
  adresse: string; setAdresse: (v: string) => void
  setAdresseLat: (v: number | null) => void; setAdresseLng: (v: number | null) => void
  wohnungId: string; setWohnungId: (v: string) => void
  onWeiter: () => void; onZurueck: () => void
}) {
  return (
    <div className="animate-fade-in space-y-4">
      <h2 className="text-xl font-semibold mb-2">Wo ist der Schaden?</h2>
      <div>
        <label className="block text-xs text-ink-muted mb-1">Wohnung (optional)</label>
        <input value={props.wohnungId} onChange={e => props.setWohnungId(e.target.value)} placeholder="Wohnungs-ID oder Nummer" className="w-full bg-white border border-line rounded-xl px-4 py-2.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs text-ink-muted mb-1">Einsatzort-Adresse</label>
        <AddressAutocomplete
          value={props.adresse}
          onChange={(adr, geo) => {
            props.setAdresse(adr)
            props.setAdresseLat(geo?.lat ?? null)
            props.setAdresseLng(geo?.lng ?? null)
          }}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={props.onZurueck} variant="ghost" className="flex-1 justify-center">Zurück</Button>
        <Button onClick={props.onWeiter} className="flex-1 justify-center">Weiter</Button>
      </div>
    </div>
  )
}

function ZusammenfassungStep(props: {
  titel: string; beschreibung: string; gewerk: string; dringlichkeit: string
  adresse: string; fotoCount: number; submitting: boolean
  onAbsenden: () => void; onZurueck: () => void
}) {
  return (
    <div className="animate-fade-in space-y-4">
      <h2 className="text-xl font-semibold mb-2">Zusammenfassung</h2>
      <div className="bg-white border border-line rounded-xl p-4 space-y-2 text-sm">
        <div><span className="text-ink-muted">Titel:</span> <span className="font-medium">{props.titel}</span></div>
        <div><span className="text-ink-muted">Gewerk:</span> {formatGewerk(props.gewerk)}</div>
        <div><span className="text-ink-muted">Dringlichkeit:</span> {props.dringlichkeit}</div>
        <div><span className="text-ink-muted">Adresse:</span> {props.adresse || <em className="text-ink-muted">—</em>}</div>
        <div><span className="text-ink-muted">Fotos:</span> {props.fotoCount}</div>
        <div className="text-ink-secondary text-xs pt-2 border-t border-line">{props.beschreibung}</div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={props.onZurueck} variant="ghost" className="flex-1 justify-center" disabled={props.submitting}>Zurück</Button>
        <Button onClick={props.onAbsenden} className="flex-1 justify-center" disabled={props.submitting}>
          {props.submitting ? "Wird gesendet…" : "Schaden melden"}
        </Button>
      </div>
    </div>
  )
}
