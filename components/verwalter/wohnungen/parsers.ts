import Papa from "papaparse"
import * as XLSX from "xlsx"

// Sprint I — Bulk-Wohnungs-Import. Datei-Parsing (CSV/XLSX) plus
// Auto-Mapping auf DB-Felder.

export interface ParsedFile {
  headers: string[]
  rows: Record<string, string>[]
}

export const DB_FIELDS = [
  "strasse",
  "hausnummer",
  "plz",
  "ort",
  "whg_bezeichnung",
  "mieter_name",
  "mieter_email",
  "mieter_telefon",
  "baujahr",
  "qm",
] as const

export type DbField = typeof DB_FIELDS[number]

export const PFLICHT_FELDER: DbField[] = ["strasse", "hausnummer", "plz", "ort", "whg_bezeichnung"]

export const DB_FIELD_LABEL: Record<DbField, string> = {
  strasse: "Straße",
  hausnummer: "Hausnummer",
  plz: "PLZ",
  ort: "Ort",
  whg_bezeichnung: "Wohnungs-Bezeichnung",
  mieter_name: "Mieter Name",
  mieter_email: "Mieter E-Mail",
  mieter_telefon: "Mieter Telefon",
  baujahr: "Baujahr",
  qm: "Quadratmeter",
}

// Beta-Feedback (2026-06-15): Verwalter wollen eine vorgefertigte Liste
// herunterladen und befüllen → einheitliches Format, das automatisch
// ausgelesen wird. Die Header sind bewusst so gewählt, dass autoMap() sie
// garantiert 1:1 zuordnet ("Strasse" statt "Straße" — ß fällt bei der
// Normalisierung weg; "E-Mail" statt "Mieter-E-Mail" — sonst greift der
// "mieter"-Hint von mieter_name zuerst).
export const VORLAGE_DATEINAME = "reparo-wohnungsliste-vorlage.csv"

export function buildVorlageCsv(): string {
  const kopf = [
    "Strasse", "Hausnummer", "PLZ", "Ort", "Wohnungs-Bezeichnung",
    "Mieter-Name", "E-Mail", "Telefon", "Baujahr", "Quadratmeter",
  ]
  const beispiele = [
    ["Schönhauser Allee", "80", "10439", "Berlin", "WE 01 / EG links", "Max Mustermann", "max@beispiel.de", "030 1234567", "1995", "54"],
    ["Musterstraße", "12a", "10115", "Berlin", "WE 02 / 1. OG rechts", "", "", "", "", ""],
  ]
  // Semikolon + BOM: öffnet in deutschem Excel direkt in Spalten mit Umlauten.
  const zeilen = [kopf, ...beispiele].map(r => r.join(";"))
  return "\uFEFF" + zeilen.join("\r\n") + "\r\n"
}

// Auto-Mapping-Heuristik: normalisierter Header-Name → DB-Feld.
const NORMALIZE = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

const HEADER_HINTS: Record<DbField, string[]> = {
  strasse: ["strasse", "straße", "street"],
  hausnummer: ["hausnummer", "hausnr", "nr", "housenumber"],
  plz: ["plz", "postleitzahl", "postcode", "zip"],
  ort: ["ort", "stadt", "city"],
  whg_bezeichnung: ["whgbezeichnung", "wohnungsbezeichnung", "whg", "wohnung", "einheit", "unit"],
  mieter_name: ["mietername", "mieter", "tenantname", "tenant", "bewohner"],
  mieter_email: ["email", "mail", "mieteremail"],
  mieter_telefon: ["telefon", "tel", "phone", "mietertelefon"],
  baujahr: ["baujahr", "year", "built"],
  qm: ["qm", "quadratmeter", "flaeche", "fläche", "area", "size"],
}

export function autoMap(headers: string[]): Record<string, DbField | "ignore"> {
  const result: Record<string, DbField | "ignore"> = {}
  for (const h of headers) {
    const norm = NORMALIZE(h)
    let match: DbField | "ignore" = "ignore"
    for (const field of DB_FIELDS) {
      if (HEADER_HINTS[field].some(hint => norm === hint || norm.includes(hint))) {
        match = field
        break
      }
    }
    result[h] = match
  }
  return result
}

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

// Validierung pro Zeile, basierend auf dem User-gewählten Mapping.
export type RowError = { row: number; field: DbField | "pflicht"; message: string }

const PLZ_REGEX = /^\d{5}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRows(
  rows: Record<string, string>[],
  mapping: Record<string, DbField | "ignore">,
): { mapped: Array<Record<string, string>>; errors: RowError[] } {
  const mapped: Array<Record<string, string>> = []
  const errors: RowError[] = []

  // Pflicht-Felder müssen im Mapping abgedeckt sein
  const gemapptDbFelder = new Set<DbField>(
    Object.values(mapping).filter((v): v is DbField => v !== "ignore"),
  )
  const fehlende = PFLICHT_FELDER.filter(f => !gemapptDbFelder.has(f))
  if (fehlende.length > 0) {
    errors.push({
      row: -1,
      field: "pflicht",
      message: `Pflicht-Felder nicht gemappt: ${fehlende.map(f => DB_FIELD_LABEL[f]).join(", ")}`,
    })
    return { mapped, errors }
  }

  rows.forEach((srcRow, idx) => {
    const target: Record<string, string> = {}
    for (const [srcKey, dbField] of Object.entries(mapping)) {
      if (dbField === "ignore") continue
      target[dbField] = (srcRow[srcKey] ?? "").trim()
    }

    for (const pf of PFLICHT_FELDER) {
      if (!target[pf]) {
        errors.push({ row: idx + 1, field: pf, message: `Pflicht-Feld "${DB_FIELD_LABEL[pf]}" leer` })
      }
    }
    if (target.plz && !PLZ_REGEX.test(target.plz)) {
      errors.push({ row: idx + 1, field: "plz", message: `PLZ "${target.plz}" muss 5-stellig sein` })
    }
    if (target.mieter_email && !EMAIL_REGEX.test(target.mieter_email)) {
      errors.push({ row: idx + 1, field: "mieter_email", message: `E-Mail "${target.mieter_email}" ist ungültig` })
    }
    mapped.push(target)
  })

  return { mapped, errors }
}
