import { z } from "zod"

// WoonWoon Digitale Selbstauskunft — Feldkatalog v1.
//
// Achtung: Die Original-Spezifikation v1.1 (HTML-Prototyp) lag beim Bau
// nicht vor. Dieser Katalog rekonstruiert die dokumentierten Entscheidungen
// aus der Prozessanalyse (Einkommen ja / Bankverbindung nein, Mietdauer
// 3–12 Monate als Dropdown, Paket als exklusive Radio-Auswahl) plus die
// Standardfelder einer Mieterselbstauskunft. Zusätzliche Felder aus einer
// späteren Spezifikation können ohne DB-Migration ergänzt werden — alles
// außerhalb der bekannten Spalten landet als JSONB in `daten`.

// message auf z.string() deckt den Fall "Feld fehlt komplett" ab (API-Aufruf
// ohne den Key) — sonst käme dort zods englisches "Invalid input" durch.
const pflichtText = (feld: string) =>
  z.string({ message: `Bitte ${feld} angeben.` }).trim().min(1, `Bitte ${feld} angeben.`)

// Leere Formularfelder kommen als "" an, nicht als undefined. Ohne
// Normalisierung bricht das jedes optionale Enum ("" ist kein gültiger
// Enum-Wert) und z.coerce.number("") würde still zu 0 werden — ein leeres
// Einkommensfeld landete sonst als 0 EUR in der DB.
const leerZuUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v

const optionalerText = z.preprocess(leerZuUndefined, z.string().trim().optional())

const pflichtZahl = (meldung: string) =>
  z.preprocess(leerZuUndefined, z.coerce.number({ message: meldung }))

// Mietdauer: Dropdown 3–12 Monate (Prozessanalyse)
export const MIETDAUER_MONATE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

// Standard/Premium schließen sich aus → ein Radio-Feld, kein Checkbox-Paar
export const PAKETE = [
  { wert: "standard", label: "Standard-Paket" },
  { wert: "premium", label: "Premium-Paket" },
] as const

export const selbstauskunftSchema = z.object({
  // Person
  anrede: z.preprocess(leerZuUndefined, z.enum(["herr", "frau", "divers"]).optional()),
  vorname: pflichtText("den Vornamen"),
  nachname: pflichtText("den Nachnamen"),
  geburtsdatum: z
    .string({ message: "Bitte das Geburtsdatum angeben." })
    .min(1, "Bitte das Geburtsdatum angeben.")
    .refine(v => !Number.isNaN(Date.parse(v)), "Bitte ein gültiges Datum angeben.")
    .refine(v => {
      const alter = (Date.now() - Date.parse(v)) / (365.25 * 24 * 3600 * 1000)
      return alter >= 18 && alter < 120
    }, "Interessenten müssen volljährig sein."),
  email: z
    .string({ message: "Bitte eine E-Mail-Adresse angeben." })
    .min(1, "Bitte eine E-Mail-Adresse angeben.")
    .email("Bitte eine gültige E-Mail-Adresse angeben."),
  telefon: pflichtText("die Telefonnummer"),

  // Aktuelle Anschrift
  strasse: pflichtText("Straße und Hausnummer"),
  plz: z
    .string({ message: "Bitte die Postleitzahl angeben." })
    .trim()
    .regex(/^\d{5}$/, "Bitte eine gültige Postleitzahl angeben."),
  ort: pflichtText("den Ort"),

  // Beruf & Einkommen — Bankverbindung wird bewusst NICHT erhoben
  beruf: pflichtText("die berufliche Tätigkeit"),
  arbeitgeber: optionalerText,
  netto_einkommen_eur: pflichtZahl("Bitte das monatliche Nettoeinkommen angeben.")
    .pipe(
      z
        .number()
        .min(0, "Das Einkommen kann nicht negativ sein.")
        .max(1_000_000, "Bitte einen realistischen Betrag angeben."),
    ),

  // Haushalt
  anzahl_personen: pflichtZahl("Bitte die Anzahl der einziehenden Personen angeben.").pipe(
    z
      .number()
      .int("Bitte eine ganze Zahl angeben.")
      .min(1, "Mindestens eine Person.")
      .max(20, "Bitte einen realistischen Wert angeben."),
  ),
  haustiere: z.coerce.boolean(),
  haustiere_details: optionalerText,
  raucher: z.coerce.boolean(),

  // Mietwunsch
  einzug_ab: z
    .string({ message: "Bitte das gewünschte Einzugsdatum angeben." })
    .min(1, "Bitte das gewünschte Einzugsdatum angeben.")
    .refine(v => !Number.isNaN(Date.parse(v)), "Bitte ein gültiges Datum angeben."),
  mietdauer_monate: pflichtZahl("Bitte die gewünschte Mietdauer wählen.").pipe(
    z
      .number()
      .refine(
        v => MIETDAUER_MONATE.includes(v as (typeof MIETDAUER_MONATE)[number]),
        "Die Mietdauer muss zwischen 3 und 12 Monaten liegen.",
      ),
  ),
  paket: z.enum(["standard", "premium"], { message: "Bitte ein Paket wählen." }),

  // Optionale Mitteilung
  nachricht: z.preprocess(leerZuUndefined, z.string().trim().max(2000).optional()),

  // Pflicht-Erklärungen — ohne Häkchen kein Absenden
  erklaerung_richtigkeit: z.literal(true, {
    message: "Bitte die Richtigkeit der Angaben bestätigen.",
  }),
  datenschutz_einwilligung: z.literal(true, {
    message: "Bitte in die Datenverarbeitung einwilligen.",
  }),
})

export type SelbstauskunftInput = z.infer<typeof selbstauskunftSchema>

// Upload-Regeln (gespiegelt in der Bucket-Config der Migration)
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024 // 10 MB
export const UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

// Pflicht-Uploads laut Brief: Gehaltsnachweis + Ausweis
export const PFLICHT_DOKUMENTE = [
  { typ: "gehaltsnachweis", label: "Gehaltsnachweis (letzte Abrechnung)" },
  { typ: "ausweis", label: "Ausweisdokument (Vorderseite genügt)" },
] as const
export type DokumentTyp = (typeof PFLICHT_DOKUMENTE)[number]["typ"]
