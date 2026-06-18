import { z } from "zod"

// Wiederverwendbares Email-Schema mit deutscher Fehlermeldung
const emailFeld = z.string().min(1, "Bitte eine E-Mail-Adresse eingeben.").email("Bitte eine gültige E-Mail-Adresse eingeben.")

const sicheresPasswort = z
  .string()
  .min(8, "Mindestens 8 Zeichen.")
  .refine(v => /[A-Z]/.test(v), "Mindestens ein Großbuchstabe.")
  .refine(v => /[0-9]/.test(v), "Mindestens eine Zahl.")

// Login
export const loginSchema = z.object({
  email: emailFeld,
  password: z.string().min(1, "Bitte das Passwort eingeben."),
})
export type LoginInput = z.infer<typeof loginSchema>

// Registrierung
export const registrierungSchema = z
  .object({
    rolle: z.enum(["verwalter", "handwerker", "mieter"]),
    name: z.string().trim().min(2, "Bitte den vollständigen Namen eingeben."),
    email: emailFeld,
    password: sicheresPasswort,
    passwordConfirm: z.string(),
    firma: z.string().optional(),
    gewerk: z.string().optional(),
    plz_bereich: z.string().optional(),
  })
  .refine(d => d.password === d.passwordConfirm, {
    message: "Passwörter stimmen nicht überein.",
    path: ["passwordConfirm"],
  })
  .refine(
    d => d.rolle !== "handwerker" || (d.firma?.trim()?.length ?? 0) > 0,
    { message: "Firmenname ist für Handwerker erforderlich.", path: ["firma"] }
  )
  .refine(
    d => d.rolle !== "handwerker" || (d.gewerk?.trim()?.length ?? 0) > 0,
    { message: "Gewerk ist für Handwerker erforderlich.", path: ["gewerk"] }
  )
export type RegistrierungInput = z.infer<typeof registrierungSchema>

// OAuth-Onboarding (nach Google-Login, Profil-Lückenfüller).
// Kein Passwort — die Session steht schon. Email vom OAuth-Provider,
// also nicht erneut erfragen.
export const onboardingSchema = z
  .object({
    rolle: z.enum(["verwalter", "handwerker", "mieter"]),
    name: z.string().trim().min(2, "Bitte den vollständigen Namen eingeben."),
    telefon: z.string().optional(),
    firma: z.string().optional(),
    gewerk: z.string().optional(),
    plz_bereich: z.string().optional(),
  })
  .refine(
    d => d.rolle !== "handwerker" || (d.firma?.trim()?.length ?? 0) > 0,
    { message: "Firmenname ist für Handwerker erforderlich.", path: ["firma"] }
  )
  .refine(
    d => d.rolle !== "handwerker" || (d.gewerk?.trim()?.length ?? 0) > 0,
    { message: "Gewerk ist für Handwerker erforderlich.", path: ["gewerk"] }
  )
export type OnboardingInput = z.infer<typeof onboardingSchema>

// Passwort vergessen
export const passwortVergessenSchema = z.object({
  email: emailFeld,
})
export type PasswortVergessenInput = z.infer<typeof passwortVergessenSchema>

// Passwort zurücksetzen
export const passwortZuruecksetzenSchema = z
  .object({
    password: sicheresPasswort,
    passwordConfirm: z.string(),
  })
  .refine(d => d.password === d.passwordConfirm, {
    message: "Passwörter stimmen nicht überein.",
    path: ["passwordConfirm"],
  })
export type PasswortZuruecksetzenInput = z.infer<typeof passwortZuruecksetzenSchema>

// ── Mutierende API-Routes (Sprint AT) ────────────────────────────────────────

// POST /api/tickets/create-by-verwalter
export const ticketCreateByVerwalterSchema = z.object({
  mieter_name: z.string().trim().min(1, "mieter_name erforderlich").max(200),
  mieter_telefon: z.string().max(50).nullable().optional(),
  titel: z.string().trim().min(1, "titel erforderlich").max(200),
  beschreibung: z.string().trim().min(1, "beschreibung erforderlich").max(2000),
  gewerk: z.string().trim().max(100).optional(),
  einsatzort_adresse: z.string().trim().min(1, "einsatzort_adresse erforderlich").max(300),
  einsatzort_lat: z.number().nullable().optional(),
  einsatzort_lng: z.number().nullable().optional(),
  wohnung: z.string().trim().max(100).nullable().optional(),
  prioritaet: z.enum(["planbar", "zeitnah", "notfall"]).default("planbar"),
})
export type TicketCreateByVerwalterInput = z.infer<typeof ticketCreateByVerwalterSchema>

// POST /api/auftraege/annehmen
// z.coerce.number() statt z.number() damit "125.00" als String toleriert wird.
export const angebotAnnehmenSchema = z.object({
  ticket_id: z.string().uuid("ticket_id muss eine gültige UUID sein"),
  preis: z.coerce.number().positive("preis muss > 0 sein").max(50000, "preis max 50.000 €"),
  fruehester_termin: z.string().max(100).nullable().optional(),
  geschaetzte_dauer: z.string().max(200).nullable().optional(),
  nachricht: z.string().max(2000).nullable().optional(),
})
export type AngebotAnnehmenInput = z.infer<typeof angebotAnnehmenSchema>

// POST /api/nachtraege/einreichen
export const nachtragEinreichenSchema = z.object({
  ticket_id: z.string().uuid("ticket_id muss eine gültige UUID sein"),
  nachtrag_betrag: z.coerce.number().positive("nachtrag_betrag muss > 0 sein").max(50000),
  begruendung: z.string().trim().min(1, "begruendung erforderlich").max(2000),
  fotos: z.array(z.string().max(500)).max(10).optional(),
})
export type NachtragEinreichenInput = z.infer<typeof nachtragEinreichenSchema>

// POST /api/termine/vorschlagen
const terminSlotSchema = z.object({
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein"),
  von: z.string().regex(/^\d{2}:\d{2}$/, "Zeit muss im Format HH:MM sein"),
  bis: z.string().regex(/^\d{2}:\d{2}$/, "Zeit muss im Format HH:MM sein"),
})
export const terminVorschlagenSchema = z.object({
  ticket_id: z.string().uuid("ticket_id muss eine gültige UUID sein"),
  slots: z
    .array(terminSlotSchema)
    .min(2, "Mindestens 2 Termine vorschlagen.")
    .max(3, "Maximal 3 Termine pro Vorschlag."),
  force: z.boolean().optional(),
})
export type TerminVorschlagenInput = z.infer<typeof terminVorschlagenSchema>

// POST /api/feedback
export const feedbackSchema = z.object({
  message: z.string().trim().min(1, "Nachricht ist leer.").max(5000, "Nachricht zu lang (max 5000 Zeichen)."),
  kontext_url: z.string().max(500).nullable().optional(),
})
export type FeedbackInput = z.infer<typeof feedbackSchema>
