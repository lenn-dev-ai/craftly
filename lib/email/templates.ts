// E-Mail-Templates im Reparo-Design.
// Alle Templates exportieren { subject, html } — html mit inline-styles
// für maximale E-Mail-Client-Kompatibilität (Gmail, Outlook, Apple Mail).

const COLORS = {
  bg: "#FAF8F5",
  accent: "#3D8B7A",
  warm: "#C4956A",
  danger: "#C4574B",
  text: "#2D2A26",
  textMuted: "#6B665E",
  border: "#EDE8E1",
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function emailLayout(title: string, content: string): string {
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

function ctaButton(text: string, url: string): string {
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
        { label: "Gewerk", value: params.gewerk },
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
