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
