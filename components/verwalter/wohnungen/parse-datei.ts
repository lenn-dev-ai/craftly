import Papa from "papaparse"
import * as XLSX from "xlsx"
import type { ParsedFile } from "./parsers"

// Schwere Datei-Parser (papaparse ~80kB + xlsx ~270kB) — bewusst in einem
// eigenen Modul, das NUR dynamisch (await import()) geladen wird, sobald
// der Verwalter tatsächlich eine Datei hochlädt. So landen die Libs nicht
// im First-Load-Bundle der Import-Seite (Audit-Perf).

export async function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headers = res.meta.fields ?? []
        const rows = (res.data ?? []).filter(r => Object.values(r).some(v => String(v).trim().length > 0))
        resolve({ headers, rows })
      },
      error: (err) => reject(err),
    })
  })
}

export async function parseXlsx(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: "array" })
  const firstSheet = wb.SheetNames[0]
  if (!firstSheet) return { headers: [], rows: [] }
  const sheet = wb.Sheets[firstSheet]
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
  if (json.length === 0) return { headers: [], rows: [] }
  const headers = Object.keys(json[0])
  const rows = json.map(r => {
    const out: Record<string, string> = {}
    for (const k of headers) out[k] = String(r[k] ?? "").trim()
    return out
  })
  return { headers, rows }
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "csv" || ext === "txt") return parseCsv(file)
  if (ext === "xlsx" || ext === "xls") return parseXlsx(file)
  throw new Error(`Unbekannte Datei-Endung: ${ext}. Erlaubt: csv, xlsx, xls`)
}
