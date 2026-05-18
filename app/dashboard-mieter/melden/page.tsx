"use client"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Card } from "@/components/ui"
import AddressAutocomplete from "@/components/AddressAutocomplete"
import { uploadSchadensFoto } from "@/lib/storage/schadens-foto"
import { formatGewerk } from "@/types"

const MAX_FOTO_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_FOTOS = 5
const ERLAUBTE_FOTO_TYPEN = ["image/jpeg", "image/png", "image/webp", "image/heic"]

// LT-2: prioritaet ist jetzt überall planbar/zeitnah/notfall (DB-CHECK
// erweitert via Migration 20260526000000). Die Compat-Map KI_PRIO_MAP
// ist entfernt — KI-API liefert die neuen Werte direkt.
const PRIO_LABELS: Record<string, string> = {
  planbar: "Planbar",
  zeitnah: "Zeitnah",
  notfall: "Notfall",
}
// F2: "Kann warten" klang resignativ und niemand klickte es. "Diese Woche"
// gibt einen konkreten Zeitrahmen, ohne den User in Notfall-Drift zu treiben.
// F2.1 (390-px-Smoke-Befund): vorheriges "Diese Woche OK" brach im 3-cols-
// Grid bei iPhone-Breite um — auf "Diese Woche" gekürzt, Sub-Label bleibt
// jetzt einzeilig.
const PRIO_SUB: Record<string, string> = {
  planbar: "Diese Woche",
  zeitnah: "Bald bitte",
  notfall: "Sofort",
}
// Mapping nur noch defensive Fallback für alte Bookmarks / Drittsysteme,
// die noch die alten Werte schicken könnten.
const PRIO_LEGACY_MAP: Record<string, string> = {
  normal: "planbar",
  hoch: "zeitnah",
  dringend: "notfall",
}
function normalisierePrio(v: string | undefined | null): string {
  if (!v) return "planbar"
  return PRIO_LEGACY_MAP[v] ?? v
}

type Step = "foto" | "analyse" | "details" | "ort" | "dringlichkeit" | "zusammenfassung" | "gesendet"

// KI-1+2: Zeit als Spanne statt Punktschätzung. "sonstiges" hat keine
// Schätzung — wird im UI nicht angezeigt.
const KI_ANALYSEN: Record<string, { titel: string; gewerk: string; dringlichkeit: string; tipp: string; zeit: string | null }> = {
  heizung:   { titel: "Heizung / Warmwasser ausgefallen", gewerk: "heizung_sanitaer", dringlichkeit: "zeitnah",  tipp: "Prüfen Sie ob der Thermostat auf mind. Stufe 3 steht und ob andere Heizkörper betroffen sind.", zeit: "ca. 12-48 Stunden" },
  wasser:    { titel: "Wasserschaden / Feuchtigkeit",     gewerk: "heizung_sanitaer", dringlichkeit: "notfall", tipp: "Hauptwasserhahn zudrehen falls möglich! Handtücher unterlegen um Ausbreitung zu verhindern.",  zeit: "ca. 2-8 Stunden" },
  elektro:   { titel: "Elektroproblem",                   gewerk: "elektro",          dringlichkeit: "zeitnah",     tipp: "Berühren Sie keine freiliegenden Kabel. Schalten Sie die betroffene Sicherung aus.",            zeit: "ca. 6-24 Stunden" },
  tuer:      { titel: "Tür / Fenster defekt",             gewerk: "schreiner",        dringlichkeit: "planbar",   tipp: "Sichern Sie die Stelle provisorisch ab, besonders bei Zugluft oder Einbruchgefahr.",            zeit: "ca. 1-5 Tage" },
  schimmel:  { titel: "Schimmel entdeckt",                gewerk: "maler",            dringlichkeit: "zeitnah",     tipp: "Gut lüften! Nicht selbst mit Bleiche behandeln - das verschlimmert es oft.",                    zeit: "ca. 3-7 Tage" },
  dach:      { titel: "Dachschaden",                       gewerk: "dachdecker",       dringlichkeit: "zeitnah",   tipp: "Bei akuter Undichtigkeit Eimer/Plane unter die Leckstelle. Dach selbst nicht betreten.",        zeit: "ca. 1-5 Tage" },
  fassade:   { titel: "Fassaden-/Außenwandschaden",        gewerk: "maler",            dringlichkeit: "planbar",   tipp: "Lose Putzstücke sichern (Absperrung), damit nichts auf Passanten fällt.",                      zeit: "ca. 3-14 Tage" },
  boden:     { titel: "Bodenschaden",                      gewerk: "bodenleger",       dringlichkeit: "planbar",   tipp: "Schadstelle freihalten und Wasser/Feuchtigkeit fernhalten bis zur Begutachtung.",              zeit: "ca. 2-7 Tage" },
  sonstiges: { titel: "Sonstiger Schaden",                gewerk: "allgemein",        dringlichkeit: "planbar",   tipp: "Je genauer die Beschreibung, desto schneller die Lösung.",                                      zeit: null },
}

// Mapping API-`schadensart` (siehe app/api/ki/schadenserkennung/route.ts
// SYSTEM_PROMPT) → UI-Key in KI_ANALYSEN. Ohne dieses Mapping fiel z.B.
// "sanitaer" (Wasserschaden laut KI) mangels Key auf "sonstiges" zurück
// und der KI-Soforttipp passte nicht zum Schaden.
const SCHADENSART_API_TO_UI: Record<string, keyof typeof KI_ANALYSEN> = {
  sanitaer: "wasser",
  elektrik: "elektro",
  heizung: "heizung",
  fenster_tuer: "tuer",
  dach: "dach",
  fassade: "fassade",
  boden: "boden",
  schimmel: "schimmel",
  sonstiges: "sonstiges",
}

function analyseText(text: string): string {
  const lower = text.toLowerCase()
  if (lower.match(/heiz|warm.?wasser|thermostat|radiator|kalt.*(wohnung|zimmer)/)) return "heizung"
  if (lower.match(/wasser|feucht|tropf|nass|rohr|leck|ueber.?schwemm/)) return "wasser"
  if (lower.match(/strom|elektr|sicher|steck|licht|flacker|kurz.?schluss/)) return "elektro"
  if (lower.match(/tuer|fenster|schloss|klinke|scharnier|glas|zerbroch/)) return "tuer"
  if (lower.match(/schimmel|schwarz.*fleck|pilz|feucht.*wand|stock.?fleck/)) return "schimmel"
  if (lower.match(/dach|ziegel|regen.*decke|tropf.*decke/)) return "dach"
  if (lower.match(/fassade|putz|außen.?wand|aussen.?wand/)) return "fassade"
  if (lower.match(/boden|parkett|laminat|fliesen|teppich/)) return "boden"
  return "sonstiges"
}

export default function MeldenPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("foto")
  const [beschreibung, setBeschreibung] = useState("")
  const [kiResult, setKiResult] = useState<string | null>(null)
  const [form, setForm] = useState<{
    titel: string; beschreibung: string; wohnung: string
    prioritaet: string; gewerk: string
    einsatzort_adresse: string
    einsatzort_lat: number | null
    einsatzort_lng: number | null
  }>({
    titel: "", beschreibung: "", wohnung: "",
    prioritaet: "planbar", gewerk: "allgemein",
    einsatzort_adresse: "", einsatzort_lat: null, einsatzort_lng: null,
  })
  const [loading, setLoading] = useState(false)
  const [analyseProgress, setAnalyseProgress] = useState(0)
  const [error, setError] = useState("")
  // Foto-Upload State — UX-1: bis zu 5 Fotos
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fotoFiles, setFotoFiles] = useState<File[]>([])
  const [fotoPreviewUrls, setFotoPreviewUrls] = useState<string[]>([])
  const [fotoFehler, setFotoFehler] = useState<string | null>(null)
  // KI-Vision-State
  const [kiConfidence, setKiConfidence] = useState<number | null>(null)
  const [kiSchadensart, setKiSchadensart] = useState<string | null>(null)
  const [kiHinweis, setKiHinweis] = useState<string | null>(null)
  // UX-2: ticketTyp/diagnosePreis raus aus Mieter-Flow.
  // Mieter entscheidet nicht ob Diagnose oder Direkt-Reparatur — das
  // ist eine Fachentscheidung des Verwalters nach Sichtung.

  function fotosHinzufuegen(neueFiles: FileList | File[] | null) {
    setFotoFehler(null)
    if (!neueFiles || neueFiles.length === 0) return
    const arr = Array.from(neueFiles)
    const platzFrei = MAX_FOTOS - fotoFiles.length
    if (platzFrei <= 0) {
      setFotoFehler(`Maximal ${MAX_FOTOS} Fotos pro Meldung.`)
      return
    }
    const nehmen = arr.slice(0, platzFrei)
    const akzeptiert: File[] = []
    for (const file of nehmen) {
      if (!ERLAUBTE_FOTO_TYPEN.includes(file.type)) {
        setFotoFehler(`"${file.name}" — nur JPG, PNG, WebP, HEIC erlaubt.`)
        continue
      }
      if (file.size > MAX_FOTO_BYTES) {
        setFotoFehler(`"${file.name}" zu groß (max. ${MAX_FOTO_BYTES / 1024 / 1024} MB).`)
        continue
      }
      akzeptiert.push(file)
    }
    if (akzeptiert.length === 0) return
    setFotoFiles(prev => [...prev, ...akzeptiert])
    setFotoPreviewUrls(prev => [...prev, ...akzeptiert.map(f => URL.createObjectURL(f))])
  }

  function fotoEntfernen(idx: number) {
    setFotoFiles(prev => prev.filter((_, i) => i !== idx))
    setFotoPreviewUrls(prev => {
      const next = prev.filter((_, i) => i !== idx)
      const remove = prev[idx]
      if (remove) URL.revokeObjectURL(remove)
      return next
    })
  }

  // Cleanup aller ObjectURLs beim Unmount
  useEffect(() => {
    return () => {
      fotoPreviewUrls.forEach(u => URL.revokeObjectURL(u))
    }
    // Nur bei Unmount — fotoEntfernen kümmert sich sonst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // TODO: sobald Supabase Storage Bucket "ticket-fotos" konfiguriert ist,
  // hier den eigentlichen Upload einbauen und die URL ans Ticket schreiben.
  // Beispiel: supabase.storage.from('ticket-fotos').upload(`${user.id}/${Date.now()}_${fotoFile.name}`, fotoFile)

  function startAnalyse() {
    if (!beschreibung.trim() && fotoFiles.length === 0) return
    setStep("analyse")
    setAnalyseProgress(0)
    setKiConfidence(null)
    setKiSchadensart(null)
    setKiHinweis(null)

    const interval = setInterval(() => {
      setAnalyseProgress(p => {
        if (p >= 95) return p
        return p + Math.random() * 15 + 5
      })
    }, 200)

    void (async () => {
      // KI-Vision-Pfad wenn mindestens ein Foto vorhanden ist
      // (das erste Foto liefert die Klassifikation; weitere sind nur
      // zusätzliche Beleg-Bilder fürs Ticket).
      const ersteFoto = fotoFiles[0]
      if (ersteFoto) {
        try {
          const fd = new FormData()
          fd.append("foto", ersteFoto)
          const res = await fetch("/api/ki/schadenserkennung", { method: "POST", body: fd })
          if (res.ok) {
            const data = await res.json() as {
              schadensart: string
              gewerk: string
              dringlichkeit: string
              titel_vorschlag: string
              beschreibung_vorschlag: string
              confidence: number
              hinweis?: string
            }
            clearInterval(interval)
            setAnalyseProgress(100)
            setKiConfidence(data.confidence)
            setKiSchadensart(data.schadensart)
            setKiHinweis(data.hinweis ?? null)
            setKiResult(SCHADENSART_API_TO_UI[data.schadensart] ?? "sonstiges")
            setForm(f => ({
              ...f,
              titel: data.titel_vorschlag,
              beschreibung: data.beschreibung_vorschlag || beschreibung,
              // KI-API liefert manchmal notfall/zeitnah/planbar — auf den
              // DB-CHECK-konformen Wert mappen.
              prioritaet: normalisierePrio(data.dringlichkeit),
              gewerk: data.gewerk,
            }))
            setTimeout(() => setStep("details"), 500)
            return
          }
          // bei nicht-ok auf Regex-Fallback runterfallen
        } catch {
          // ebenfalls Fallback
        }
      }

      // Regex-Fallback (Text-Analyse) — funktioniert ohne API-Key
      const kategorie = analyseText(beschreibung)
      const analyse = KI_ANALYSEN[kategorie]
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
    })()
  }

  async function handleSubmit() {
    setLoading(true); setError("")
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    // UX-1: Alle Fotos hochladen (best-effort). foto_url = erstes Foto
    // (Backwards-Compat für Cards/OG); foto_urls = alle Pfade inkl. erstes.
    const pfade: string[] = []
    for (const file of fotoFiles) {
      const result = await uploadSchadensFoto(supabase, user.id, file)
      if ("pfad" in result) {
        pfade.push(result.pfad)
      } else {
        console.warn("[Foto-Upload]", result.fehler)
      }
    }
    const fotoPfad: string | null = pfade[0] ?? null

    // UX-2: Diagnose-Wahl raus aus Mieter-Flow. Status immer 'offen' —
    // Verwalter entscheidet später ob ticket_typ='diagnose' oder direkter
    // Auktions-Start.
    const basisPayload: Record<string, unknown> = {
      titel: form.titel,
      beschreibung: form.beschreibung,
      wohnung: form.wohnung,
      prioritaet: form.prioritaet,
      gewerk: form.gewerk,
      status: "offen",
      erstellt_von: user.id,
      einsatzort_adresse: form.einsatzort_adresse || null,
      einsatzort_lat: form.einsatzort_lat,
      einsatzort_lng: form.einsatzort_lng,
      foto_url: fotoPfad,
      foto_urls: pfade,
      ticket_typ: "standard",
    }
    const mitKi = {
      ...basisPayload,
      ki_confidence: kiConfidence,
      ki_schadensart: kiSchadensart,
    }

    let dbError = (await supabase.from("tickets").insert(mitKi)).error
    if (dbError && /ki_confidence|ki_schadensart/i.test(dbError.message)) {
      // KI-Spalten fehlen → ohne sie retry
      dbError = (await supabase.from("tickets").insert(basisPayload)).error
    }
    if (dbError && /foto_urls/i.test(dbError.message)) {
      // foto_urls-Migration noch nicht in Live-DB → ohne sie retry
      const { foto_urls: _ignored, ...ohneFotos } = basisPayload
      void _ignored
      dbError = (await supabase.from("tickets").insert(ohneFotos)).error
    }
    if (dbError && /ticket_typ/i.test(dbError.message)) {
      const { ticket_typ: _ignored, ...ohneTicketTyp } = basisPayload
      void _ignored
      dbError = (await supabase.from("tickets").insert(ohneTicketTyp)).error
    }
    if (dbError) { setError("Fehler: " + dbError.message); setLoading(false); return }
    setStep("gesendet")
    setLoading(false)
  }

  // F3.1 (Cowork-Regression-Befund): Vorher gewann reverseGewerkKey über
  // kiResult — aber zwei UI-Keys (heizung + wasser) teilen sich denselben
  // gewerk-Wert "heizung_sanitaer". Bei Wasserschaden lieferte die KI
  // schadensart=sanitaer → kiResult=wasser, und in setForm wird gewerk=
  // "heizung_sanitaer" geschrieben. Das reverse-Lookup traf dann durch
  // Iterationsreihenfolge zuerst "heizung" — der Tipp wurde Thermostat-
  // Heizung statt Hauptwasserhahn-Wasserschaden.
  //
  // Fix: kiResult (Schadensart-Klassifikation) ist authoritativer als die
  // Gewerk-Rückleitung. reverseGewerkKey wirkt nur noch als Fallback,
  // falls kein kiResult vorliegt (Edge-Case ohne KI-Analyse).
  const reverseGewerkKey = (() => {
    const g = form.gewerk?.toLowerCase()
    if (!g) return null
    for (const [key, v] of Object.entries(KI_ANALYSEN)) {
      if (v.gewerk === g) return key
    }
    return null
  })()
  const analyse = (kiResult && KI_ANALYSEN[kiResult])
    || (reverseGewerkKey && KI_ANALYSEN[reverseGewerkKey])
    || null
  const wizardSteps = ["foto", "analyse", "details", "ort", "dringlichkeit", "zusammenfassung", "gesendet"] as const
  const stepIndex = wizardSteps.indexOf(step)
  // Audit-Befund: Zurück sprang via router.back() aus dem Wizard raus und
  // verwarf alle bisherigen Eingaben. Stattdessen: einen Step zurück, und
  // nur wenn schon auf Schritt 1 (oder bereits gesendet), dann zur App.
  const goBack = () => {
    if (stepIndex <= 0 || step === "gesendet") {
      router.push("/dashboard-mieter")
      return
    }
    setStep(wizardSteps[stepIndex - 1])
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* Header */}
      <div className="px-6 py-4 border-b border-line">
        <div className="flex items-center justify-between max-w-xl mx-auto">
          <button onClick={goBack} className="text-sm text-ink-muted hover:text-ink">&larr; Zurück</button>
          <h1 className="text-sm font-medium text-ink">Schaden melden</h1>
          <span className="text-xs text-ink-faint">{Math.min(stepIndex + 1, 5)}/5</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-0.5 bg-surface-muted">
        <div className="h-full bg-gradient-to-r from-[#3D8B7A] to-[#4A9E8C] transition-all duration-700" style={{ width: Math.min((stepIndex + 1) / 5 * 100, 100) + "%" }} />
      </div>

      <div className="max-w-xl mx-auto px-6 py-8">

        {/* STEP 1: Foto + Beschreibung */}
        {step === "foto" && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">AI</span>
              </div>
              <h2 className="text-xl font-semibold mb-2">Was ist passiert?</h2>
              <p className="text-sm text-ink-muted">Beschreibe den Schaden -- unsere KI erkennt automatisch Kategorie, Gewerk und Dringlichkeit.</p>
            </div>

            {/* Foto Upload Area — UX-1: bis zu 5 Fotos als Grid */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              capture="environment"
              multiple
              onChange={e => { fotosHinzufuegen(e.target.files); if (fileInputRef.current) fileInputRef.current.value = "" }}
              className="hidden"
              aria-label="Fotos auswählen"
            />

            {fotoPreviewUrls.length > 0 ? (
              <div className="mb-6">
                <div className="grid grid-cols-3 gap-2">
                  {fotoPreviewUrls.map((url, i) => (
                    <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-line bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => fotoEntfernen(i)}
                        aria-label={`Foto ${i + 1} entfernen`}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[#2D2A26]/80 text-white flex items-center justify-center text-xs hover:bg-[#2D2A26] transition-colors"
                      >
                        ×
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 text-[9px] font-bold uppercase tracking-wider bg-accent text-white px-1.5 py-0.5 rounded">
                          Haupt
                        </span>
                      )}
                    </div>
                  ))}
                  {fotoFiles.length < MAX_FOTOS && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-line hover:border-accent/40 hover:bg-surface transition-colors flex flex-col items-center justify-center gap-1 text-ink-muted hover:text-accent"
                    >
                      <span className="text-2xl leading-none">+</span>
                      <span className="text-[10px]">Foto</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-ink-muted mt-2">
                  {fotoFiles.length} von {MAX_FOTOS} Fotos · erstes Foto wird KI-analysiert
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-line rounded-2xl p-8 text-center mb-6 hover:border-accent/40 hover:bg-surface transition-colors cursor-pointer flex flex-col items-center"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <p className="text-sm text-ink font-medium">Fotos aufnehmen oder hochladen</p>
                <p className="text-xs text-ink-muted mt-1">JPG, PNG, WebP — max. 5 MB pro Foto, bis zu {MAX_FOTOS} Fotos · optional</p>
              </button>
            )}

            {fotoFehler && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger">
                {fotoFehler}
              </div>
            )}

            {/* Text Beschreibung */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-ink-muted mb-2">Oder beschreibe den Schaden</label>
              <textarea
                value={beschreibung}
                onChange={e => setBeschreibung(e.target.value)}
                placeholder="z.B. Wasser tropft von der Decke im Bad, der Fleck wird groesser..."
                rows={4}
                className="w-full bg-white border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-[#B5AEA4] focus:outline-none focus:border-accent/50 resize-none"
              />
            </div>

            {/* F1: Quick-Select Buttons als optionale Inspiration deklarieren.
                Vorher wirkten sie wie eine Pflicht-Auswahl mit fixen Kategorien
                und der Klick überschrieb stillschweigend die Beschreibung.
                Jetzt klar gelabelt: nur Starttext, der Mieter ergänzt selbst. */}
            <div className="mb-6">
              <p className="text-xs text-ink-muted mb-1">
                Hilfe für den Anfang <span className="text-ink-faint font-normal">(optional)</span>
              </p>
              <p className="text-[11px] text-ink-faint mb-2">
                Setzt einen Beispieltext ein, den du danach noch anpasst.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Heizung aus", icon: "!", val: "Heizung funktioniert nicht mehr, Wohnung wird kalt" },
                  { label: "Wasserschaden", icon: "~", val: "Wasser tropft oder läuft aus, Feuchtigkeit an Wand" },
                  { label: "Strom/Elektrik", icon: "#", val: "Strom ausgefallen oder Steckdose funktioniert nicht" },
                  { label: "Tür/Fenster", icon: "|", val: "Tür oder Fenster lässt sich nicht richtig schließen" },
                  { label: "Schimmel", icon: "o", val: "Schimmelflecken an Wand oder Decke entdeckt" },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => { setBeschreibung(item.val); }}
                    className="text-xs bg-surface-muted hover:bg-accent/10 border border-line hover:border-accent/30 rounded-full px-3 py-1.5 transition-all text-ink-muted hover:text-accent"
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
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6 animate-pulse">
              <span className="text-2xl">AI</span>
            </div>
            <h2 className="text-lg font-semibold mb-2">KI analysiert deinen Schaden...</h2>
            <p className="text-sm text-ink-muted mb-8">Kategorie, Gewerk und Dringlichkeit werden erkannt</p>
            <div className="w-64 h-2 bg-surface-muted rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#3D8B7A] to-[#4A9E8C] rounded-full transition-all duration-300" style={{ width: Math.min(analyseProgress, 100) + "%" }} />
            </div>
            <div className="mt-4 space-y-2 text-xs text-ink-muted">
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
              <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-4">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-xs text-accent font-medium">KI-Analyse abgeschlossen</span>
                {kiConfidence != null && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ml-1 ${
                    kiConfidence >= 0.8
                      ? "bg-accent text-white"
                      : kiConfidence >= 0.5
                      ? "bg-warm text-white"
                      : "bg-[#C4574B] text-white"
                  }`}>
                    {kiConfidence >= 0.8 ? "Sicher" : kiConfidence >= 0.5 ? "Vorschlag" : "Bitte prüfen"} · {Math.round(kiConfidence * 100)} %
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold">{form.titel || analyse.titel}</h2>
              {kiHinweis && (
                <p className="text-xs text-warm mt-2 italic max-w-md mx-auto">
                  💡 Hinweis der KI: {kiHinweis}
                </p>
              )}
            </div>

            {/* KI Insight Card */}
            <Card className="mb-4 bg-white border border-line">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-[10px] text-ink-muted uppercase tracking-wider mb-1">Dringlichkeit</div>
                  <div className={"text-sm font-semibold " + (form.prioritaet === "notfall" ? "text-danger" : form.prioritaet === "zeitnah" ? "text-[#B07A3B]" : "text-accent")}>
                    {(PRIO_LABELS[form.prioritaet] ?? "Planbar").toUpperCase()}
                  </div>
                </div>
                <div>
                  {/* F4: vorher "Geschätzte Zeit" — suggerierte fälschlich,
                      dass die Dringlichkeitsstufe die Dauer ändert. Jetzt
                      klar als typische Reparaturdauer gelabelt, unabhängig
                      von "Notfall/Zeitnah/Planbar". */}
                  <div className="text-[10px] text-ink-muted uppercase tracking-wider mb-1">Typische Dauer</div>
                  <div className="text-sm font-semibold text-ink">
                    {analyse.zeit ?? "Nach Besichtigung"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-muted uppercase tracking-wider mb-1">Fachgebiet</div>
                  <div className="text-sm font-semibold text-ink">{formatGewerk(form.gewerk)}</div>
                </div>
              </div>
            </Card>

            {/* KI-1: Disclaimer dass die Schätzung unverbindlich ist */}
            <p className="text-[11px] text-ink-faint mb-4 leading-relaxed">
              Unverbindliche Ersteinschätzung — der finale Preis und die genaue
              Bearbeitungszeit werden vom Handwerker nach Sichtung bestimmt.
            </p>

            {/* KI Tipp */}
            <div className="bg-[#FFF3E8] border border-warm/15 rounded-xl px-4 py-3 mb-6">
              <div className="flex items-start gap-2">
                <span className="text-[#B07A3B] text-sm mt-0.5">!</span>
                <div>
                  <div className="text-xs font-medium text-[#B07A3B] mb-0.5">KI-Soforttipp</div>
                  <p className="text-xs text-ink-muted">{analyse.tipp}</p>
                </div>
              </div>
            </div>

            {/* Beschreibung Review */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-ink-muted mb-2">Deine Beschreibung</label>
              <textarea
                value={form.beschreibung}
                onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
                rows={3}
                className="w-full bg-white border border-line rounded-xl px-4 py-3 text-sm text-ink focus:outline-none focus:border-accent/50 resize-none"
              />
            </div>

            {/* LT-2: Werte jetzt planbar/zeitnah/notfall — Default "planbar".
                User stuft bewusst hoch wenn nötig. */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-ink-muted mb-2">Dringlichkeit</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: "planbar", color: "border-accent/30 bg-accent/5 text-accent" },
                  { val: "zeitnah", color: "border-warm/30 bg-[#FFF3E8] text-[#B07A3B]" },
                  { val: "notfall", color: "border-danger/30 bg-danger-light text-danger" },
                ].map(d => (
                  <button
                    key={d.val}
                    onClick={() => setForm(f => ({ ...f, prioritaet: d.val }))}
                    className={"rounded-xl px-2 py-3 border text-center transition-all " + (form.prioritaet === d.val ? d.color : "border-line bg-surface-muted text-ink-muted")}
                  >
                    <div className="text-sm font-medium whitespace-nowrap">{PRIO_LABELS[d.val]}</div>
                    <div className="text-[10px] mt-0.5 opacity-70 whitespace-nowrap">{PRIO_SUB[d.val]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* UX-2: Diagnose-vs-Direkt-Wahl entfernt — gehört in den
                Verwalter-Flow (Fachentscheidung nach Sichtung), nicht
                ins Mieter-UI. */}

            <Button onClick={() => setStep("ort")} className="w-full justify-center">
              Weiter -- Ort angeben
            </Button>
          </div>
        )}

        {/* STEP 4: Ort */}
        {step === "ort" && (
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold mb-2">Wo ist das Problem?</h2>
            <p className="text-sm text-ink-muted mb-6">Adresse und Raum angeben — damit der Handwerker dich findet.</p>

            <div className="mb-5">
              <AddressAutocomplete
                label="Adresse des Gebäudes"
                placeholder="Straße, Hausnummer, Ort"
                initialAdresse={form.einsatzort_adresse}
                onSelect={({ adresse, lat, lng }) =>
                  setForm(f => ({
                    ...f,
                    einsatzort_adresse: adresse,
                    einsatzort_lat: lat,
                    einsatzort_lng: lng,
                  }))
                }
              />
            </div>

            <div className="mb-4">
              <label className="text-xs text-ink-muted mb-1.5 block font-medium">
                Wohnung / Raum <span className="text-ink-faint font-normal">(optional)</span>
              </label>
              <input
                value={form.wohnung}
                onChange={e => setForm(f => ({ ...f, wohnung: e.target.value }))}
                placeholder="z.B. Whg. 3 OG, Bad"
                className="w-full bg-white border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-[#B5AEA4] focus:outline-none focus:border-accent/50"
              />
            </div>

            <div className="mb-6">
              <p className="text-xs text-ink-muted mb-2">Schnellauswahl Raum (optional):</p>
              <div className="flex flex-wrap gap-2">
                {["Küche", "Bad", "Wohnzimmer", "Schlafzimmer", "Flur", "Keller", "Balkon"].map(r => {
                  // BUG-1: Active-State pro Chip — vorher war jedes selektierte
                  // Chip visuell identisch mit den nicht-selektierten ("Bad" sah
                  // genauso aus wie Küche), Toggle-Verhalten fehlte ganz.
                  // Jetzt: Wort als ", "-getrennter Token im Wohnung-Feld;
                  // Klick toggled add/remove und Chip bekommt active-Style.
                  const tokens = form.wohnung.split(",").map(t => t.trim()).filter(Boolean)
                  const isActive = tokens.includes(r)
                  function toggle() {
                    if (isActive) {
                      const next = tokens.filter(t => t !== r).join(", ")
                      setForm(f => ({ ...f, wohnung: next }))
                    } else {
                      const next = form.wohnung.trim() ? form.wohnung.trim().replace(/,\s*$/, "") + ", " + r : r
                      setForm(f => ({ ...f, wohnung: next }))
                    }
                  }
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={toggle}
                      aria-pressed={isActive}
                      className={`text-xs rounded-full px-3 py-1.5 transition-all border ${
                        isActive
                          ? "bg-accent text-white border-accent shadow-sm"
                          : "bg-surface-muted text-ink-muted border-line hover:bg-accent/10 hover:border-accent/30 hover:text-accent"
                      }`}
                    >
                      {r}
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              onClick={() => setStep("zusammenfassung")}
              disabled={!form.einsatzort_adresse.trim()}
              className="w-full justify-center"
            >
              Weiter — Zusammenfassung
            </Button>
          </div>
        )}

        {/* STEP 5: Zusammenfassung */}
        {step === "zusammenfassung" && analyse && (
          <div className="animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold">Meldung prüfen</h2>
              <p className="text-sm text-ink-muted">Alles korrekt? Dann ab damit.</p>
            </div>

            <Card className="mb-6 bg-white border border-line">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-ink-muted">Problem</span>
                  <span className="text-sm font-medium text-ink text-right">{form.titel}</span>
                </div>
                <div className="border-t border-line" />
                <div className="flex justify-between items-start">
                  <span className="text-xs text-ink-muted">Beschreibung</span>
                  <span className="text-sm text-ink text-right max-w-[65%]">{form.beschreibung}</span>
                </div>
                <div className="border-t border-line" />
                <div className="flex justify-between">
                  <span className="text-xs text-ink-muted">Ort</span>
                  <span className="text-sm text-ink">{form.wohnung}</span>
                </div>
                <div className="border-t border-line" />
                <div className="flex justify-between">
                  <span className="text-xs text-ink-muted">Dringlichkeit</span>
                  <span className={"text-sm font-medium " + (form.prioritaet === "notfall" ? "text-danger" : form.prioritaet === "zeitnah" ? "text-[#B07A3B]" : "text-accent")}>
                    {PRIO_LABELS[form.prioritaet] ?? form.prioritaet}
                  </span>
                </div>
                <div className="border-t border-line" />
                <div className="flex justify-between">
                  <span className="text-xs text-ink-muted">Typische Reparaturdauer</span>
                  <span className="text-sm text-ink">{analyse.zeit ?? "Nach Besichtigung"}</span>
                </div>
              </div>
            </Card>

            {/* Was passiert als naechstes */}
            <div className="bg-accent/5 border border-accent/10 rounded-xl px-4 py-3 mb-6">
              <div className="text-xs font-medium text-accent mb-2">Was passiert jetzt?</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <div className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center text-[8px] text-accent font-bold">1</div>
                  Hausverwaltung wird sofort benachrichtigt
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <div className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center text-[8px] text-accent font-bold">2</div>
                  Verwalter prüft und bewertet deine Meldung
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <div className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center text-[8px] text-accent font-bold">3</div>
                  Passende Handwerker-Stunden werden auf dem Marktplatz gebucht
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <div className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center text-[8px] text-accent font-bold">4</div>
                  Du wirst über jeden Schritt informiert
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-danger bg-danger-light border border-danger/15 px-4 py-2.5 rounded-xl mb-4">{error}</p>}

            <div className="flex gap-3">
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 justify-center">
                {loading ? "Wird gesendet..." : "Meldung absenden"}
              </Button>
              <button onClick={() => setStep("details")} className="text-sm text-ink-muted hover:text-ink px-4">Zurueck</button>
            </div>
          </div>
        )}

        {/* STEP 6: Gesendet — UX-5: kürzer, kein 5-Step-Pipeline mehr.
            Die gehört in die Ticket-Detail-Ansicht, nicht aufs Confirm. */}
        {step === "gesendet" && (
          <div className="animate-fade-in text-center py-12">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl text-accent">✓</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Schaden erfolgreich gemeldet</h2>
            <p className="text-sm text-ink-muted mb-8 max-w-sm mx-auto">
              Deine Hausverwaltung prüft die Meldung und meldet sich bei dir.
              Status-Updates findest du in &bdquo;Meine Meldungen&ldquo;.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => router.push("/dashboard-mieter")}>Meine Meldungen</Button>
              <Button variant="ghost" onClick={() => {
                setStep("foto")
                setBeschreibung("")
                setKiResult(null)
                setFotoFiles([])
                fotoPreviewUrls.forEach(u => URL.revokeObjectURL(u))
                setFotoPreviewUrls([])
                setForm({ titel: "", beschreibung: "", wohnung: "", prioritaet: "planbar", gewerk: "allgemein", einsatzort_adresse: "", einsatzort_lat: null, einsatzort_lng: null })
              }}>
                Weiteren Schaden melden
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
            }
