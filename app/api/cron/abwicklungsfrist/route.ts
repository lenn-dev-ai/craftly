import { NextResponse, type NextRequest } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { pruefeCronAuth, meldeCronHeartbeat, mitParallelitaet } from "@/lib/cron/auth"
import { PENALTY_AMOUNT_CENTS } from "@/lib/stripe"
import { sendEmailFireAndForget } from "@/lib/email/send"
import { fristWarnungEmail, fristAbgelaufenEmail } from "@/lib/email/templates"

// POST /api/cron/abwicklungsfrist
//
// Zwei-Stufen-Eskalation für in_bearbeitung-Tickets:
//
// Stufe 1 — Warnung nach WARN_NACH_TAGEN (10):
//   Mail an HW + Verwalter dass die Frist bald läuft. Ticket bleibt
//   unverändert. Dedup via tickets.frist_warnung_gesendet (boolean).
//
// Stufe 2 — Frist nach FRIST_TAGE (14):
//   1. Status zurück auf 'auktion' (Verwalter sieht Job wieder)
//   2. zugewiesener_hw → null
//   3. -10 auf profiles.angebotstreue des HW (Penalty, min 0)
//
// Auth: x-cron-secret oder Admin.

const WARN_NACH_TAGEN = 10
const FRIST_TAGE = 14
const PENALTY_PUNKTE = 10

interface UeberfaelligesTicket {
  id: string
  titel: string
  zugewiesener_hw: string | null
  verwalter_id: string | null
  erstellt_von: string
  created_at: string
  frist_warnung_gesendet?: boolean | null
}

export async function POST(request: NextRequest) {
  const auth = await pruefeCronAuth(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  meldeCronHeartbeat("abwicklungsfrist", auth.via)

  const admin = createServiceRoleClient()
  const warnSchwelle = new Date(Date.now() - WARN_NACH_TAGEN * 86400_000).toISOString()
  const fristSchwelle = new Date(Date.now() - FRIST_TAGE * 86400_000).toISOString()

  // Alle in_bearbeitung-Tickets älter als die Warn-Schwelle laden.
  // Wir filtern dann in JS Warning vs. Frist — ein einzelner Query.
  // frist_warnung_gesendet ist optional (Spalte ggf. nicht migriert);
  // best-effort selecten, fail in JS abfangen.
  const { data: ueberfaellig, error } = await admin
    .from("tickets")
    .select("id, titel, zugewiesener_hw, verwalter_id, erstellt_von, created_at, frist_warnung_gesendet")
    .eq("status", "in_bearbeitung")
    .not("zugewiesener_hw", "is", null)
    .lt("created_at", warnSchwelle)
    .returns<UeberfaelligesTicket[]>()

  if (error && !/frist_warnung_gesendet/.test(error.message)) {
    return NextResponse.json({ error: "Query: " + error.message }, { status: 500 })
  }

  // Fallback wenn Spalte noch nicht migriert ist
  let liste = ueberfaellig
  if (error) {
    const retry = await admin
      .from("tickets")
      .select("id, titel, zugewiesener_hw, verwalter_id, erstellt_von, created_at")
      .eq("status", "in_bearbeitung")
      .not("zugewiesener_hw", "is", null)
      .lt("created_at", warnSchwelle)
      .returns<UeberfaelligesTicket[]>()
    liste = retry.data
  }

  const ergebnisse: Array<{
    ticketId: string
    titel: string
    handwerkerId: string | null
    aktion: "warnung-gesendet" | "zurueck-zur-auktion" | "kein-handlungsbedarf" | "fehler"
    fehler?: string
  }> = []

  // Mails an HW + Verwalter (fire-and-forget). Empfänger best-effort laden —
  // fehlende E-Mail-Adresse blockiert die Eskalation nicht.
  async function sendeFristMails(
    t: UeberfaelligesTicket,
    hwId: string,
    stufe: "warnung" | "abgelaufen",
    tageBisFrist: number,
  ) {
    const ids = [hwId, t.verwalter_id].filter(Boolean) as string[]
    const { data: profile } = await admin
      .from("profiles")
      .select("id, name, email")
      .in("id", ids)
      .returns<Array<{ id: string; name: string | null; email: string | null }>>()

    for (const p of profile ?? []) {
      if (!p.email) continue
      const fuer = p.id === hwId ? "handwerker" as const : "verwalter" as const
      const tpl = stufe === "warnung"
        ? fristWarnungEmail({ name: p.name ?? "", fuer, ticketTitel: t.titel, tageBisFrist, ticketId: t.id })
        : fristAbgelaufenEmail({ name: p.name ?? "", fuer, ticketTitel: t.titel, ticketId: t.id })
      sendEmailFireAndForget({ to: p.email, subject: tpl.subject, html: tpl.html })
    }
  }

  // Audit-Fix 11.07.: parallel statt sequenziell — 4 DB-Ops pro Ticket in
  // Serie sprengen das Netlify-10s-Limit ab ~30 überfälligen Tickets.
  const laeufe = await mitParallelitaet(liste ?? [], 5, async (t: UeberfaelligesTicket) => {

    if (!t.zugewiesener_hw) return null
    const createdMs = new Date(t.created_at).getTime()
    const istUeberFrist = createdMs < Date.parse(fristSchwelle)

    // === Stufe 2 — Frist erreicht: Ticket zurück + Penalty ===
    if (istUeberFrist) {
      const neuesEnde = new Date(Date.now() + 24 * 3600_000).toISOString()
      const { error: ticketErr } = await admin.from("tickets").update({
        status: "auktion",
        zugewiesener_hw: null,
        auktion_ende: neuesEnde,
      }).eq("id", t.id)
      if (ticketErr) {
        return { ticketId: t.id, titel: t.titel, handwerkerId: t.zugewiesener_hw, aktion: "fehler" as const, fehler: ticketErr.message }
      }

      const { data: hw } = await admin.from("profiles")
        .select("angebotstreue").eq("id", t.zugewiesener_hw).single<{ angebotstreue: number | null }>()
      const aktuellerScore = hw?.angebotstreue ?? 100
      const neuerScore = Math.max(0, aktuellerScore - PENALTY_PUNKTE)
      await admin.from("profiles").update({ angebotstreue: neuerScore }).eq("id", t.zugewiesener_hw)

      // Geld-Penalty: aktuell nur Markierung in der DB. Die echte
      // Stripe-Buchung läuft async über eine separate Iteration sobald
      // PaymentMethod-Setup oder Connect-Reversal-Architektur steht.
      // Bis dahin: penalty_status='manual_pending' — Reparo kann mit
      // dem HW manuell abrechnen oder bei der nächsten Auszahlung
      // verrechnen.
      //
      // best-effort: penalty-Spalten setzen. Failure wenn Migration
      // 20260527 noch nicht angewendet ist — dann nur Score-Penalty.
      const { error: penaltyErr } = await admin.from("tickets").update({
        penalty_status: "manual_pending",
        penalty_amount_cents: PENALTY_AMOUNT_CENTS,
        penalty_buchung_versucht_am: new Date().toISOString(),
      }).eq("id", t.id)
      if (penaltyErr && !/penalty_/.test(penaltyErr.message)) {
        console.warn("[abwicklungsfrist] penalty-mark fail:", penaltyErr.message)
      }

      // Beide Seiten informieren: Auftrag entzogen / zurück in der Vergabe.
      await sendeFristMails(t, t.zugewiesener_hw, "abgelaufen", 0)

      return {
        ticketId: t.id,
        titel: t.titel,
        handwerkerId: t.zugewiesener_hw,
        aktion: "zurueck-zur-auktion" as const,
      }
    }

    // === Stufe 1 — Warnung (10–13 Tage alt, noch keine Warnung gesendet) ===
    if (t.frist_warnung_gesendet) {
      return {
        ticketId: t.id, titel: t.titel, handwerkerId: t.zugewiesener_hw,
        aktion: "kein-handlungsbedarf" as const,
      }
    }

    // Best-effort: Spalte setzen (fail = Spalte noch nicht migriert, ignorieren)
    await admin.from("tickets")
      .update({ frist_warnung_gesendet: true })
      .eq("id", t.id)
      .then(({ error: err }) => {
        if (err && !/frist_warnung_gesendet/.test(err.message)) {
          console.warn("[abwicklungsfrist] warning-flag fail:", err.message)
        }
      })

    // Warnung an HW + Verwalter: Frist läuft in ~N Tagen ab.
    const tageBisFrist = Math.max(1, FRIST_TAGE - Math.floor((Date.now() - createdMs) / 86400_000))
    await sendeFristMails(t, t.zugewiesener_hw, "warnung", tageBisFrist)

    return {
      ticketId: t.id,
      titel: t.titel,
      handwerkerId: t.zugewiesener_hw,
      aktion: "warnung-gesendet" as const,
    }
    })
  for (const lauf of laeufe) {
    if (!lauf.ok) {
      ergebnisse.push({ ticketId: lauf.item.id, titel: lauf.item.titel, handwerkerId: lauf.item.zugewiesener_hw, aktion: "fehler", fehler: lauf.fehler })
    } else if (lauf.wert) {
      ergebnisse.push(lauf.wert)
    }
  }

  return NextResponse.json({
    ok: true,
    geprueft: liste?.length ?? 0,
    bearbeitet: ergebnisse.length,
    warnNachTagen: WARN_NACH_TAGEN,
    fristTage: FRIST_TAGE,
    penaltyPunkte: PENALTY_PUNKTE,
    ergebnisse,
  })
}
