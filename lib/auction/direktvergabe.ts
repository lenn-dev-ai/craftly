import { createServiceRoleClient } from "@/lib/supabase-server"
import { haversineKm, schaetzeFahrzeitMin } from "@/lib/distance"
import { berechneSmartScore, type Dringlichkeit } from "@/lib/auction/smart-score"
import { konfigFuer, berechneAuktionsEnde, effektiveProvisionsRate } from "@/lib/auction/auction-manager"
import { berechneAuftragswert } from "@/lib/pricing/auftragswert"
import { calculateCommission } from "@/lib/pricing/commission"
import { berechneAuslastung } from "@/lib/google-cal/auslastung"
import { hasGoogleEventInRange } from "@/lib/google-cal/events"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { einladungEmail, zuschlagEmail, escapeHtml } from "@/lib/email/templates"
import { logTicketEvent } from "@/lib/audit/logTicketEvent"

// Sprint AM Phase 2 — generalisierte sequenzielle Direktvergabe für
// zeitnah/planbar ohne Stamm-HW (siehe
// SPRINT-AM-PREISFORMEL-DIREKTVERGABE.md, Abschnitt "Phase 2").
//
// Kern-Idee: statt einer Mass-Invite-Auktion (alle HW im Radius bieten,
// Verwalter wählt) wird die Kandidatenliste EINMAL berechnet
// (Smart-Score + Preisformel je Kandidat) und dann sequenziell
// abgearbeitet — Top-Kandidat zuerst, bei Ablehnung/Timeout/belegtem
// Google-Kalender der nächste. Nach 3 erfolglosen Versuchen (oder wenn
// die Liste vorher erschöpft ist) fällt das System auf die heutige
// Mass-Invite-Auktion als Fallback zurück (fuehreMassInviteFallback).
//
// Alle Schreibzugriffe auf tickets/einladungen laufen hier über
// createServiceRoleClient() — analog /api/stamm-anfragen/[id]/annehmen
// und den bestehenden Cron-Routen. Das umgeht protect_ticket_fields()
// vollständig (auth.uid() is null → früher Return), siehe Begründung in
// supabase/migrations/20260614000030_sprint_am_direktvergabe.sql.

const DEFAULT_STUNDENSATZ = 50
const MAX_KANDIDATEN = 10
/** Nach N erfolglosen Direktvergabe-Versuchen → Mass-Invite-Fallback. */
export const MAX_ESKALATIONEN = 3

/** estimatedH je Dringlichkeit, analog ESTIMATED_STUNDEN in /api/auction/start. */
export const ESTIMATED_STUNDEN: Record<Dringlichkeit, number> = {
  notfall: 2,
  zeitnah: 2,
  planbar: 3,
}

/**
 * Timeout in Minuten für eine einzelne Direktvergabe-Anfrage, gestaffelt
 * nach Dringlichkeit (siehe KONZEPT Abschnitt 4, Schritt 4).
 */
export const DIREKTVERGABE_TIMEOUT_MIN: Record<Dringlichkeit, number> = {
  notfall: 15,
  zeitnah: 120,
  planbar: 1440,
}

export interface DirektvergabeKandidat {
  hw_id: string
  score: number
  preis: number
}

export interface DirektvergabeTicketKontext {
  id: string
  titel: string
  beschreibung: string | null
  gewerk: string | null
  dringlichkeit: Dringlichkeit
  einsatzort_lat: number
  einsatzort_lng: number
  einsatzort_adresse: string | null
}

function formatiereTimeoutText(min: number): string {
  if (min < 60) return `${min} Minuten`
  if (min % 60 === 0) return `${min / 60} Stunden`
  return `${Math.round((min / 60) * 10) / 10} Stunden`
}

/**
 * Zeitfenster für den F1-Google-Cal-Check (hasGoogleEventInRange): "ist
 * der Kandidat in der Zeit, in der der Auftrag voraussichtlich
 * stattfindet, blockiert?". Vereinfachtes Modell wie beim Notfall-Match:
 * ab jetzt für die geschätzte Auftragsdauer.
 */
function pruefZeitfenster(dringlichkeit: Dringlichkeit): { von: Date; bis: Date } {
  const von = new Date()
  const stunden = Math.max(2, ESTIMATED_STUNDEN[dringlichkeit])
  return { von, bis: new Date(von.getTime() + stunden * 60 * 60 * 1000) }
}

/**
 * Schritt 1+2 (KONZEPT Abschnitt 4): Kandidatenliste im Radius bilden,
 * pro Kandidat den individuellen Auftragswert (Sprint AM Preisformel)
 * berechnen, nach Smart-Score sortieren, Top 10 zurückgeben.
 *
 * Edge-Cases (siehe SPRINT-AM-PREISFORMEL-DIREKTVERGABE.md Abschnitt
 * "Edge-Cases"):
 * - fehlender stundensatz → DEFAULT_STUNDENSATZ (Platform-Median-Proxy,
 *   wie bereits im Mass-Invite-Pfad von /api/auction/start).
 * - fehlende Koordinaten → Kandidat wird wie bisher aus dem
 *   Radius-Filter ausgeschlossen (kann nicht sinnvoll geranked werden).
 * - auslastung=null für alle Kandidaten (Beta-Realität ohne
 *   Google-Cal-Verbindungen) → berechneAuslastungsMultiplikator liefert
 *   für alle 1.0, Formel bleibt korrekt.
 */
export async function bildeKandidatenliste(
  ticket: DirektvergabeTicketKontext,
): Promise<DirektvergabeKandidat[]> {
  const admin = createServiceRoleClient()
  const config = konfigFuer(ticket.dringlichkeit)
  const estimatedH = ESTIMATED_STUNDEN[ticket.dringlichkeit]

  let query = admin
    .from("profiles")
    .select("id, gewerk, bewertung_avg, basis_stundensatz, basis_preis, startort_lat, startort_lng, lat, lng, radius_km, auftraege_anzahl")
    .eq("rolle", "handwerker")
  if (ticket.gewerk && ticket.gewerk !== "allgemein") {
    query = query.ilike("gewerk", `%${ticket.gewerk}%`)
  }
  const { data: handwerker } = await query.returns<Array<{
    id: string
    gewerk: string | null
    bewertung_avg: number | null
    basis_stundensatz: number | null
    basis_preis: number | null
    startort_lat: number | null
    startort_lng: number | null
    lat: number | null
    lng: number | null
    radius_km: number | null
    auftraege_anzahl: number | null
  }>>()

  type ImRadius = {
    id: string
    entfernungKm: number
    stundensatz: number
    bewertung: number | null
    erfahrung: number
  }
  const imRadius: ImRadius[] = []
  for (const hw of handwerker ?? []) {
    const hwLat = hw.startort_lat ?? hw.lat
    const hwLng = hw.startort_lng ?? hw.lng
    if (hwLat == null || hwLng == null) continue
    const entfernung = haversineKm(hwLat, hwLng, ticket.einsatzort_lat, ticket.einsatzort_lng)
    const radius = hw.radius_km ?? config.radiusKm
    if (entfernung > radius) continue
    imRadius.push({
      id: hw.id,
      entfernungKm: entfernung,
      stundensatz: hw.basis_stundensatz ?? hw.basis_preis ?? DEFAULT_STUNDENSATZ,
      bewertung: hw.bewertung_avg,
      erfahrung: hw.auftraege_anzahl ?? 0,
    })
  }

  if (imRadius.length === 0) return []

  // Sprint AM — Auslastung pro Kandidat (fail-open → null).
  const auslastungen = await Promise.all(
    imRadius.map(hw => berechneAuslastung(hw.id).catch(() => null)),
  )

  const preise = imRadius.map((hw, i) =>
    berechneAuftragswert({
      stundensatz: hw.stundensatz,
      geschaetzteStunden: estimatedH,
      surgeFaktor: config.surgeFaktor,
      entfernungKm: hw.entfernungKm,
      auslastung: auslastungen[i],
    }).gesamt,
  )

  // Durchschnittspreis über alle Kandidaten — Basis für preisScoreVon()
  // im Smart-Score (relative Bewertung "günstig vs. teuer im Vergleich
  // zu anderen Kandidaten für diesen Auftrag").
  const durchschnittPreis = preise.reduce((sum, p) => sum + p, 0) / preise.length

  const bewertet = imRadius.map((hw, i) => ({
    hw_id: hw.id,
    preis: preise[i],
    erfahrung: hw.erfahrung,
    score: berechneSmartScore({
      angebotPreis: preise[i],
      durchschnittPreis,
      entfernungKm: hw.entfernungKm,
      maxRadius: config.radiusKm,
      bewertung: hw.bewertung,
      istRoutenBonus: false,
      dringlichkeit: ticket.dringlichkeit,
      erfahrung: hw.erfahrung,
    }),
  }))

  bewertet.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.erfahrung - a.erfahrung
  })

  return bewertet.slice(0, MAX_KANDIDATEN).map(k => ({
    hw_id: k.hw_id,
    score: k.score,
    preis: k.preis,
  }))
}

/**
 * Schritt 3 (KONZEPT Abschnitt 4): ab `startIndex` den nächsten
 * Kandidaten suchen, der im relevanten Zeitfenster KEINEN
 * Google-Cal-Event hat (F1-Check, fail-open bei Fehler/keine
 * Verbindung). Gibt den Index in `kandidaten` zurück, oder `null` wenn
 * ab `startIndex` alle belegt sind.
 */
export async function naechsterVerfuegbarerKandidat(
  kandidaten: DirektvergabeKandidat[],
  startIndex: number,
  dringlichkeit: Dringlichkeit,
): Promise<number | null> {
  const { von, bis } = pruefZeitfenster(dringlichkeit)
  for (let i = startIndex; i < kandidaten.length; i++) {
    try {
      const busy = await hasGoogleEventInRange(kandidaten[i].hw_id, von, bis)
      if (!busy) return i
    } catch (err) {
      // Google-API-Fehler tolerieren — kein Block (fail-open, wie F1 in /api/auction/start).
      console.warn("[direktvergabe] F1-check failed for", kandidaten[i].hw_id, err)
      return i
    }
  }
  return null
}

/**
 * Schritt 4 (KONZEPT Abschnitt 4): Direktvergabe-Anfrage an
 * `kandidaten[index]` stellen — einladungen-Zeile (status='offen',
 * empfohlener_preis=kandidat.preis) + Ticket-Tracking-Felder +
 * Einladungs-Mail.
 */
export async function sendeDirektvergabeAnfrage(opts: {
  ticket: DirektvergabeTicketKontext
  kandidaten: DirektvergabeKandidat[]
  index: number
}): Promise<{ ok: boolean }> {
  const { ticket, kandidaten, index } = opts
  const kandidat = kandidaten[index]
  if (!kandidat) return { ok: false }

  const admin = createServiceRoleClient()
  const timeoutMin = DIREKTVERGABE_TIMEOUT_MIN[ticket.dringlichkeit]

  const { data: einladungData, error: einlErr } = await admin
    .from("einladungen")
    .upsert(
      {
        ticket_id: ticket.id,
        handwerker_id: kandidat.hw_id,
        status: "offen",
        empfohlener_preis: kandidat.preis,
      },
      { onConflict: "ticket_id,handwerker_id" },
    )
    .select("id")
  if (einlErr) {
    console.error("[direktvergabe] einladungen-upsert fehlgeschlagen:", einlErr.message)
    return { ok: false }
  }

  const { error: ticketErr } = await admin
    .from("tickets")
    .update({
      direktvergabe_kandidaten: kandidaten,
      direktvergabe_index: index,
      direktvergabe_angefragt_am: new Date().toISOString(),
      direktvergabe_timeout_min: timeoutMin,
    })
    .eq("id", ticket.id)
  if (ticketErr) {
    console.error("[direktvergabe] ticket-update fehlgeschlagen:", ticketErr.message)
    return { ok: false }
  }

  // Sprint BF — Auto-Accept: wenn der HW agent_auto_accept=true hat und der Preis
  // die Untergrenze erfüllt, wird die Anfrage sofort programmatisch angenommen.
  const einladungId = (einladungData as Array<{ id: string }> | null)?.[0]?.id
  const autoAccepted = einladungId
    ? await pruefeUndFuehreAutoAcceptAus({ admin, ticket, hwId: kandidat.hw_id, einladungId, preis: kandidat.preis })
    : false

  if (autoAccepted) return { ok: true }

  // Fire-and-forget: Einladungs-Mail an den Kandidaten (nur wenn nicht auto-accepted).
  void (async () => {
    const { data: hw } = await admin
      .from("profiles")
      .select("email, name, startort_lat, startort_lng, lat, lng")
      .eq("id", kandidat.hw_id)
      .single<{
        email: string | null
        name: string | null
        startort_lat: number | null
        startort_lng: number | null
        lat: number | null
        lng: number | null
      }>()
    if (!hw?.email) return

    const distanzKm = haversineKm(
      hw.startort_lat ?? hw.lat ?? 0,
      hw.startort_lng ?? hw.lng ?? 0,
      ticket.einsatzort_lat,
      ticket.einsatzort_lng,
    )
    const deadline = new Date(Date.now() + timeoutMin * 60 * 1000)
    const deadlineText = `Bitte antworten Sie innerhalb von ${formatiereTimeoutText(timeoutMin)} (bis ${deadline.toLocaleString("de-DE", {
      day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    })}).`

    const { subject, html } = einladungEmail({
      handwerkerName: hw.name || "Handwerker",
      ticketTitel: ticket.titel,
      ticketBeschreibung: ticket.beschreibung || "",
      gewerk: ticket.gewerk || "allgemein",
      dringlichkeit: ticket.dringlichkeit,
      einsatzort: ticket.einsatzort_adresse || "",
      distanzKm,
      auktionEnde: deadlineText,
      ticketId: ticket.id,
    })
    sendEmailFireAndForget({ to: hw.email, subject, html })
  })().catch(err => console.error("[direktvergabe] Einladungs-Mail fehlgeschlagen:", err))

  return { ok: true }
}

/**
 * Sprint BF — Auto-Accept: prüft ob der HW agent_auto_accept=true hat und
 * der empfohlene Preis >= agent_min_auftragswert (NULL = kein Limit). Wenn
 * ja, wird die Einladung sofort über dieselbe Service-Role-Logik wie
 * /api/einladungen/[id]/annehmen angenommen.
 *
 * Defensiv gebaut: bei fehlenden Spalten oder Fehlern wird false
 * zurückgegeben und der normale Einladungs-Flow läuft weiter.
 */
async function pruefeUndFuehreAutoAcceptAus(opts: {
  admin: ReturnType<typeof createServiceRoleClient>
  ticket: DirektvergabeTicketKontext
  hwId: string
  einladungId: string
  preis: number
}): Promise<boolean> {
  const { admin, ticket, hwId, einladungId, preis } = opts

  let autoAccept = false
  let hwEmail: string | null = null
  let hwName: string | null = null
  try {
    const { data: hw } = await admin
      .from("profiles")
      .select("agent_auto_accept, agent_min_auftragswert, email, name")
      .eq("id", hwId)
      .single<{
        agent_auto_accept: boolean | null
        agent_min_auftragswert: number | null
        email: string | null
        name: string | null
      }>()
    if (!hw) return false
    hwEmail = hw.email
    hwName = hw.name
    const minWert = hw.agent_min_auftragswert ?? null
    autoAccept = hw.agent_auto_accept === true && (minWert === null || preis >= minWert)
  } catch (err) {
    console.warn("[direktvergabe] auto-accept Profilabfrage fehlgeschlagen (Spalten fehlen?):", err)
    return false
  }

  if (!autoAccept) return false

  try {
    // 1. Einladung "umsetzen" — conditional Update als Lock gegen Race
    const { data: einlUpdated } = await admin
      .from("einladungen")
      .update({ status: "angebot" })
      .eq("id", einladungId)
      .eq("status", "offen")
      .select("id")
    if (!einlUpdated || einlUpdated.length === 0) {
      console.warn("[direktvergabe] auto-accept: Einladung bereits bearbeitet", einladungId)
      return false
    }

    // 2. Ticket vergeben — conditional als zweite Lock-Schicht
    const { data: ticketUpdated } = await admin
      .from("tickets")
      .update({ status: "in_bearbeitung", zugewiesener_hw: hwId, kosten_final: preis })
      .eq("id", ticket.id)
      .eq("status", "offen")
      .select("id, verwalter_id, surge_faktor")
    if (!ticketUpdated || ticketUpdated.length === 0) {
      // Race verloren — Einladung zurückrollen
      await admin.from("einladungen").update({ status: "offen" }).eq("id", einladungId)
      console.warn("[direktvergabe] auto-accept: Ticket bereits vergeben (Race)", ticket.id)
      return false
    }
    const ticketRow = ticketUpdated[0] as { id: string; verwalter_id: string | null; surge_faktor: number | null }

    // 3. Synthetisches Angebot
    await admin.from("angebote").upsert(
      { ticket_id: ticket.id, handwerker_id: hwId, preis, nachricht: "Auto-Accept durch Handwerker-Agent", status: "angenommen" },
      { onConflict: "ticket_id,handwerker_id" },
    )

    // 4. Andere offene Einladungen schließen
    await admin
      .from("einladungen")
      .update({ status: "abgelehnt" })
      .eq("ticket_id", ticket.id)
      .eq("status", "offen")
      .neq("id", einladungId)

    // 5. Provisions-Snapshot
    const surge = ticketRow.surge_faktor ?? 1.0
    let isEarlyAdopter = false
    if (ticketRow.verwalter_id) {
      const { data: vw } = await admin
        .from("profiles")
        .select("early_adopter_bis")
        .eq("id", ticketRow.verwalter_id)
        .maybeSingle<{ early_adopter_bis: string | null }>()
      isEarlyAdopter = !!vw?.early_adopter_bis && new Date(vw.early_adopter_bis).getTime() > Date.now()
    }
    const { finalRate } = effektiveProvisionsRate(0.05, surge, isEarlyAdopter)
    const calc = calculateCommission(preis, finalRate)
    const provisionRow = {
      ticket_id: ticket.id,
      verwalter_id: ticketRow.verwalter_id ?? hwId,
      handwerker_id: hwId,
      auftragswert: preis,
      provision_rate: finalRate,
      provision_betrag: calc.provisionBetrag,
      gesamt: calc.gesamt,
      is_early_adopter: isEarlyAdopter,
    }
    let { error: provisionErr } = await admin.from("provisionen").upsert(provisionRow, { onConflict: "ticket_id" })
    if (provisionErr && /ON CONFLICT|no.*unique|42P10/i.test(provisionErr.message)) {
      await admin.from("provisionen").delete().eq("ticket_id", ticket.id)
      const ins = await admin.from("provisionen").insert(provisionRow)
      provisionErr = ins.error
    }
    if (provisionErr) console.error("[direktvergabe] auto-accept Provisions-Snapshot fehlgeschlagen:", provisionErr.message)

    // 6. Audit-Log
    void logTicketEvent({
      ticketId: ticket.id,
      eventType: "vergeben",
      actorUserId: hwId,
      actorRole: "handwerker",
      eventData: { via: "auto_accept", einladung_id: einladungId, preis },
    })

    // 7. Bestätigungs-Mail an HW + Verwalter-Benachrichtigung (fire-and-forget)
    void (async () => {
      const preisFormatiert = preis.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

      if (hwEmail) {
        const { subject, html } = zuschlagEmail({
          handwerkerName: hwName || "Handwerker",
          ticketTitel: ticket.titel,
          ticketBeschreibung: ticket.beschreibung || "",
          einsatzort: ticket.einsatzort_adresse || "",
          angebotPreis: preis,
          ticketId: ticket.id,
        })
        sendEmailFireAndForget({ to: hwEmail, subject, html })
      }

      if (ticketRow.verwalter_id) {
        const { data: vwProfile } = await admin
          .from("profiles")
          .select("email, name")
          .eq("id", ticketRow.verwalter_id)
          .maybeSingle<{ email: string | null; name: string | null }>()
        if (vwProfile?.email) {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"
          sendEmailFireAndForget({
            to: vwProfile.email,
            subject: `Direktanfrage automatisch angenommen: ${ticket.titel}`,
            html: `
              <p>Hallo ${escapeHtml(vwProfile.name || "")},</p>
              <p><strong>${escapeHtml(hwName || "Ein Handwerker")}</strong> hat Ihre Direktanfrage für
              <b>${escapeHtml(ticket.titel)}</b> zum Preis von <b>${preisFormatiert} €</b>
              automatisch angenommen (Agent-Auto-Accept).</p>
              <p>Der Auftrag ist damit vergeben und befindet sich in Bearbeitung.</p>
              <p><a href="${baseUrl}/dashboard-verwalter/tickets/${ticket.id}">Ticket öffnen</a></p>
            `,
          })
        }
      }
    })().catch(err => console.error("[direktvergabe] auto-accept Mail fehlgeschlagen:", err))

    console.log(`[direktvergabe] auto-accept: Ticket ${ticket.id} automatisch an HW ${hwId} vergeben (${preis} €)`)
    return true
  } catch (err) {
    console.error("[direktvergabe] auto-accept fehlgeschlagen:", err)
    return false
  }
}

/**
 * Schritt 0/1 (KONZEPT Abschnitt 4) — Einstiegspunkt für
 * /api/auction/start (zeitnah/planbar ohne Stamm-HW): Kandidatenliste
 * bilden, ersten verfügbaren Kandidaten anfragen.
 *
 * Rückgabe `modus: "mass_invite"` bedeutet: keine Kandidaten im Radius
 * ODER alle Top-10 im relevanten Zeitfenster Google-Cal-blockiert →
 * Aufrufer soll sofort die bestehende Mass-Invite-Auktion öffnen
 * (fuehreMassInviteAus), kein Warten auf Eskalationen nötig.
 */
export async function starteDirektvergabe(
  ticket: DirektvergabeTicketKontext,
): Promise<
  | { ok: true; modus: "direktvergabe"; kandidaten: DirektvergabeKandidat[]; index: number }
  | { ok: true; modus: "mass_invite" }
> {
  const kandidaten = await bildeKandidatenliste(ticket)
  if (kandidaten.length === 0) {
    return { ok: true, modus: "mass_invite" }
  }

  const index = await naechsterVerfuegbarerKandidat(kandidaten, 0, ticket.dringlichkeit)
  if (index === null) {
    return { ok: true, modus: "mass_invite" }
  }

  await sendeDirektvergabeAnfrage({ ticket, kandidaten, index })
  return { ok: true, modus: "direktvergabe", kandidaten, index }
}

/**
 * Schritt 5/6 (KONZEPT Abschnitt 4) — Eskalation zum nächsten
 * Kandidaten, aufgerufen von:
 * - Cron "direktvergabe-eskalation" (Timeout, direktvergabe_angefragt_am
 *   + direktvergabe_timeout_min überschritten)
 * - /api/einladungen/[id]/ablehnen (HW lehnt explizit ab)
 *
 * Markiert die aktuelle einladungen-Zeile als 'abgelaufen' (no-op falls
 * bereits 'abgelehnt' durch die Ablehnen-Route), erhöht
 * direktvergabe_index und fragt den nächsten verfügbaren Kandidaten an —
 * oder eröffnet nach MAX_ESKALATIONEN bzw. erschöpfter Liste den
 * Mass-Invite-Fallback.
 *
 * Race-Condition (Cron + manueller Accept gleichzeitig): wird hier durch
 * den Status-Check (`status !== 'offen'` → keine Aktion) sowie die
 * UNIQUE(ticket_id, handwerker_id)-Constraint + den
 * direktvergabe_index-Check in /api/einladungen/[id]/annehmen abgedeckt
 * (siehe dort).
 */
export async function eskaliereDirektvergabe(
  ticketId: string,
): Promise<{ ok: boolean; ergebnis: "naechster_kandidat" | "mass_invite_fallback" | "keine_aktion" }> {
  const admin = createServiceRoleClient()

  const { data: ticket } = await admin
    .from("tickets")
    .select("id, titel, beschreibung, gewerk, dringlichkeit, einsatzort_lat, einsatzort_lng, einsatzort_adresse, status, zugewiesener_hw, direktvergabe_kandidaten, direktvergabe_index")
    .eq("id", ticketId)
    .single<{
      id: string
      titel: string
      beschreibung: string | null
      gewerk: string | null
      dringlichkeit: Dringlichkeit | null
      einsatzort_lat: number | null
      einsatzort_lng: number | null
      einsatzort_adresse: string | null
      status: string
      zugewiesener_hw: string | null
      direktvergabe_kandidaten: DirektvergabeKandidat[] | null
      direktvergabe_index: number
    }>()

  if (!ticket) return { ok: false, ergebnis: "keine_aktion" }

  // Bereits vergeben / nicht mehr offen / altes Mass-Invite-Flow (NULL =
  // Marker, siehe Migration) → nichts zu tun. Deckt auch die
  // Race-Condition Cron-vs-Annahme ab.
  if (
    ticket.status !== "offen" ||
    ticket.zugewiesener_hw != null ||
    ticket.direktvergabe_kandidaten == null ||
    ticket.einsatzort_lat == null ||
    ticket.einsatzort_lng == null ||
    !ticket.dringlichkeit
  ) {
    return { ok: true, ergebnis: "keine_aktion" }
  }

  const kandidaten = ticket.direktvergabe_kandidaten
  const currentIndex = ticket.direktvergabe_index
  const currentKandidat = kandidaten[currentIndex]

  // Aktuelle Anfrage als abgelaufen markieren (no-op falls die
  // Ablehnen-Route den Status bereits auf 'abgelehnt' gesetzt hat —
  // .eq('status','offen') greift dann nicht).
  if (currentKandidat) {
    await admin
      .from("einladungen")
      .update({ status: "abgelaufen" })
      .eq("ticket_id", ticketId)
      .eq("handwerker_id", currentKandidat.hw_id)
      .eq("status", "offen")
  }

  const ticketKontext: DirektvergabeTicketKontext = {
    id: ticket.id,
    titel: ticket.titel,
    beschreibung: ticket.beschreibung,
    gewerk: ticket.gewerk,
    dringlichkeit: ticket.dringlichkeit,
    einsatzort_lat: ticket.einsatzort_lat,
    einsatzort_lng: ticket.einsatzort_lng,
    einsatzort_adresse: ticket.einsatzort_adresse,
  }

  const naechsterIndex = currentIndex + 1

  // N=3-Cap (auch für Single-Kandidat-Fälle: 1 Kandidat, Index 0 →
  // naechsterIndex=1 >= length=1 → sofortiger Fallback, kein Warten).
  if (naechsterIndex >= MAX_ESKALATIONEN || naechsterIndex >= kandidaten.length) {
    await fuehreMassInviteFallback(ticketKontext)
    return { ok: true, ergebnis: "mass_invite_fallback" }
  }

  const idx = await naechsterVerfuegbarerKandidat(kandidaten, naechsterIndex, ticket.dringlichkeit)
  if (idx === null || idx >= MAX_ESKALATIONEN) {
    await fuehreMassInviteFallback(ticketKontext)
    return { ok: true, ergebnis: "mass_invite_fallback" }
  }

  await sendeDirektvergabeAnfrage({ ticket: ticketKontext, kandidaten, index: idx })
  return { ok: true, ergebnis: "naechster_kandidat" }
}

/**
 * Schritt 6 (KONZEPT Abschnitt 4) — Fallback: Ticket auf die heutige
 * Mass-Invite-Auktion umstellen (status='auktion', Auktionsfenster
 * öffnen) und die bestehende Mass-Invite-Logik ausführen.
 */
export async function fuehreMassInviteFallback(ticket: DirektvergabeTicketKontext): Promise<void> {
  const admin = createServiceRoleClient()
  const config = konfigFuer(ticket.dringlichkeit)
  const start = new Date()
  const ende = berechneAuktionsEnde(start, config.auktionsDauerStunden)

  await admin
    .from("tickets")
    .update({
      status: "auktion",
      auktion_start: start.toISOString(),
      auktion_ende: ende?.toISOString() ?? null,
    })
    .eq("id", ticket.id)

  await fuehreMassInviteAus(ticket, ende)
}

/**
 * Mass-Invite-Logik (Preis je Kandidat via berechneAuftragswert,
 * einladungen-Batch-Upsert, Einladungs-Mails). Extrahiert aus
 * /api/auction/start, damit sie sowohl beim initialen "keine
 * Direktvergabe-Kandidaten gefunden"-Fall als auch beim
 * Eskalations-Fallback (fuehreMassInviteFallback) wiederverwendet werden
 * kann.
 */
export async function fuehreMassInviteAus(
  ticket: DirektvergabeTicketKontext,
  auktionEnde: Date | null,
): Promise<void> {
  const admin = createServiceRoleClient()
  const config = konfigFuer(ticket.dringlichkeit)
  const estimatedH = ESTIMATED_STUNDEN[ticket.dringlichkeit]

  let query = admin
    .from("profiles")
    .select("id, email, name, gewerk, startort_lat, startort_lng, lat, lng, radius_km, basis_stundensatz, basis_preis")
    .eq("rolle", "handwerker")
  if (ticket.gewerk && ticket.gewerk !== "allgemein") {
    query = query.ilike("gewerk", `%${ticket.gewerk}%`)
  }
  const { data: handwerker } = await query.returns<Array<{
    id: string
    email: string | null
    name: string | null
    gewerk: string | null
    startort_lat: number | null
    startort_lng: number | null
    lat: number | null
    lng: number | null
    radius_km: number | null
    basis_stundensatz: number | null
    basis_preis: number | null
  }>>()

  const auktionEndeFormatiert = auktionEnde
    ? auktionEnde.toLocaleString("de-DE", {
        day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—"

  const einladungenBatch: Array<{
    ticket_id: string
    handwerker_id: string
    empfohlener_preis: number
    status: string
  }> = []
  const eingeladene: typeof handwerker = []
  const imRadiusFuerPreis: Array<{ hw: NonNullable<typeof handwerker>[number]; entfernungKm: number }> = []

  for (const hw of handwerker ?? []) {
    const hwLat = hw.startort_lat ?? hw.lat
    const hwLng = hw.startort_lng ?? hw.lng
    if (hwLat == null || hwLng == null) continue
    const distanz = haversineKm(hwLat, hwLng, ticket.einsatzort_lat, ticket.einsatzort_lng)
    const radius = hw.radius_km ?? config.radiusKm
    if (distanz > radius) continue
    imRadiusFuerPreis.push({ hw, entfernungKm: distanz })
  }

  const auslastungen = await Promise.all(
    imRadiusFuerPreis.map(({ hw }) => berechneAuslastung(hw.id).catch(() => null)),
  )

  imRadiusFuerPreis.forEach(({ hw, entfernungKm }, i) => {
    const stundensatz = hw.basis_stundensatz ?? hw.basis_preis ?? DEFAULT_STUNDENSATZ
    const preisBreakdown = berechneAuftragswert({
      stundensatz,
      geschaetzteStunden: estimatedH,
      surgeFaktor: config.surgeFaktor,
      entfernungKm,
      auslastung: auslastungen[i],
    })

    einladungenBatch.push({
      ticket_id: ticket.id,
      handwerker_id: hw.id,
      empfohlener_preis: preisBreakdown.gesamt,
      status: "offen",
    })
    eingeladene.push(hw)
  })

  if (einladungenBatch.length > 0) {
    const { error: einlErr } = await admin
      .from("einladungen")
      .upsert(einladungenBatch, { onConflict: "ticket_id,handwerker_id" })
    if (einlErr) {
      console.error("[direktvergabe] Mass-Invite einladungen-Upsert fehlgeschlagen:", einlErr.message)
    }
  }

  for (const hw of eingeladene) {
    if (!hw.email) continue
    const { subject, html } = einladungEmail({
      handwerkerName: hw.name || "Handwerker",
      ticketTitel: ticket.titel,
      ticketBeschreibung: ticket.beschreibung || "",
      gewerk: ticket.gewerk || "allgemein",
      dringlichkeit: ticket.dringlichkeit,
      einsatzort: ticket.einsatzort_adresse || "",
      distanzKm: haversineKm(
        hw.startort_lat ?? hw.lat ?? 0,
        hw.startort_lng ?? hw.lng ?? 0,
        ticket.einsatzort_lat,
        ticket.einsatzort_lng,
      ),
      auktionEnde: auktionEndeFormatiert,
      ticketId: ticket.id,
    })
    sendEmailFireAndForget({ to: hw.email, subject, html })
  }
}

// schaetzeFahrzeitMin wird aktuell nicht direkt in dieser Datei
// verwendet (steckt in berechneAuftragswert), Re-Export für
// Annahme-/Ablehnen-Routen, die ggf. Fahrzeit fürs UI brauchen.
export { schaetzeFahrzeitMin }
