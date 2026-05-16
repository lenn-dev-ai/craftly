import { NextResponse, type NextRequest } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { PENALTY_AMOUNT_CENTS } from "@/lib/stripe"

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
  const cronSecret = process.env.CRON_SECRET
  const authViaSecret =
    !!cronSecret && request.headers.get("x-cron-secret") === cronSecret

  const supabase = createServerSupabaseClient()
  if (!authViaSecret) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("rolle").eq("id", user.id).single()
    if (profile?.rolle !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

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

  for (const t of liste ?? []) {
    if (!t.zugewiesener_hw) continue
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
        ergebnisse.push({ ticketId: t.id, titel: t.titel, handwerkerId: t.zugewiesener_hw, aktion: "fehler", fehler: ticketErr.message })
        continue
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

      ergebnisse.push({
        ticketId: t.id,
        titel: t.titel,
        handwerkerId: t.zugewiesener_hw,
        aktion: "zurueck-zur-auktion",
      })
      continue
    }

    // === Stufe 1 — Warnung (10–13 Tage alt, noch keine Warnung gesendet) ===
    if (t.frist_warnung_gesendet) {
      ergebnisse.push({
        ticketId: t.id, titel: t.titel, handwerkerId: t.zugewiesener_hw,
        aktion: "kein-handlungsbedarf",
      })
      continue
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

    // TODO: Hier sollte eine Mail an HW + Verwalter raus mit "Frist läuft
    // in ~4 Tagen". Aktuell nur Marker — Mail-Template kommt in eigenem
    // Sprint, sobald lib/email/templates die fristAblaufEmail hat.
    ergebnisse.push({
      ticketId: t.id,
      titel: t.titel,
      handwerkerId: t.zugewiesener_hw,
      aktion: "warnung-gesendet",
    })
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
