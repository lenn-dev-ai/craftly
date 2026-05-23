"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button, Card, Select } from "@/components/ui"
import { authFetch } from "@/lib/auth/clientFetch"
import { Upload, FileSpreadsheet, Check, ChevronRight, ChevronLeft, X, AlertCircle } from "lucide-react"
import {
  parseFile,
  autoMap,
  validateRows,
  DB_FIELDS,
  DB_FIELD_LABEL,
  PFLICHT_FELDER,
  type DbField,
  type ParsedFile,
  type RowError,
} from "@/components/verwalter/wohnungen/parsers"

// Sprint I — Bulk-Wohnungs-Import Wizard
// Steps: upload → mapping → vorschau → import → erfolg

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 5000
const BATCH_SIZE = 50

type Step = "upload" | "mapping" | "vorschau" | "import" | "erfolg"

export default function WohnungenImportPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("upload")
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<Record<string, DbField | "ignore">>({})
  const [error, setError] = useState("")
  const [fileName, setFileName] = useState("")
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number; errors: string[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const onFile = useCallback(async (file: File) => {
    setError("")
    if (file.size > MAX_FILE_BYTES) {
      setError(`Datei zu groß (max ${MAX_FILE_BYTES / 1024 / 1024} MB).`)
      return
    }
    try {
      const p = await parseFile(file)
      if (p.rows.length === 0) {
        setError("Keine Datenzeilen gefunden. Erste Zeile sollte Spalten-Header enthalten.")
        return
      }
      if (p.rows.length > MAX_ROWS) {
        setError(`Zu viele Zeilen (max ${MAX_ROWS}). Bitte in mehreren Uploads aufteilen.`)
        return
      }
      setParsed(p)
      setMapping(autoMap(p.headers))
      setFileName(file.name)
      setStep("mapping")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Datei konnte nicht gelesen werden.")
    }
  }, [])

  const validation = parsed
    ? validateRows(parsed.rows, mapping)
    : { mapped: [], errors: [] as RowError[] }

  const pflichtFehlt = !PFLICHT_FELDER.every(pf =>
    Object.values(mapping).includes(pf),
  )

  async function startImport() {
    if (!parsed) return
    setStep("import")
    setProgress(0)

    const all = validation.mapped
    // Fehler-Zeilen rausfiltern (nur Erfolg-Zeilen einreichen)
    const fehlerZeilen = new Set(validation.errors.map(e => e.row))
    const erfolgZeilen = all.filter((_, i) => !fehlerZeilen.has(i + 1))

    let inserted = 0, updated = 0, skipped = 0
    const errs: string[] = []

    for (let i = 0; i < erfolgZeilen.length; i += BATCH_SIZE) {
      const batch = erfolgZeilen.slice(i, i + BATCH_SIZE)
      try {
        const res = await authFetch("/api/wohnungen/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wohnungen: batch, strategy: "upsert" }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          errs.push(`Batch ${i / BATCH_SIZE + 1}: ${body.error || res.status}`)
          skipped += batch.length
        } else {
          const body = await res.json() as { inserted: number; updated: number; skipped: number }
          inserted += body.inserted
          updated += body.updated
          skipped += body.skipped
        }
      } catch (e) {
        errs.push(`Batch ${i / BATCH_SIZE + 1}: ${e instanceof Error ? e.message : "Netzwerk-Fehler"}`)
        skipped += batch.length
      }
      setProgress(Math.round(((i + batch.length) / erfolgZeilen.length) * 100))
    }

    setResult({ inserted, updated, skipped: skipped + (all.length - erfolgZeilen.length), errors: errs })
    setStep("erfolg")
  }

  function reset() {
    setStep("upload")
    setParsed(null)
    setMapping({})
    setFileName("")
    setError("")
    setProgress(0)
    setResult(null)
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Wohnungs-Import</h1>
          <p className="text-sm text-ink-muted mt-1">CSV oder Excel hochladen — bis zu {MAX_ROWS} Wohnungen auf einmal</p>
        </div>
        <button
          onClick={() => router.push("/dashboard-verwalter/wohnungen")}
          className="text-ink-muted hover:text-ink"
          aria-label="Abbrechen"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-danger/10 text-danger text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="p-6">
        {step === "upload" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rolle-verwalter">
              <Upload className="w-5 h-5" />
              <h2 className="text-lg font-semibold">1. Datei hochladen</h2>
            </div>
            <p className="text-sm text-ink-muted">
              Erste Zeile sollte Spalten-Header enthalten (z.B. Straße, Hausnummer, PLZ, Ort, Wohnungs-Bezeichnung).
              Auto-Mapping schlägt deutsche und englische Namen vor.
            </p>
            <label
              className="block border-2 border-dashed border-line rounded-xl p-8 text-center cursor-pointer hover:border-rolle-verwalter/40 transition"
              onDragOver={e => { e.preventDefault() }}
              onDrop={async e => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) await onFile(f)
              }}
            >
              <FileSpreadsheet className="w-12 h-12 mx-auto text-ink-muted mb-3" />
              <div className="text-sm font-medium text-ink mb-1">Datei hier ablegen oder klicken</div>
              <div className="text-xs text-ink-muted">CSV, XLSX, XLS — max. {MAX_FILE_BYTES / 1024 / 1024} MB</div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                className="hidden"
                onChange={async e => {
                  const f = e.target.files?.[0]
                  if (f) await onFile(f)
                }}
              />
            </label>
          </div>
        )}

        {step === "mapping" && parsed && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rolle-verwalter">
              <FileSpreadsheet className="w-5 h-5" />
              <h2 className="text-lg font-semibold">2. Spalten zuordnen</h2>
            </div>
            <p className="text-sm text-ink-muted">
              {fileName} · {parsed.rows.length} Zeilen · {parsed.headers.length} Spalten
            </p>
            {pflichtFehlt && (
              <div className="p-3 rounded-lg bg-warm/10 text-warm-dark text-xs">
                Pflicht-Felder fehlen: {PFLICHT_FELDER
                  .filter(pf => !Object.values(mapping).includes(pf))
                  .map(pf => DB_FIELD_LABEL[pf])
                  .join(", ")}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-ink-muted border-b border-line">
                    <th className="py-2 pr-3">Excel-Spalte</th>
                    <th className="py-2 pr-3">Beispielwert</th>
                    <th className="py-2">Reparo-Feld</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.headers.map(h => (
                    <tr key={h} className="border-b border-line">
                      <td className="py-2 pr-3 font-medium text-ink">{h}</td>
                      <td className="py-2 pr-3 text-ink-muted truncate max-w-xs">
                        {parsed.rows[0]?.[h] || "—"}
                      </td>
                      <td className="py-2">
                        <Select
                          value={mapping[h] ?? "ignore"}
                          onChange={e => setMapping({ ...mapping, [h]: e.target.value as DbField | "ignore" })}
                        >
                          <option value="ignore">— Ignorieren —</option>
                          {DB_FIELDS.map(f => (
                            <option key={f} value={f}>
                              {DB_FIELD_LABEL[f]}{PFLICHT_FELDER.includes(f) ? " *" : ""}
                            </option>
                          ))}
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === "vorschau" && parsed && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rolle-verwalter">
              <Check className="w-5 h-5" />
              <h2 className="text-lg font-semibold">3. Vorschau</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Importierbar" value={validation.mapped.length - new Set(validation.errors.map(e => e.row)).size} accent="text-accent" />
              <Stat label="Fehler-Zeilen" value={new Set(validation.errors.filter(e => e.row > 0).map(e => e.row)).size} accent="text-danger" />
              <Stat label="Gesamt" value={validation.mapped.length} accent="text-ink" />
            </div>
            {validation.errors.length > 0 && (
              <div className="bg-danger/5 border border-danger/15 rounded-lg p-3 max-h-40 overflow-y-auto">
                <div className="text-xs font-semibold text-danger mb-2">Fehler ({validation.errors.length})</div>
                <ul className="text-xs text-danger space-y-1">
                  {validation.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>
                      {e.row > 0 ? `Zeile ${e.row}: ` : ""}{e.message}
                    </li>
                  ))}
                  {validation.errors.length > 20 && (
                    <li className="italic">… und {validation.errors.length - 20} weitere</li>
                  )}
                </ul>
              </div>
            )}
            <p className="text-xs text-ink-muted">
              Fehler-Zeilen werden übersprungen. Du kannst sie nach dem Import in der Original-Datei korrigieren und nochmal hochladen — die Logik nutzt UPSERT, also keine Duplikate.
            </p>
          </div>
        )}

        {step === "import" && (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-rolle-verwalter/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-rolle-verwalter animate-pulse" />
            </div>
            <h2 className="text-lg font-semibold text-ink">Import läuft…</h2>
            <div className="w-64 h-2 bg-line rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-rolle-verwalter transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-ink-muted">{progress}%</p>
          </div>
        )}

        {step === "erfolg" && result && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-status-erledigt/10 flex items-center justify-center mb-3">
                <Check className="w-8 h-8 text-status-erledigt" />
              </div>
              <h2 className="text-xl font-bold text-ink">Import abgeschlossen</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Neu" value={result.inserted} accent="text-status-erledigt" />
              <Stat label="Aktualisiert" value={result.updated} accent="text-rolle-mieter" />
              <Stat label="Übersprungen" value={result.skipped} accent="text-ink-muted" />
            </div>
            {result.errors.length > 0 && (
              <div className="bg-warm/10 text-warm-dark rounded-lg p-3 text-xs space-y-1">
                <div className="font-semibold">{result.errors.length} Fehler beim Import:</div>
                {result.errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <div className="flex gap-3 justify-center pt-4">
              <Button variant="secondary" onClick={reset}>Weitere Datei importieren</Button>
              <Button onClick={() => router.push("/dashboard-verwalter/wohnungen")}>Zur Wohnungs-Liste</Button>
            </div>
          </div>
        )}

        {(step === "mapping" || step === "vorschau") && (
          <div className="flex justify-between mt-6 pt-6 border-t border-line">
            <Button
              variant="secondary"
              onClick={() => setStep(step === "vorschau" ? "mapping" : "upload")}
              disabled={false}
            >
              <ChevronLeft className="w-4 h-4" /> Zurück
            </Button>
            {step === "mapping" && (
              <Button
                onClick={() => setStep("vorschau")}
                disabled={pflichtFehlt}
              >
                Weiter zur Vorschau <ChevronRight className="w-4 h-4" />
              </Button>
            )}
            {step === "vorschau" && (
              <Button
                onClick={startImport}
                disabled={validation.mapped.length === 0}
              >
                Import starten <Check className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-line p-3 text-center">
      <div className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
    </div>
  )
}
