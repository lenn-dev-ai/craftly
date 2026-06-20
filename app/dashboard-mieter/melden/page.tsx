"use client"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Card } from "@/components/ui"
import AddressAutocomplete from "@/components/AddressAutocomplete"
import { uploadSchadensFoto } from "@/lib/storage/schadens-foto"
import { formatGewerk } from "@/types"
import { authFetch } from "@/lib/auth/clientFetch"

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

type Step = "foto" | "analyse" | "details" | "ort" | "zusammenfassung" | "gesendet"

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
    wohneinheit_referenz: string
    prioritaet: string; gewerk: string
    einsatzort_adresse: string
    einsatzort_lat: number | null
    einsatzort_lng: number | null
  }>({
    titel: "", beschreibung: "", wohnung: "", wohneinheit_referenz: "",
    prioritaet: "planbar", gewerk: "allgemein",
    einsatzort_adresse: "", einsatzort_lat: null, einsatzort_lng: null,
  })
  const [loading, setLoading] = useState(false)
  const [analyseProgress, setAnalyseProgress] = useState(0)
  const [error, setError] = useState("")
  const [rückrufInitiert, setRückrufInitiert] = useState<boolean | null>(null)
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

  // F2: Default-Wohnung aus dem Mieter-Profil. Wenn vorhanden, kommt im
  // ort-Step eine Pill ("📍 Meine Wohnung") statt des Adress-Felds; mit
  // Toggle auf manuelle Eingabe für Sonderfälle (Schaden im Treppenhaus,
  // Adresse eines Bekannten, etc.).
  const [profilWohnung, setProfilWohnung] = useState<{ adresse: string; lat: number | null; lng: number | null } | null>(null)
  const [nutzeProfilWohnung, setNutzeProfilWohnung] = useState(true)

  // Sprint BA: Wohneinheiten aus wohnungen-Tabelle (verlinkt via mieter_id)
  interface WohnungMini {
    id: string
    whg_bezeichnung: string | null
    strasse: string
    hausnummer: string
    plz: string
    ort: string
  }
  const [meineWohnungen, setMeineWohnungen] = useState<WohnungMini[]>([])
  const [gewaehltWohnungId, setGewaehltWohnungId] = useState<string | null>(null)
  const gewaehltWohnung = meineWohnungen.find(w => w.id === gewaehltWohnungId) ?? null

  // Sprint AF Phase 1: Pills werden dynamisch vom Server geholt (saisonal
  // + Verwalter-spezifisch). Fallback auf statische Liste wenn API fehlt.
  type PillItem = { key: string; label: string; icon: string; startText: string; gewerkHint: string }
  const STATIC_PILLS_FALLBACK: PillItem[] = [
    { key: "heizung",  label: "Heizung aus",     icon: "!", startText: "Heizung funktioniert nicht mehr, Wohnung wird kalt", gewerkHint: "heizung_sanitaer" },
    { key: "wasser",   label: "Wasserschaden",   icon: "~", startText: "Wasser tropft oder läuft aus, Feuchtigkeit an Wand",  gewerkHint: "heizung_sanitaer" },
    { key: "elektro",  label: "Strom/Elektrik",  icon: "#", startText: "Strom ausgefallen oder Steckdose funktioniert nicht", gewerkHint: "elektro" },
    { key: "tuer",     label: "Tür/Fenster",     icon: "|", startText: "Tür oder Fenster lässt sich nicht richtig schließen", gewerkHint: "schreiner" },
    { key: "schimmel", label: "Schimmel",        icon: "o", startText: "Schimmelflecken an Wand oder Decke entdeckt",          gewerkHint: "maler" },
  ]
  const [dynPills, setDynPills] = useState<PillItem[]>(STATIC_PILLS_FALLBACK)
  // Sprint AF Phase 2: Foto-Prescan-Result — hebt die wahrscheinlichste Pill hervor
  // sobald das erste Foto hochgeladen ist. Hintergrund-Call, non-blocking.
  const [likelyPill, setLikelyPill] = useState<string | null>(null)
  useEffect(() => {
    let aktiv = true
    void (async () => {
      try {
        const res = await fetch("/api/melden/pills", { cache: "default" })
        if (!res.ok) return
        const data = await res.json() as { pills?: PillItem[] }
        if (aktiv && Array.isArray(data.pills) && data.pills.length > 0) {
          setDynPills(data.pills)
        }
      } catch {
        // Stiller Fallback auf statische Pills
      }
    })()
    return () => { aktiv = false }
  }, [])

  // Sprint AF Phase 2: Foto-Prescan sobald sich fotoFiles[0] ändert.
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
      } catch {
        // Stiller Fallback — kein Highlight
      }
    })()
    return () => { aktiv = false }
  }, [fotoFiles])

  // Profil-Adresse + verknüpfte Wohneinheiten laden — beim Mount, damit
  // beim Wechsel auf Step "ort" schon vorbefüllt ist.
  useEffect(() => {
    let aktiv = true
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Profil-Adresse (Fallback wenn keine wohnungen-Zeile vorhanden)
      const { data: prof } = await supabase
        .from("profiles")
        .select("adresse, lat, lng")
        .eq("id", user.id)
        .maybeSingle<{ adresse: string | null; lat: number | null; lng: number | null }>()
      if (aktiv && prof?.adresse) {
        setProfilWohnung({ adresse: prof.adresse, lat: prof.lat, lng: prof.lng })
        setForm(f => f.einsatzort_adresse ? f : ({
          ...f,
          einsatzort_adresse: prof.adresse!,
          einsatzort_lat: prof.lat,
          einsatzort_lng: prof.lng,
        }))
      }

      // Sprint BA: Verknüpfte Wohneinheiten (wohnungen.mieter_id = user.id)
      // RLS-Policy "wohnungen_mieter_select" nötig (Migration sprint_ba_...).
      const { data: wohnungenData } = await supabase
        .from("wohnungen")
        .select("id, whg_bezeichnung, strasse, hausnummer, plz, ort")
        .eq("mieter_id", user.id)
      if (!aktiv) return
      if (wohnungenData && wohnungenData.length > 0) {
        setMeineWohnungen(wohnungenData as WohnungMini[])
        // Genau eine Wohnung → sofort vorauswählen und Felder befüllen
        if (wohnungenData.length === 1) {
          const w = wohnungenData[0] as WohnungMini
          const adresse = `${w.strasse} ${w.hausnummer}, ${w.plz} ${w.ort}`
          setGewaehltWohnungId(w.id)
          setForm(f => ({
            ...f,
            einsatzort_adresse: adresse,
            einsatzort_lat: null,
            einsatzort_lng: null,
            wohneinheit_referenz: w.id,
            wohnung: w.whg_bezeichnung ?? f.wohnung,
          }))
        }
      }
    })()
    return () => { aktiv = false }
  }, [])

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
          const res = await authFetch("/api/ki/schadenserkennung", { method: "POST", body: fd })
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
      wohneinheit_referenz: form.wohneinheit_referenz.trim() || null,
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

    type InsertResult = { id: string }
    let r = await supabase.from("tickets").insert(mitKi).select("id").single<InsertResult>()
    if (r.error && /ki_confidence|ki_schadensart/i.test(r.error.message)) {
      r = await supabase.from("tickets").insert(basisPayload).select("id").single<InsertResult>()
    }
    if (r.error && /foto_urls/i.test(r.error.message)) {
      const { foto_urls: _ignored, ...ohneFotos } = basisPayload; void _ignored
      r = await supabase.from("tickets").insert(ohneFotos).select("id").single<InsertResult>()
    }
    if (r.error && /ticket_typ/i.test(r.error.message)) {
      const { ticket_typ: _ignored, ...ohneTicketTyp } = basisPayload; void _ignored
      r = await supabase.from("tickets").insert(ohneTicketTyp).select("id").single<InsertResult>()
    }
    if (r.error) { setError("Fehler: " + r.error.message); setLoading(false); return }

    // Sprint BD — Auto-Vergabe: KI startet die Vergabe-Engine direkt nach
    // der Meldung (Sicherheitsnetz: aus dem Mieter-Kontext startet nur ein
    // Notfall sofort, zeitnah/planbar warten auf Verwalter-Freigabe).
    // Best-effort — blockiert die Meldung nicht.
    if (r.data?.id) {
      try {
        await authFetch(`/api/tickets/${r.data.id}/auto-vergabe`, { method: "POST" })
      } catch { /* Best-effort — Vergabe-Fehler blockiert die Meldung nicht */ }
    }

    // Voice-AI V2: Outbound-Rückruf bei lückenhaftem Ticket (fire-and-forget)
    let rückruf = false
    if (r.data?.id) {
      try {
        const res = await authFetch("/api/vapi/trigger-rueckruf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket_id: r.data.id }),
        })
        if (res.ok) {
          const json = await res.json() as { initiated?: boolean }
          rückruf = json.initiated === true
        }
      } catch { /* Best-effort — Rückruf-Fehler blockiert Ticket-Meldung nicht */ }
    }
    setRückrufInitiert(rückruf)
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
  const wizardSteps = ["foto", "analyse", "details", "ort", "zusammenfassung", "gesendet"] as const
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
      {/* M1: Auf Mobile braucht der Header links Platz für den fixen
          Sidebar-Hamburger (top-4 left-4, 40 × 40 px). Vorher schob die
          Hamburger-Klick-Fläche den "← Zurück"-Text + die Step-Zahl unter
          sich — "urück" / "ist das Problem?" / fehlende "2/5".
          pl-14 (= 56 px) lässt den Hamburger frei, md:px-6 stellt das
          Desktop-Layout wieder her. */}
      <div className="pl-14 pr-6 md:px-6 py-4 border-b border-line">
        <div className="flex items-center justify-between gap-3 max-w-xl mx-auto">
          <button onClick={goBack} className="text-sm text-ink-muted hover:text-ink whitespace-nowrap">&larr; Zurück</button>
          <h1 className="text-sm font-medium text-ink truncate">Schaden melden</h1>
          {/* M2: text-ink-faint war so blass, dass der Counter optisch
              hinter Pills/Animationen in folgenden Steps verschwand.
              Mehr Contrast + tabular-nums + monospace-Feel. */}
          <span className="text-xs font-medium text-ink-muted tabular-nums whitespace-nowrap">{Math.min(stepIndex + 1, 5)}/5</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-0.5 bg-surface-muted">
        <div className="h-full bg-gradient-to-r from-[#3D8B7A] to-[#4A9E8C] transition-all duration-700" style={{ width: Math.min((stepIndex + 1) / 5 * 100, 100) + "%" }} />
      </div>

      {/* M5: Content-Container ist wieder symmetrisch zentriert.
          Vorheriges pl-14 (M1.1) hat den Wizard auf Desktop und Mobile
          asymmetrisch nach rechts verschoben (Cowork-Befund). Der
          Hamburger sitzt im Top-Header (fixed y=16–56 px), den der
          Content-Container y-mäßig nicht mehr berührt — pl-14 hier ist
          unnötig. Falls ein <h2> doch mal unter den Hamburger rutscht,
          gehört der Fix auf das h2, nicht auf den ganzen Wizard. */}
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
                <p className="text-xs text-ink-muted mt-1">JPG, PNG, WebP — max. 5 MB pro Foto, bis zu {MAX_FOTOS} Fotos</p>
                <p className="text-[11px] text-accent mt-2">
                  💡 Mit Foto erkennt die KI den Schaden präziser — ohne Foto nur Text-Analyse
                </p>
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
                Hilfe für den Anfang <span className="text-ink-muted font-normal">(optional)</span>
              </p>
              <p className="text-[11px] text-ink-muted mb-2">
                Setzt einen Beispieltext ein, den du danach noch anpasst.
              </p>
              <div className="flex flex-wrap gap-2">
                {/* Sprint AF Phase 1: dynPills statt hardcoded — saisonal +
                    Verwalter-Kontext. Fallback auf statische 5 wenn API down.
                    Sprint AF Phase 2: Foto-Prescan-Pill wird hervorgehoben (✓). */}
                {dynPills.map(item => {
                  const highlight = likelyPill === item.key
                  return (
                    <button
                      key={item.key}
                      onClick={() => { setBeschreibung(item.startText); }}
                      className={`text-xs border rounded-full px-3 py-1.5 transition-all ${
                        highlight
                          ? "bg-accent/20 border-accent text-accent ring-2 ring-accent/30"
                          : "bg-surface-muted hover:bg-accent/10 border-line hover:border-accent/30 text-ink-muted hover:text-accent"
                      }`}
                    >
                      {highlight && "✓ "}{item.icon} {item.label}
                    </button>
                  )
                })}
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
            <p className="text-[11px] text-ink-muted mb-4 leading-relaxed">
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
              Weiter — Ort angeben
            </Button>
          </div>
        )}

        {/* STEP 4: Ort */}
        {step === "ort" && (
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold mb-2">Wo ist das Problem?</h2>
            <p className="text-sm text-ink-muted mb-6">Adresse und Raum angeben — damit der Handwerker dich findet.</p>

            {/* Sprint BA: Wohneinheit aus wohnungen-Tabelle (Picker) — Prio vor profilWohnung */}
            {meineWohnungen.length > 0 && nutzeProfilWohnung ? (
              <div className="mb-5">
                {gewaehltWohnung ? (
                  /* Ausgewählte Wohnung — Pill analog zum profilWohnung-Design */
                  <div className="bg-accent/5 border border-accent/30 rounded-xl p-4">
                    <div className="text-[10px] uppercase tracking-wider text-accent font-bold mb-1">Meine Wohnung</div>
                    <div className="text-sm text-ink leading-snug flex items-start gap-2">
                      <span aria-hidden>📍</span>
                      <div>
                        <div>{gewaehltWohnung.strasse} {gewaehltWohnung.hausnummer}, {gewaehltWohnung.plz} {gewaehltWohnung.ort}</div>
                        {gewaehltWohnung.whg_bezeichnung && (
                          <div className="text-xs text-ink-muted mt-0.5">{gewaehltWohnung.whg_bezeichnung}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-4 mt-3">
                      {meineWohnungen.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setGewaehltWohnungId(null)
                            setForm(f => ({ ...f, einsatzort_adresse: "", wohneinheit_referenz: "", wohnung: "" }))
                          }}
                          className="text-xs text-ink-muted hover:text-ink underline underline-offset-2"
                        >
                          Andere Wohnung wählen
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setNutzeProfilWohnung(false)
                          setGewaehltWohnungId(null)
                          setForm(f => ({ ...f, einsatzort_adresse: "", einsatzort_lat: null, einsatzort_lng: null, wohneinheit_referenz: "", wohnung: "" }))
                        }}
                        className="text-xs text-ink-muted hover:text-ink underline underline-offset-2"
                      >
                        Andere Adresse eingeben
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Picker — mehrere Wohnungen zur Auswahl */
                  <div>
                    <p className="text-sm text-ink-muted mb-3">Wähle deine Wohneinheit:</p>
                    <div className="flex flex-col gap-2">
                      {meineWohnungen.map(w => {
                        const adresse = `${w.strasse} ${w.hausnummer}, ${w.plz} ${w.ort}`
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              setGewaehltWohnungId(w.id)
                              setForm(f => ({
                                ...f,
                                einsatzort_adresse: adresse,
                                einsatzort_lat: null,
                                einsatzort_lng: null,
                                wohneinheit_referenz: w.id,
                                wohnung: w.whg_bezeichnung ?? f.wohnung,
                              }))
                            }}
                            className="w-full text-left bg-white border border-line rounded-xl px-4 py-3 hover:border-accent/50 hover:bg-accent/5 transition-colors"
                          >
                            <div className="text-sm font-medium text-ink">{adresse}</div>
                            {w.whg_bezeichnung && <div className="text-xs text-ink-muted mt-0.5">{w.whg_bezeichnung}</div>}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNutzeProfilWohnung(false)
                        setForm(f => ({ ...f, einsatzort_adresse: "", einsatzort_lat: null, einsatzort_lng: null }))
                      }}
                      className="mt-3 text-xs text-ink-muted hover:text-ink underline underline-offset-2"
                    >
                      Andere Adresse eingeben
                    </button>
                  </div>
                )}
              </div>
            ) : profilWohnung && nutzeProfilWohnung ? (
              /* F2: Fallback — profilWohnung aus profiles.adresse (kein wohnungen-Eintrag) */
              <div className="mb-5">
                <div className="bg-accent/5 border border-accent/30 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-wider text-accent font-bold mb-1">Meine Wohnung</div>
                  <div className="text-sm text-ink leading-snug flex items-start gap-2">
                    <span aria-hidden>📍</span>
                    <span>{profilWohnung.adresse}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNutzeProfilWohnung(false)
                      setForm(f => ({ ...f, einsatzort_adresse: "", einsatzort_lat: null, einsatzort_lng: null }))
                    }}
                    className="mt-3 text-xs text-ink-muted hover:text-ink underline underline-offset-2"
                  >
                    Andere Adresse eingeben
                  </button>
                </div>
              </div>
            ) : (
              /* Manuelle Adresseingabe */
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
                {(meineWohnungen.length > 0 || profilWohnung) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNutzeProfilWohnung(true)
                      if (meineWohnungen.length === 1) {
                        const w = meineWohnungen[0]
                        const adresse = `${w.strasse} ${w.hausnummer}, ${w.plz} ${w.ort}`
                        setGewaehltWohnungId(w.id)
                        setForm(f => ({ ...f, einsatzort_adresse: adresse, einsatzort_lat: null, einsatzort_lng: null, wohneinheit_referenz: w.id, wohnung: w.whg_bezeichnung ?? f.wohnung }))
                      } else if (profilWohnung) {
                        setForm(f => ({ ...f, einsatzort_adresse: profilWohnung.adresse, einsatzort_lat: profilWohnung.lat, einsatzort_lng: profilWohnung.lng }))
                      }
                    }}
                    className="mt-2 text-xs text-accent hover:text-[#2D6B5A] underline underline-offset-2"
                  >
                    Doch meine Wohnung verwenden
                  </button>
                ) : (
                  <p className="mt-2 text-[11px] text-ink-muted">
                    Tipp:{" "}
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard-mieter/profil")}
                      className="text-accent underline underline-offset-2 hover:text-[#2D6B5A]"
                    >
                      Hinterlege deine Wohnung im Profil
                    </button>
                    , dann ist das beim nächsten Mal mit einem Klick erledigt.
                  </p>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="text-xs text-ink-muted mb-1.5 block font-medium">
                Wohnung / Raum <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <input
                value={form.wohnung}
                onChange={e => setForm(f => ({ ...f, wohnung: e.target.value }))}
                placeholder="z.B. Whg. 3 OG, Bad"
                className="w-full bg-white border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-[#B5AEA4] focus:outline-none focus:border-accent/50"
              />
            </div>

            {/* Loop-23 (27.05.): Mieter-/Wohneinheits-Nummer als eindeutiger
                Identifier für die Verwaltung. Wird automatisch gesetzt wenn
                eine Wohneinheit aus dem Picker gewählt wurde (Sprint BA). */}
            {!gewaehltWohnungId && (
              <div className="mb-4">
                <label className="text-xs text-ink-muted mb-1.5 block font-medium">
                  Mieter-Nr. / Wohneinheits-Nr. <span className="text-ink-muted font-normal">(falls bekannt)</span>
                </label>
                <input
                  value={form.wohneinheit_referenz}
                  onChange={e => setForm(f => ({ ...f, wohneinheit_referenz: e.target.value }))}
                  placeholder="z.B. M-1234 oder WE-12-A — steht meistens im Mietvertrag"
                  className="w-full bg-white border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-[#B5AEA4] focus:outline-none focus:border-accent/50"
                />
                <p className="text-[11px] text-ink-muted mt-1">
                  Wenn deine Verwaltung mit Nummern arbeitet, kann sie deine Meldung damit sofort zuordnen.
                </p>
              </div>
            )}

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
                  Wir berechnen automatisch den besten Preis und fragen den passendsten Handwerker für dich an
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
              <button onClick={() => setStep("details")} className="text-sm text-ink-muted hover:text-ink px-4">Zurück</button>
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
            <p className="text-sm text-ink-muted mb-4 max-w-sm mx-auto">
              Deine Hausverwaltung prüft die Meldung und meldet sich bei dir.
              Status-Updates findest du in &bdquo;Meine Meldungen&ldquo;.
            </p>
            {rückrufInitiert && (
              <div className="bg-accent/8 border border-accent/20 rounded-xl px-4 py-3 mb-6 max-w-sm mx-auto text-left">
                <div className="text-xs font-medium text-accent mb-1">Kurzer Rückruf geplant</div>
                <div className="text-xs text-ink-muted">
                  Wir rufen dich gleich an, um noch 1–2 Details zu klären — dauert unter 2 Minuten.
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => router.push("/dashboard-mieter")}>Meine Meldungen</Button>
              <Button variant="ghost" onClick={() => {
                setStep("foto")
                setBeschreibung("")
                setKiResult(null)
                setFotoFiles([])
                fotoPreviewUrls.forEach(u => URL.revokeObjectURL(u))
                setFotoPreviewUrls([])
                setRückrufInitiert(null)
                setForm({ titel: "", beschreibung: "", wohnung: "", wohneinheit_referenz: "", prioritaet: "planbar", gewerk: "allgemein", einsatzort_adresse: "", einsatzort_lat: null, einsatzort_lng: null })
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
