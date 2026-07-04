import { verifyStatusToken } from "@/lib/status-token"
import { createServiceRoleClient } from "@/lib/supabase-server"

// Zero-Login-Statusseite für Mieter (Produkt-Review 2026-07-03).
//
// Erreichbar ohne Login über den signierten Link aus der Bestätigungs-Mail
// (/status/[ticketId]?t=HMAC — siehe lib/status-token). Zeigt bewusst nur
// einen minimalen Lese-Status in Laien-Sprache und großer Schrift —
// gedacht für Nutzer, die sich nicht (mehr) einloggen wollen/können.
// Die Middleware nimmt /status vom Beta-Basic-Auth-Gate aus.

export const dynamic = "force-dynamic"

// Laien-Schritte: Meldung → Suche → Reparatur → Prüfung → Fertig
const SCHRITTE = [
  "Meldung eingegangen",
  "Handwerker wird gesucht",
  "Handwerker beauftragt",
  "Wird geprüft",
  "Fertig",
] as const

function schrittFuerStatus(status: string): number {
  switch (status) {
    case "gemeldet":
    case "offen":
    case "rueckfrage":
      return 1
    case "auktion":
    case "angebote_da":
      return 2
    case "in_bearbeitung":
    case "reklamiert":
      return 3
    case "fertiggestellt_hw":
      return 4
    case "erledigt":
      return 5
    default:
      return 1
  }
}

export default async function StatusSeite({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { t?: string }
}) {
  const gueltig = verifyStatusToken(params.id, searchParams.t)

  let ticket: {
    titel: string
    status: string
    created_at: string
  } | null = null
  let termin: { datum: string; von: string } | null = null

  if (gueltig) {
    const admin = createServiceRoleClient()
    const { data } = await admin
      .from("tickets")
      .select("titel, status, created_at")
      .eq("id", params.id)
      .maybeSingle<{ titel: string; status: string; created_at: string }>()
    ticket = data

    if (data) {
      const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })
      const { data: t } = await admin
        .from("termine")
        .select("datum, von")
        .eq("ticket_id", params.id)
        .eq("status", "bestaetigt")
        .gte("datum", heute)
        .order("datum")
        .limit(1)
        .maybeSingle<{ datum: string; von: string }>()
      termin = t
    }
  }

  if (!gueltig || !ticket) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-line p-8 text-center">
          <div className="text-3xl mb-3" aria-hidden>🔒</div>
          <h1 className="text-xl font-bold text-ink mb-2">Link ungültig</h1>
          <p className="text-base text-ink-secondary leading-relaxed">
            Dieser Status-Link ist nicht (mehr) gültig. Bitte nutzen Sie den
            Link aus Ihrer Bestätigungs-E-Mail oder melden Sie sich bei Ihrer
            Hausverwaltung.
          </p>
        </div>
      </main>
    )
  }

  const aktiv = schrittFuerStatus(ticket.status)
  const datum = new Date(ticket.created_at).toLocaleDateString("de-DE", {
    day: "numeric", month: "long", year: "numeric",
  })
  const terminText = termin
    ? new Date(`${termin.datum}T12:00:00`).toLocaleDateString("de-DE", {
        weekday: "long", day: "numeric", month: "long",
      }) + ` um ${termin.von.slice(0, 5)} Uhr`
    : null

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-line p-8">
        <div className="text-sm font-bold uppercase tracking-wider text-accent mb-1">
          Reparo — Ihre Schadensmeldung
        </div>
        <h1 className="text-xl font-bold text-ink mb-1">{ticket.titel}</h1>
        <p className="text-base text-ink-muted mb-6">Gemeldet am {datum}</p>

        <ol className="space-y-0">
          {SCHRITTE.map((label, i) => {
            const nr = i + 1
            const erledigt = nr < aktiv
            const istAktiv = nr === aktiv
            return (
              <li key={label} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      erledigt
                        ? "bg-accent text-white"
                        : istAktiv
                          ? "bg-accent/15 text-accent border-2 border-accent"
                          : "bg-line text-ink-muted"
                    }`}
                    aria-hidden
                  >
                    {erledigt ? "✓" : nr}
                  </div>
                  {nr < SCHRITTE.length && (
                    <div className={`w-0.5 flex-1 min-h-6 ${erledigt ? "bg-accent" : "bg-line"}`} />
                  )}
                </div>
                <div className={`pb-6 pt-1 text-base ${istAktiv ? "font-semibold text-ink" : erledigt ? "text-ink-secondary" : "text-ink-muted"}`}>
                  {label}
                  {istAktiv && ticket.status === "rueckfrage" && (
                    <span className="block text-sm font-normal text-warm-dark mt-1">
                      Ihre Verwaltung hat eine Rückfrage — bitte E-Mails prüfen.
                    </span>
                  )}
                  {istAktiv && ticket.status === "reklamiert" && (
                    <span className="block text-sm font-normal text-danger mt-1">
                      Reklamation in Bearbeitung.
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        {terminText && (
          <div className="mt-2 p-4 rounded-xl bg-accent/5 border border-accent/20">
            <div className="text-sm font-semibold text-accent mb-0.5">Nächster Termin</div>
            <div className="text-base text-ink">{terminText}</div>
          </div>
        )}

        <p className="mt-6 text-sm text-ink-muted leading-relaxed">
          Diese Seite aktualisiert sich bei jedem Aufruf. Fragen? Wenden Sie
          sich an Ihre Hausverwaltung.
        </p>
      </div>
    </main>
  )
}
