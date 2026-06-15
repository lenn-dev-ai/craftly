// E-Mail-Templates im Reparo-Design.
// Alle Templates exportieren { subject, html } — html mit inline-styles
// für maximale E-Mail-Client-Kompatibilität (Gmail, Outlook, Apple Mail).

import { formatGewerk } from "@/types"

export const COLORS = {
  bg: "#FAF8F5",
  accent: "#3D8B7A",
  warm: "#C4956A",
  danger: "#C4574B",
  text: "#2D2A26",
  textMuted: "#6B665E",
  border: "#EDE8E1",
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function emailLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid ${COLORS.border};">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:${COLORS.accent};width:36px;height:36px;border-radius:8px;text-align:center;vertical-align:middle;">
                <span style="color:#ffffff;font-weight:700;font-size:18px;line-height:36px;">R</span>
              </td>
              <td style="padding-left:10px;font-size:18px;font-weight:700;color:${COLORS.text};">Reparo</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;font-size:20px;color:${COLORS.text};font-weight:700;">${escapeHtml(title)}</h2>
          ${content}
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid ${COLORS.border};color:${COLORS.textMuted};font-size:12px;line-height:1.6;">
          Diese E-Mail wurde automatisch von Reparo versendet.<br>
          <a href="${SITE_URL}" style="color:${COLORS.accent};">reparo-app.netlify.app</a> ·
          <a href="${SITE_URL}/impressum" style="color:${COLORS.textMuted};">Impressum</a> ·
          <a href="${SITE_URL}/datenschutz" style="color:${COLORS.textMuted};">Datenschutz</a> ·
          <a href="${SITE_URL}/agb" style="color:${COLORS.textMuted};">AGB</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function dringlichkeitBadge(d: string): string {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    notfall: { label: "🔴 Notfall", color: "#ffffff", bg: COLORS.danger },
    zeitnah: { label: "🟡 Zeitnah", color: "#854F0B", bg: "#FAF1DE" },
    planbar: { label: "🟢 Planbar", color: "#ffffff", bg: COLORS.accent },
  }
  const c = map[d] ?? map.planbar
  return `<span style="display:inline-block;padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600;color:${c.color};background:${c.bg};">${c.label}</span>`
}

export function ctaButton(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td>
      <a href="${url}" style="display:inline-block;padding:12px 28px;background:${COLORS.accent};color:#ffffff;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;">${escapeHtml(text)}</a>
    </td></tr>
  </table>`
}

function infoTabelle(rows: Array<{ label: string; value: string }>): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:${COLORS.text};border-collapse:collapse;">
    ${rows.map(r => `<tr>
      <td style="padding:6px 0;color:${COLORS.textMuted};">${escapeHtml(r.label)}</td>
      <td style="padding:6px 0;text-align:right;">${escapeHtml(r.value)}</td>
    </tr>`).join("")}
  </table>`
}

// =====================================================================
// 1. Einladungs-Mail an Handwerker bei neuer Auktion
// =====================================================================
export function einladungEmail(params: {
  handwerkerName: string
  ticketTitel: string
  ticketBeschreibung: string
  gewerk: string
  dringlichkeit: string
  einsatzort: string
  distanzKm: number
  auktionEnde: string
  ticketId: string
}): { subject: string; html: string } {
  const subject = `Neuer Auftrag in ${params.distanzKm.toFixed(1)} km: ${params.ticketTitel}`
  const beschreibung = params.ticketBeschreibung.length > 200
    ? params.ticketBeschreibung.substring(0, 200) + "…"
    : params.ticketBeschreibung
  const html = emailLayout("Neuer Auftrag in Ihrer Nähe", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.handwerkerName)},<br><br>
      ein neuer Auftrag passt zu Ihrem Profil und wartet auf Ihr Angebot:
    </p>
    <div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:12px;padding:20px;margin:0 0 16px;">
      <div style="margin-bottom:12px;">${dringlichkeitBadge(params.dringlichkeit)}</div>
      <h3 style="margin:0 0 8px;color:${COLORS.text};font-size:17px;">${escapeHtml(params.ticketTitel)}</h3>
      ${beschreibung ? `<p style="margin:0 0 12px;color:${COLORS.textMuted};font-size:14px;line-height:1.5;">${escapeHtml(beschreibung)}</p>` : ""}
      ${infoTabelle([
        { label: "Gewerk", value: formatGewerk(params.gewerk) },
        { label: "Einsatzort", value: params.einsatzort || "—" },
        { label: "Entfernung", value: `${params.distanzKm.toFixed(1)} km` },
        { label: "Auktion endet", value: params.auktionEnde },
      ])}
    </div>
    ${ctaButton("Angebot abgeben", `${SITE_URL}/dashboard-handwerker/angebot/${params.ticketId}`)}
  `)
  return { subject, html }
}

// =====================================================================
// 2. Verwalter bekommt neues Angebot
// =====================================================================
export function neuesAngebotEmail(params: {
  verwalterName: string
  handwerkerName: string
  handwerkerFirma: string
  ticketTitel: string
  angebotPreis: number
  angebotAnzahl: number
  ticketId: string
}): { subject: string; html: string } {
  const preisFormatiert = params.angebotPreis.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const subject = `Neues Angebot für „${params.ticketTitel}“ — ${preisFormatiert} €`
  const html = emailLayout("Neues Angebot eingegangen", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.verwalterName)},<br><br>
      für Ihren Auftrag <strong>${escapeHtml(params.ticketTitel)}</strong> ist ein neues Angebot eingegangen:
    </p>
    <div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:12px;padding:20px;margin:0 0 16px;">
      <div style="font-size:17px;font-weight:600;color:${COLORS.text};">${escapeHtml(params.handwerkerName)}</div>
      ${params.handwerkerFirma ? `<div style="margin:0 0 12px;color:${COLORS.textMuted};font-size:14px;">${escapeHtml(params.handwerkerFirma)}</div>` : ""}
      <div style="font-size:32px;font-weight:700;color:${COLORS.accent};margin:8px 0;">${preisFormatiert} €</div>
      <p style="margin:8px 0 0;color:${COLORS.textMuted};font-size:13px;">${params.angebotAnzahl === 1 ? "Erstes Angebot" : `${params.angebotAnzahl} Angebote insgesamt`}</p>
    </div>
    ${ctaButton("Angebote vergleichen", `${SITE_URL}/dashboard-verwalter/tickets/${params.ticketId}/handwerker`)}
  `)
  return { subject, html }
}

// =====================================================================
// 3. Auktion abgelaufen (an Verwalter, ohne Auto-Vergabe)
// =====================================================================
export function auktionAbgelaufenEmail(params: {
  verwalterName: string
  ticketTitel: string
  angebotAnzahl: number
  ticketId: string
}): { subject: string; html: string } {
  const subject = `Auktion beendet: „${params.ticketTitel}“ — ${params.angebotAnzahl} Angebot${params.angebotAnzahl === 1 ? "" : "e"}`
  const hatAngebote = params.angebotAnzahl > 0
  const html = emailLayout("Auktion abgelaufen", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.verwalterName)},<br><br>
      die Auktion für <strong>${escapeHtml(params.ticketTitel)}</strong> ist abgelaufen.
    </p>
    <div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:12px;padding:24px;margin:0 0 16px;text-align:center;">
      <div style="font-size:40px;font-weight:700;color:${hatAngebote ? COLORS.accent : COLORS.danger};">${params.angebotAnzahl}</div>
      <p style="margin:4px 0 0;color:${COLORS.textMuted};font-size:14px;">eingegangene Angebot${params.angebotAnzahl === 1 ? "" : "e"}</p>
    </div>
    ${hatAngebote
      ? `<p style="margin:0;color:${COLORS.text};font-size:15px;line-height:1.6;">Sie können jetzt den passendsten Handwerker auswählen und den Auftrag vergeben.</p>
         ${ctaButton("Handwerker auswählen", `${SITE_URL}/dashboard-verwalter/tickets/${params.ticketId}/handwerker`)}`
      : `<p style="margin:0;color:${COLORS.text};font-size:15px;line-height:1.6;">Leider sind keine Angebote eingegangen. Sie können den Auftrag erneut starten oder den Suchradius erweitern. Der Status wurde auf „offen“ zurückgesetzt.</p>
         ${ctaButton("Auftrag bearbeiten", `${SITE_URL}/ticket/${params.ticketId}`)}`}
  `)
  return { subject, html }
}

// =====================================================================
// 4. Zuschlag-Mail an Gewinner
// =====================================================================
export function zuschlagEmail(params: {
  handwerkerName: string
  ticketTitel: string
  ticketBeschreibung: string
  einsatzort: string
  angebotPreis: number
  ticketId: string
}): { subject: string; html: string } {
  const preisFormatiert = params.angebotPreis.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const subject = `Zuschlag erhalten: „${params.ticketTitel}“`
  const beschreibung = params.ticketBeschreibung.length > 200
    ? params.ticketBeschreibung.substring(0, 200) + "…"
    : params.ticketBeschreibung
  const html = emailLayout("Glückwunsch — Sie haben den Zuschlag!", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.handwerkerName)},<br><br>
      Sie haben den Zuschlag für folgenden Auftrag erhalten:
    </p>
    <div style="background:${COLORS.bg};border:2px solid ${COLORS.accent};border-radius:12px;padding:20px;margin:0 0 16px;">
      <h3 style="margin:0 0 8px;color:${COLORS.text};font-size:17px;">${escapeHtml(params.ticketTitel)}</h3>
      ${beschreibung ? `<p style="margin:0 0 12px;color:${COLORS.textMuted};font-size:14px;line-height:1.5;">${escapeHtml(beschreibung)}</p>` : ""}
      ${infoTabelle([
        { label: "Einsatzort", value: params.einsatzort || "—" },
        { label: "Ihr Angebot", value: `${preisFormatiert} €` },
      ])}
    </div>
    <p style="margin:0;color:${COLORS.text};font-size:15px;line-height:1.6;">
      Den Termin finden Sie in Ihrem Kalender unter „Termine &amp; Route“. Bitte kontaktieren Sie den Verwalter zur Abstimmung.
    </p>
    ${ctaButton("Auftrag ansehen", `${SITE_URL}/ticket/${params.ticketId}`)}
  `)
  return { subject, html }
}

// =====================================================================
// 6. Befund-Fertig-Mail an Verwalter (nach Diagnose-Termin)
// =====================================================================
export function befundFertigEmail(params: {
  verwalterName: string
  handwerkerName: string
  handwerkerFirma: string
  ticketTitel: string
  projektAngebot: number
  korridorMin: number
  korridorMax: number
  korridorBasis: "historisch" | "fallback"
  vergleichsanzahl: number
  ticketId: string
}): { subject: string; html: string } {
  const angebot = params.projektAngebot.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const min = params.korridorMin.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const max = params.korridorMax.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const imKorridor = params.projektAngebot >= params.korridorMin && params.projektAngebot <= params.korridorMax
  const basisText = params.korridorBasis === "historisch"
    ? `Basis: Median aus ${params.vergleichsanzahl} vergleichbaren Aufträgen ± 15 %`
    : "Basis: Diagnose-Handwerker-Angebot ± 15 % (noch zu wenige Vergleichswerte)"

  const subject = imKorridor
    ? `Befund da — Angebot im fairen Bereich: „${params.ticketTitel}“`
    : `Befund da — Angebot außerhalb Korridor: „${params.ticketTitel}“`

  const korridorBadge = imKorridor
    ? `<div style="display:inline-block;padding:6px 14px;border-radius:12px;background:${COLORS.accent}/20;background:#E8F2EF;color:${COLORS.accent};font-size:13px;font-weight:600;">✓ Im fairen Preisbereich</div>`
    : `<div style="display:inline-block;padding:6px 14px;border-radius:12px;background:#FAF1DE;color:#854F0B;font-size:13px;font-weight:600;">⚠ Außerhalb Korridor</div>`

  const html = emailLayout("Befund + Projekt-Angebot eingegangen", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.verwalterName)},<br><br>
      <strong>${escapeHtml(params.handwerkerName)}${params.handwerkerFirma ? ` (${escapeHtml(params.handwerkerFirma)})` : ""}</strong>
      hat den Diagnose-Termin für <strong>${escapeHtml(params.ticketTitel)}</strong> abgeschlossen und ein Festpreis-Angebot abgegeben.
    </p>
    <div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:12px;padding:20px;margin:0 0 16px;">
      <div style="margin-bottom:12px;">${korridorBadge}</div>
      <div style="font-size:32px;font-weight:700;color:${COLORS.accent};margin:8px 0;">${angebot} €</div>
      <div style="color:${COLORS.textMuted};font-size:13px;margin-bottom:8px;">Fairer Bereich: ${min}–${max} €</div>
      <div style="color:${COLORS.textMuted};font-size:11px;">${escapeHtml(basisText)}</div>
    </div>
    <p style="margin:0;color:${COLORS.text};font-size:15px;line-height:1.6;">
      Sie können den Auftrag jetzt direkt an den Diagnose-Handwerker vergeben oder eine Auktion mit Vorkaufsrecht (24 h) starten.
    </p>
    ${ctaButton("Befund prüfen", `${SITE_URL}/dashboard-verwalter/ticket/${params.ticketId}`)}
  `)
  return { subject, html }
}

// =====================================================================
// 7. Nachtrag eingereicht — an Verwalter (wesentlich/erheblich)
// =====================================================================
function stufeBadge(stufe: "bagatell" | "wesentlich" | "erheblich"): string {
  const map = {
    bagatell: { label: "Bagatell ≤ 10 %", color: "#3D8B7A", bg: "#E8F2EF" },
    wesentlich: { label: "Wesentlich ≤ 25 %", color: "#854F0B", bg: "#FAF1DE" },
    erheblich: { label: "Erheblich > 25 %", color: "#ffffff", bg: COLORS.danger },
  } as const
  const c = map[stufe]
  return `<span style="display:inline-block;padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600;color:${c.color};background:${c.bg};">${c.label}</span>`
}

export function nachtragEingereichtEmail(params: {
  verwalterName: string
  handwerkerName: string
  handwerkerFirma: string
  ticketTitel: string
  ursprungspreis: number
  nachtragBetrag: number
  aufpreisProzent: number
  stufe: "bagatell" | "wesentlich" | "erheblich"
  begruendung: string
  ticketId: string
}): { subject: string; html: string } {
  const ursprung = params.ursprungspreis.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const betrag = params.nachtragBetrag.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const prozent = params.aufpreisProzent.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const neuTotal = (params.ursprungspreis + params.nachtragBetrag).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const subject = `Nachtrag (${params.stufe}) für „${params.ticketTitel}“ — ${betrag} €`
  const html = emailLayout("Nachtrag eingereicht", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.verwalterName)},<br><br>
      <strong>${escapeHtml(params.handwerkerName)}${params.handwerkerFirma ? ` (${escapeHtml(params.handwerkerFirma)})` : ""}</strong>
      hat während der Arbeit am Projekt <strong>${escapeHtml(params.ticketTitel)}</strong> einen Nachtrag eingereicht.
    </p>
    <div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:12px;padding:20px;margin:0 0 16px;">
      <div style="margin-bottom:12px;">${stufeBadge(params.stufe)}</div>
      ${infoTabelle([
        { label: "Ursprungspreis", value: `${ursprung} €` },
        { label: "Nachtrag", value: `+${betrag} €` },
        { label: "Aufpreis", value: `${prozent} %` },
        { label: "Neuer Auftragswert", value: `${neuTotal} €` },
      ])}
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid ${COLORS.border};">
        <div style="font-size:12px;font-weight:600;color:${COLORS.textMuted};margin-bottom:6px;">BEGRÜNDUNG</div>
        <p style="margin:0;color:${COLORS.text};font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(params.begruendung)}</p>
      </div>
    </div>
    <p style="margin:0;color:${COLORS.text};font-size:15px;line-height:1.6;">
      Bitte prüfen Sie den Nachtrag und genehmigen oder lehnen Sie ihn ab.
    </p>
    ${ctaButton("Nachtrag prüfen", `${SITE_URL}/dashboard-verwalter/ticket/${params.ticketId}`)}
  `)
  return { subject, html }
}

// =====================================================================
// 8. Nachtrag genehmigt — an Handwerker
// =====================================================================
export function nachtragGenehmigtEmail(params: {
  handwerkerName: string
  ticketTitel: string
  nachtragBetrag: number
  stufe: "bagatell" | "wesentlich" | "erheblich"
  neuerAuftragswert: number
  ticketId: string
}): { subject: string; html: string } {
  const betrag = params.nachtragBetrag.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const total = params.neuerAuftragswert.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const subject = `Nachtrag genehmigt: „${params.ticketTitel}“ — +${betrag} €`
  const html = emailLayout("Nachtrag genehmigt", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.handwerkerName)},<br><br>
      Ihr Nachtrag für <strong>${escapeHtml(params.ticketTitel)}</strong> wurde genehmigt.
    </p>
    <div style="background:${COLORS.bg};border:2px solid ${COLORS.accent};border-radius:12px;padding:20px;margin:0 0 16px;">
      <div style="margin-bottom:12px;">${stufeBadge(params.stufe)}</div>
      ${infoTabelle([
        { label: "Nachtragsbetrag", value: `+${betrag} €` },
        { label: "Neuer Auftragswert", value: `${total} €` },
      ])}
    </div>
    ${ctaButton("Auftrag ansehen", `${SITE_URL}/ticket/${params.ticketId}`)}
  `)
  return { subject, html }
}

// =====================================================================
// 9. Nachtrag abgelehnt — an Handwerker
// =====================================================================
export function nachtragAbgelehntEmail(params: {
  handwerkerName: string
  ticketTitel: string
  nachtragBetrag: number
  stufe: "bagatell" | "wesentlich" | "erheblich"
  begruendung: string
  ticketId: string
}): { subject: string; html: string } {
  const betrag = params.nachtragBetrag.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const subject = `Nachtrag abgelehnt: „${params.ticketTitel}“`
  const html = emailLayout("Nachtrag abgelehnt", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.handwerkerName)},<br><br>
      Ihr Nachtrag für <strong>${escapeHtml(params.ticketTitel)}</strong> wurde leider nicht genehmigt.
    </p>
    <div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:12px;padding:20px;margin:0 0 16px;">
      <div style="margin-bottom:12px;">${stufeBadge(params.stufe)}</div>
      ${infoTabelle([
        { label: "Eingereichter Betrag", value: `+${betrag} €` },
      ])}
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid ${COLORS.border};">
        <div style="font-size:12px;font-weight:600;color:${COLORS.textMuted};margin-bottom:6px;">IHRE BEGRÜNDUNG</div>
        <p style="margin:0;color:${COLORS.text};font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(params.begruendung)}</p>
      </div>
    </div>
    <p style="margin:0;color:${COLORS.text};font-size:15px;line-height:1.6;">
      Bitte besprechen Sie das weitere Vorgehen direkt mit dem Verwalter.
    </p>
    ${ctaButton("Auftrag ansehen", `${SITE_URL}/ticket/${params.ticketId}`)}
  `)
  return { subject, html }
}

// =====================================================================
// 10. Bewertungs-Reminder an Mieter (M-W2)
// =====================================================================
export function bewertungReminderEmail(params: {
  mieterName: string
  handwerkerName: string
  ticketTitel: string
  ticketId: string
}): { subject: string; html: string } {
  const subject = `1 Bewertung offen: „${params.ticketTitel}“`
  const html = emailLayout("Wie war dein Termin?", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.mieterName)},<br><br>
      vor ein paar Tagen wurde der Auftrag <strong>${escapeHtml(params.ticketTitel)}</strong>
      von ${escapeHtml(params.handwerkerName)} abgeschlossen.
    </p>
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:15px;line-height:1.6;">
      Deine Bewertung hilft anderen Mietern und stärkt gute Handwerker.
      Es dauert nur 30 Sekunden.
    </p>
    ${ctaButton("Jetzt bewerten", `${SITE_URL}/dashboard-mieter/ticket/${params.ticketId}`)}
    <p style="margin:0;color:${COLORS.textMuted};font-size:13px;line-height:1.6;">
      Diese Erinnerung kommt nur einmal — wir wollen nicht stören.
    </p>
  `)
  return { subject, html }
}

// =====================================================================
// 11. Stille-HW-Reaktivierungs-Mail (M-W4)
// =====================================================================
export function stilleHwReaktivierungEmail(params: {
  handwerkerName: string
  auftraege: Array<{ id: string; titel: string; gewerk: string; einsatzort: string; entfernungKm: number }>
}): { subject: string; html: string } {
  const top = params.auftraege.slice(0, 3)
  const subject = top.length === 1
    ? `1 passender Auftrag in deiner Nähe: „${top[0].titel}“`
    : `${top.length} passende Aufträge in deiner Nähe`
  const liste = top.map(a => `
    <div style="background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:12px;padding:16px;margin:0 0 8px;">
      <div style="font-weight:600;color:${COLORS.text};font-size:15px;margin-bottom:4px;">${escapeHtml(a.titel)}</div>
      <div style="font-size:13px;color:${COLORS.textMuted};margin-bottom:8px;">
        ${escapeHtml(formatGewerk(a.gewerk))} · ${escapeHtml(a.einsatzort || "Adresse auf Anfrage")} · ${a.entfernungKm.toFixed(1)} km
      </div>
      <a href="${SITE_URL}/dashboard-handwerker/angebot/${a.id}" style="display:inline-block;padding:8px 16px;background:${COLORS.accent};color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">
        Angebot abgeben →
      </a>
    </div>
  `).join("")
  const html = emailLayout("Aufträge in deiner Nähe", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.handwerkerName)},<br><br>
      du hast schon eine Weile kein Angebot mehr abgegeben. Diese Aufträge
      passen zu deinem Gewerk und Radius:
    </p>
    ${liste}
    ${ctaButton("Alle verfügbaren Aufträge", `${SITE_URL}/dashboard-handwerker`)}
    <p style="margin:16px 0 0;color:${COLORS.textMuted};font-size:13px;line-height:1.6;">
      Diese Mail kommt höchstens alle 14 Tage. Wenn du keine mehr willst,
      melde dich bei uns.
    </p>
  `)
  return { subject, html }
}

// =====================================================================
// 5. Absage-Mail an andere Bieter
// =====================================================================
export function absageEmail(params: {
  handwerkerName: string
  ticketTitel: string
}): { subject: string; html: string } {
  const subject = `Auftrag vergeben: „${params.ticketTitel}“`
  const html = emailLayout("Auftrag anderweitig vergeben", `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Hallo ${escapeHtml(params.handwerkerName)},<br><br>
      vielen Dank für Ihr Angebot zu <strong>${escapeHtml(params.ticketTitel)}</strong>. Der Auftrag wurde leider an einen anderen Handwerker vergeben.
    </p>
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:15px;line-height:1.6;">
      Aktuell laufende Ausschreibungen in Ihrer Nähe finden Sie auf Ihrem Dashboard:
    </p>
    ${ctaButton("Verfügbare Aufträge ansehen", `${SITE_URL}/dashboard-handwerker`)}
  `)
  return { subject, html }
}

// =====================================================================
// 6. Welcome-Mail nach Registrierung / OAuth-First-Login
// =====================================================================
export function welcomeEmail(params: {
  name: string
  rolle: "verwalter" | "handwerker" | "mieter" | "admin"
}): { subject: string; html: string } {
  const subject = "Willkommen bei Reparo"

  const quickstartByRolle: Record<string, { title: string; bullets: string[]; cta: { label: string; href: string } }> = {
    verwalter: {
      title: "Erste Schritte als Verwaltung",
      bullets: [
        "Lege deine ersten Objekte und Wohnungen unter Verwaltung an.",
        "Lade Mieter per E-Mail-Code ein — sie können dann Schäden melden.",
        "Lade Handwerker zu Auktionen ein und vergleiche Angebote.",
      ],
      cta: { label: "Zur Verwaltung", href: `${SITE_URL}/dashboard-verwalter` },
    },
    handwerker: {
      title: "Erste Schritte als Handwerker",
      bullets: [
        "Pflege Gewerk, Einzugsgebiet und Stundensatz im Profil — wir matchen damit Aufträge.",
        "Verbinde deinen Google-Kalender und hinterlege deine Arbeitszeiten — so weiß das System, wann du verfügbar bist.",
        "Verbinde Stripe (optional), damit künftige Auszahlungen und Penalty-Verrechnungen sauber laufen.",
      ],
      cta: { label: "Zum Handwerker-Dashboard", href: `${SITE_URL}/dashboard-handwerker` },
    },
    mieter: {
      title: "Erste Schritte als Mieter",
      bullets: [
        "Trage in „Schaden melden“ Beschreibung und Foto ein — die KI hilft beim Einordnen.",
        "Du siehst den Status jederzeit unter „Meine Tickets“.",
        "Antworte direkt im Ticket, wenn der Handwerker Rückfragen hat.",
      ],
      cta: { label: "Schaden melden", href: `${SITE_URL}/dashboard-mieter/melden` },
    },
    admin: {
      title: "Admin-Übersicht",
      bullets: [
        "Du hast Zugriff auf alle Dashboards via Rollenwechsel.",
        "Feedback und Penalties laufen in deiner Admin-Sidebar auf.",
      ],
      cta: { label: "Admin-Dashboard", href: `${SITE_URL}/dashboard-admin` },
    },
  }

  const qs = quickstartByRolle[params.rolle] ?? quickstartByRolle.mieter
  const bullets = qs.bullets.map(b => `
    <li style="margin:0 0 8px;color:${COLORS.text};font-size:14px;line-height:1.6;">${escapeHtml(b)}</li>
  `).join("")

  const html = emailLayout(`Hallo ${params.name.split(" ")[0] || ""} — willkommen bei Reparo`, `
    <p style="margin:0 0 16px;color:${COLORS.text};font-size:16px;line-height:1.6;">
      Schön, dass du dabei bist. Reparo verbindet Verwaltungen, Handwerker
      und Mieter auf einer Plattform — alle Schadensmeldungen, Angebote
      und Abrechnungen an einem Ort.
    </p>
    <h3 style="margin:0 0 12px;color:${COLORS.text};font-size:16px;font-weight:700;">${escapeHtml(qs.title)}</h3>
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${bullets}
    </ul>
    ${ctaButton(qs.cta.label, qs.cta.href)}
    <p style="margin:24px 0 0;color:${COLORS.textMuted};font-size:13px;line-height:1.6;">
      Du bist Teil der Beta — der Feedback-Button unten rechts geht direkt
      an uns. Hilf uns dabei, Reparo besser zu machen.
    </p>
  `)
  return { subject, html }
}
