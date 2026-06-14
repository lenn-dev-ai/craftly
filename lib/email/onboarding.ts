// Send-Helper für die Beta-Onboarding-Sequenz (siehe
// Reparo-Onboarding-Email-Sequence.md, Phase E2).
//
// sendOnboardingMail() bündelt Template-Auswahl + Versand über die
// bestehende sendEmail()-Infrastruktur (lib/email/send.ts). Solange
// RESEND_PAUSED gesetzt ist, ist das ein No-Op mit Log-Eintrag —
// genau wie bei allen anderen Transaktions-Mails.
//
// Versand-Zeitpunkte (Phase E3, noch nicht implementiert):
//   - welcome           → sofort bei Beta-Signup (Trigger in Signup-Flow)
//   - schritt1          → Tag 1 nach Signup
//   - reminder          → Tag 3, nur falls noch keine erste Aktion
//   - feedbackAnfrage   → Tag 7
//   - reEngagement      → Tag 14, nur bei Inaktivität
//
// Empfehlung für Phase E3: ein scheduled-task (täglicher Cron) liest
// `profiles.created_at` + eine neue Tabelle `email_log`
// (profile_id, template, sent_at — UNIQUE(profile_id, template)) und
// verschickt fällige Mails einmalig pro (Profil, Template)-Paar.
// Bewusst nicht in diesem Schritt umgesetzt, um das Risiko einer
// fehlerhaften Cron-Migration auf dem produktiven Supabase-Projekt zu
// vermeiden — siehe Notiz in Reparo-Onboarding-Email-Sequence.md.

import { sendEmail, sendEmailFireAndForget } from "./send"
import {
  onboardingWelcomeEmail,
  onboardingSchritt1Email,
  onboardingReminderEmail,
  onboardingFeedbackAnfrageEmail,
  onboardingReEngagementEmail,
  type BetaRolle,
} from "./onboarding-templates"

export type OnboardingTemplate =
  | "welcome"
  | "schritt1"
  | "reminder"
  | "feedbackAnfrage"
  | "reEngagement"

interface OnboardingMailParams {
  to: string
  vorname: string
  rolle: BetaRolle
  loginUrl: string
  passwort?: string
  landingUrl?: string
  unsubscribeUrl?: string
  topFeatures?: string[]
}

function buildMail(template: OnboardingTemplate, params: OnboardingMailParams): { subject: string; html: string } {
  switch (template) {
    case "welcome":
      return onboardingWelcomeEmail({
        vorname: params.vorname,
        rolle: params.rolle,
        loginUrl: params.loginUrl,
        passwort: params.passwort,
      })
    case "schritt1":
      return onboardingSchritt1Email({
        vorname: params.vorname,
        rolle: params.rolle,
        loginUrl: params.loginUrl,
      })
    case "reminder":
      return onboardingReminderEmail({
        vorname: params.vorname,
        loginUrl: params.loginUrl,
        landingUrl: params.landingUrl,
      })
    case "feedbackAnfrage":
      return onboardingFeedbackAnfrageEmail({
        vorname: params.vorname,
      })
    case "reEngagement":
      return onboardingReEngagementEmail({
        vorname: params.vorname,
        loginUrl: params.loginUrl,
        unsubscribeUrl: params.unsubscribeUrl || params.loginUrl,
        topFeatures: params.topFeatures,
      })
  }
}

/**
 * Verschickt eine Onboarding-Mail (wartet auf das Ergebnis).
 * Gibt das sendEmail()-Result zurück, z.B. für Logging in `email_log`.
 */
export async function sendOnboardingMail(template: OnboardingTemplate, params: OnboardingMailParams) {
  const { subject, html } = buildMail(template, params)
  return sendEmail({ to: params.to, subject, html })
}

/**
 * Fire-and-forget-Variante für API-Routen, die nicht auf den
 * Mailversand warten dürfen (z.B. Signup-Endpoint).
 */
export function sendOnboardingMailFireAndForget(template: OnboardingTemplate, params: OnboardingMailParams): void {
  const { subject, html } = buildMail(template, params)
  sendEmailFireAndForget({ to: params.to, subject, html })
}
