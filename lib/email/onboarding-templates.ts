// Onboarding-E-Mail-Sequenz für Beta-Tester.
// Inhaltlich basierend auf `Reparo-Onboarding-Email-Sequence.md` (Mails 1-5).
// Folgt demselben Muster wie `templates.ts`: jede Funktion exportiert
// { subject, html }, html mit inline-styles für E-Mail-Client-Kompatibilität.
//
// Versand über `sendOnboardingMail()` in `lib/email/onboarding.ts`.

import { COLORS, SITE_URL, escapeHtml, emailLayout, ctaButton } from "./templates"

export type BetaRolle = "mieter" | "verwalter" | "handwerker"

function rolleLabel(rolle: BetaRolle): string {
  const map: Record<BetaRolle, string> = {
    mieter: "Mieter",
    verwalter: "Verwalter",
    handwerker: "Handwerker",
  }
  return map[rolle]
}

// =====================================================================
// Mail 1 — Welcome (Tag 0, direkt nach Anmeldung)
// =====================================================================
export function onboardingWelcomeEmail(params: {
  vorname: string
  rolle: BetaRolle
  loginUrl: string
  passwort?: string
}): { subject: string; html: string } {
  const subject = "Willkommen bei Reparo — Ihr Beta-Zugang ist bereit"
  const html = emailLayout("Willkommen in der Reparo-Beta", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.vorname)},<br><br>
      schön, dass Sie Reparo als einer der ersten testen.
    </p>
    <p style="margin:0 0 8px;color:${COLORS.text};font-size:15px;line-height:1.6;">
      Bevor Sie loslegen — drei Dinge, die Sie wissen sollten:
    </p>
    <div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:12px;padding:20px;margin:0 0 16px;">
      <div style="margin:0 0 14px;">
        <div style="font-weight:600;color:${COLORS.text};font-size:14px;margin-bottom:4px;">1. Das hier ist eine Beta</div>
        <p style="margin:0;color:${COLORS.textMuted};font-size:14px;line-height:1.5;">
          Wir bauen Reparo gerade. Features funktionieren — aber wir lernen mit
          jedem Klick dazu. Ehrliches Feedback (auch negatives) ist Gold wert.
        </p>
      </div>
      <div style="margin:0 0 14px;">
        <div style="font-weight:600;color:${COLORS.text};font-size:14px;margin-bottom:4px;">2. Ihr Login</div>
        <p style="margin:0;color:${COLORS.textMuted};font-size:14px;line-height:1.5;">
          Sie sind als <strong>${escapeHtml(rolleLabel(params.rolle))}</strong> eingeladen.
          ${params.passwort ? `Ihr vorläufiges Passwort: <strong>${escapeHtml(params.passwort)}</strong> (jederzeit im Profil änderbar).` : ""}
        </p>
      </div>
      <div>
        <div style="font-weight:600;color:${COLORS.text};font-size:14px;margin-bottom:4px;">3. Feedback geht direkt im Tool</div>
        <p style="margin:0;color:${COLORS.textMuted};font-size:14px;line-height:1.5;">
          Unten rechts ist ein kleiner Feedback-Button. Ein Klick, kurze Notiz —
          landet direkt bei uns. Keine Umfrage, kein Quiz.
        </p>
      </div>
    </div>
    ${ctaButton("Jetzt einloggen", params.loginUrl)}
    <p style="margin:16px 0 0;color:${COLORS.text};font-size:14px;line-height:1.6;">
      Was passiert jetzt:
    </p>
    <ul style="margin:8px 0 16px;padding-left:20px;">
      <li style="margin:0 0 6px;color:${COLORS.text};font-size:14px;line-height:1.6;">Morgen schicken wir Ihnen einen kurzen Hinweis für den ersten Schritt</li>
      <li style="margin:0 0 6px;color:${COLORS.text};font-size:14px;line-height:1.6;">In 3 Tagen fragen wir kurz nach, wie es läuft</li>
      <li style="margin:0;color:${COLORS.text};font-size:14px;line-height:1.6;">In einer Woche bitten wir um strukturiertes Feedback (max. 5 Min)</li>
    </ul>
    <p style="margin:0;color:${COLORS.textMuted};font-size:13px;line-height:1.6;">
      Wenn Sie zwischendurch Fragen haben: einfach auf diese Mail antworten —
      sie geht direkt an uns.
    </p>
  `)
  return { subject, html }
}

// =====================================================================
// Mail 2 — Schritt 1 (Tag 1, rollenspezifisch)
// =====================================================================
export function onboardingSchritt1Email(params: {
  vorname: string
  rolle: BetaRolle
  loginUrl: string
}): { subject: string; html: string } {
  const subject = "Reparo — Ihr erster Schritt (2 Minuten)"

  const inhalt: Record<BetaRolle, { intro: string; steps: string[]; dauer: string }> = {
    mieter: {
      intro: "Probieren Sie mal eine fingierte Schadensmeldung anzulegen. Es geht nichts kaputt — alle Daten sind im Test-Modus.",
      steps: [
        "Einloggen",
        "„Schaden melden“-Button (oben) anklicken",
        "Wizard durchklicken: Beispiel-Schaden „Heizung kalt“ eintippen",
        "Absenden → Sie sehen sofort, wie die Auktion losläuft",
      ],
      dauer: "Dauert max. 2 Minuten.",
    },
    verwalter: {
      intro: "Im Dashboard sehen Sie bereits Test-Tickets in unterschiedlichen Stadien — perfekt zum Reinklicken. Wir haben Beispiel-Angebote von Demo-Handwerkern hinterlegt.",
      steps: [
        "Einloggen",
        "„Tickets“-Übersicht öffnen",
        "Ein Notfall-Ticket anklicken",
        "Die eingegangenen Angebote ansehen und das beste auswählen",
      ],
      dauer: "Dauert max. 3 Minuten.",
    },
    handwerker: {
      intro: "Im Marktplatz sehen Sie bereits ein paar offene Aufträge — perfekt zum Üben einer Angebots-Abgabe.",
      steps: [
        "Einloggen",
        "„Marktplatz“-Übersicht öffnen",
        "Ein Ticket anklicken, das Sie interessant finden",
        "„Angebot abgeben“ → Preis, Termin und Notiz eintragen",
      ],
      dauer: "Dauert max. 3 Minuten.",
    },
  }

  const c = inhalt[params.rolle]
  const stepsHtml = c.steps.map((s, i) => `
    <li style="margin:0 0 6px;color:${COLORS.text};font-size:14px;line-height:1.6;"><strong>${i + 1}.</strong> ${escapeHtml(s)}</li>
  `).join("")

  const html = emailLayout("Ihr erster Schritt mit Reparo", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.vorname)},<br><br>
      heute ein kurzer Tipp:
    </p>
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:15px;line-height:1.6;">
      ${escapeHtml(c.intro)}
    </p>
    <ol style="margin:0 0 16px;padding-left:20px;list-style:none;">
      ${stepsHtml}
    </ol>
    ${ctaButton("Jetzt ausprobieren", params.loginUrl)}
    <p style="margin:16px 0 0;color:${COLORS.textMuted};font-size:13px;line-height:1.6;">
      ${escapeHtml(c.dauer)} Wenn etwas verwirrend ist: Feedback-Button.
    </p>
  `)
  return { subject, html }
}

// =====================================================================
// Mail 3 — Reminder (Tag 3, nur wenn noch keine Aktion)
// =====================================================================
export function onboardingReminderEmail(params: {
  vorname: string
  loginUrl: string
  landingUrl?: string
}): { subject: string; html: string } {
  const subject = "Reparo — alles gut bei Ihnen?"
  const landingUrl = params.landingUrl ?? SITE_URL
  const html = emailLayout("Alles gut bei Ihnen?", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.vorname)},<br><br>
      uns ist aufgefallen, dass Sie Reparo noch nicht ausprobiert haben — alles in Ordnung?
    </p>
    <p style="margin:0 0 8px;color:${COLORS.text};font-size:15px;line-height:1.6;">
      Häufige Gründe und Hilfen:
    </p>
    <div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:12px;padding:16px 20px;margin:0 0 16px;">
      <p style="margin:0 0 8px;color:${COLORS.text};font-size:14px;line-height:1.6;">
        <strong>„Hab den Login-Link verloren“</strong> → hier nochmal:
        <a href="${params.loginUrl}" style="color:${COLORS.accent};">einloggen</a>
      </p>
      <p style="margin:0 0 8px;color:${COLORS.text};font-size:14px;line-height:1.6;">
        <strong>„War zu beschäftigt“</strong> → kein Stress, die Beta läuft noch
      </p>
      <p style="margin:0 0 8px;color:${COLORS.text};font-size:14px;line-height:1.6;">
        <strong>„Hab vergessen, wofür's war“</strong> → kurze Erinnerung:
        <a href="${landingUrl}" style="color:${COLORS.accent};">${landingUrl.replace(/^https?:\/\//, "")}</a>
      </p>
      <p style="margin:0;color:${COLORS.text};font-size:14px;line-height:1.6;">
        <strong>„Hat mich nicht überzeugt“</strong> → wir nehmen ehrliches Feedback dankbar an, einfach antworten
      </p>
    </div>
    <p style="margin:0;color:${COLORS.textMuted};font-size:13px;line-height:1.6;">
      Wenn Sie keine Lust mehr haben: einfach mit „raus“ antworten und wir
      entfernen Sie aus dem Verteiler. Kein böses Blut.
    </p>
  `)
  return { subject, html }
}

// =====================================================================
// Mail 4 — Feedback-Anfrage (Tag 7)
// =====================================================================
export function onboardingFeedbackAnfrageEmail(params: {
  vorname: string
}): { subject: string; html: string } {
  const subject = "Reparo — Ihre 3 wichtigsten Eindrücke?"
  const html = emailLayout("Eine Woche Reparo — Ihr Feedback?", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.vorname)},<br><br>
      eine Woche Reparo — Zeit für Ihr ehrliches Feedback. Drei Fragen, max. 5 Minuten:
    </p>
    <div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:12px;padding:20px;margin:0 0 16px;">
      <div style="margin:0 0 14px;">
        <div style="font-weight:600;color:${COLORS.text};font-size:14px;margin-bottom:4px;">1. Was hat funktioniert?</div>
        <p style="margin:0;color:${COLORS.textMuted};font-size:14px;line-height:1.5;">
          Welcher Moment in Reparo hat Sie überzeugt — wenn überhaupt einer?
        </p>
      </div>
      <div style="margin:0 0 14px;">
        <div style="font-weight:600;color:${COLORS.text};font-size:14px;margin-bottom:4px;">2. Was hat genervt?</div>
        <p style="margin:0;color:${COLORS.textMuted};font-size:14px;line-height:1.5;">
          Wo haben Sie geflucht? Wo hat etwas nicht so funktioniert wie erwartet?
        </p>
      </div>
      <div>
        <div style="font-weight:600;color:${COLORS.text};font-size:14px;margin-bottom:4px;">3. Würden Sie für Reparo zahlen?</div>
        <p style="margin:0;color:${COLORS.textMuted};font-size:14px;line-height:1.5;">
          Wenn ja: was wäre Ihnen pro Monat fair? Wenn nein: was müsste anders sein?
        </p>
      </div>
    </div>
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:14px;line-height:1.6;">
      Antworten Sie einfach auf diese Mail — formloser Text reicht. Sie können
      auch nur eine der drei Fragen beantworten, wenn Sie wenig Zeit haben.
    </p>
    <p style="margin:0;color:${COLORS.textMuted};font-size:13px;line-height:1.6;">
      Danke, das hilft uns enorm. Falls Sie lieber kurz telefonieren möchten:
      einfach mit „kann anrufen“ antworten.
    </p>
  `)
  return { subject, html }
}

// =====================================================================
// Mail 5 — Re-Engagement (Tag 14, bei nachlassender Aktivität)
// =====================================================================
export function onboardingReEngagementEmail(params: {
  vorname: string
  loginUrl: string
  unsubscribeUrl: string
  topFeatures?: string[]
}): { subject: string; html: string } {
  const subject = "Reparo — letzter Versuch, kein Stress"
  const features = params.topFeatures && params.topFeatures.length > 0
    ? params.topFeatures
    : [
        "Auktions-Vergabe an passende Handwerker in Minuten statt Tagen",
        "Lückenlose Ticket-Historie für jede Schadensmeldung",
        "Status-Updates für Mieter, ohne dass jemand nachtelefonieren muss",
      ]
  const featuresHtml = features.map(f => `
    <li style="margin:0 0 6px;color:${COLORS.text};font-size:14px;line-height:1.6;">${escapeHtml(f)}</li>
  `).join("")

  const html = emailLayout("Letzte Mail aus dem Onboarding", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.vorname)},<br><br>
      letzte Mail von uns aus dem Onboarding — versprochen.
    </p>
    <p style="margin:0 0 8px;color:${COLORS.text};font-size:15px;line-height:1.6;">
      Falls Sie Reparo weiterhin interessant finden: hier sind die Funktionen,
      die unsere aktivsten Tester am meisten loben:
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${featuresHtml}
    </ul>
    ${ctaButton("Nochmal einloggen", params.loginUrl)}
    <p style="margin:16px 0 8px;color:${COLORS.text};font-size:14px;line-height:1.6;">
      Falls Sie kein Interesse mehr haben: ein Klick auf
      <a href="${params.unsubscribeUrl}" style="color:${COLORS.accent};">abmelden</a>
      und Sie hören nie wieder von uns.
    </p>
    <p style="margin:0;color:${COLORS.textMuted};font-size:13px;line-height:1.6;">
      Falls Sie 2 Minuten Zeit haben für Feedback, warum es nicht gepasst hat:
      einfach auf diese Mail antworten — das hilft uns, das Produkt zu verbessern.
    </p>
  `)
  return { subject, html }
}
