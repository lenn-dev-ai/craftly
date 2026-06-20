import { createServiceRoleClient } from "@/lib/supabase-server"
import { konfigFuer, berechneAuktionsEnde } from "@/lib/auction/auction-manager"
import type { Dringlichkeit } from "@/lib/auction/smart-score"
import { findeUndErzeugeStammAnfrage } from "@/lib/auction/stamm-routing"
import {
  starteDirektvergabe,
  fuehreMassInviteAus,
  bildeKandidatenliste,
  type DirektvergabeTicketKontext,
} from "@/lib/auction/direktvergabe"
import type { SupabaseClient } from "@supabase/supabase-js"

interface VerwalterPraeferenzen {
  autoVergabeAktiv: boolean
  budgetEur: number | null
}

// Lädt die Verwalter-Leitplanken (Sprint BD) defensiv: fehlen die Spalten
// (z.B. Migration noch nicht angewandt), fällt alles auf die sicheren
// Defaults zurück (Auto-Vergabe aktiv, kein Budget-Limit).
async function ladeVerwalterPraeferenzen(
  admin: SupabaseClient,
  verwalterId: string | null,
): Promise<VerwalterPraeferenzen> {
  const defaults: VerwalterPraeferenzen = { autoVergabeAktiv: true, budgetEur: null }
  if (!verwalterId) return defaults
  try {
    const { data, error } = await admin
      .from("profiles")
      .select("auto_vergabe_aktiv, auto_vergabe_budget_eur")
      .eq("id", verwalterId)
      .single<{ auto_vergabe_aktiv: boolean | null; auto_vergabe_budget_eur: number | null }>()
    if (error || !data) return defaults
    return {
      autoVergabeAktiv: data.auto_vergabe_aktiv ?? true,
      budgetEur: data.auto_vergabe_budget_eur ?? null,
    }
  } catch {
    return defaults
  }
}

// Sprint BD — Auto-Vergabe bei Ticket-Erstellung.
//
// Das strategische Kernprinzip von Reparo ist "KI entscheidet, Mensch
// genehmigt — nicht umgekehrt". Bis Sprint BD lief die Vergabe-Engine
// (Stamm-HW-Vorzug → sequenzielle Direktvergabe → Mass-Invite-Fallback)
// NUR, wenn der Verwalter im Marktplatz manuell "Auction" klickte. Damit
// war der Verwalter der Auslöser — das widersprach dem Passiv-Versprechen.
//
// Diese Funktion kapselt denselben generalisierten zeitnah/planbar-Pfad
// wie /api/auction/start, aber service-role-basiert und ohne authentifi-
// zierten Verwalter, damit sie direkt bei der Ticket-Erstellung laufen
// kann — egal ob der Verwalter (telefonisch erfasst) oder der Mieter
// (Melden-Wizard) das Ticket angelegt hat.
//
// Die Dringlichkeit wird aus ticket.prioritaet abgeleitet (planbar |
// zeitnah | notfall). ALLE Dringlichkeiten laufen über dieselbe
// sequenzielle Direktvergabe: der am besten passende Handwerker bekommt
// eine 1:1-Anfrage mit gestaffeltem Timeout (notfall 15 Min, zeitnah 2 h,
// planbar 24 h). Antwortet er nicht oder lehnt ab, eskaliert der Cron
// "direktvergabe-eskalation" automatisch zum nächsten Kandidaten; nach 3
// Versuchen öffnet die Mass-Invite-Auktion. Das synchrone Notfall-Sofort-
// Assignment aus /api/auction/start bleibt als manuelle Verwalter-Aktion
// erhalten (Fallback-Button im Marktplatz).
//
// Best-effort: Fehler werden geloggt, aber niemals an den Aufrufer
// geworfen — die Ticket-Erstellung darf nie an der Vergabe scheitern. Bei
// einem Fehler bleibt das Ticket schlicht 'offen' und der Verwalter kann
// im Marktplatz manuell eingreifen (genau der bestehende Fallback).

const ERLAUBTE_DRINGLICHKEITEN: Dringlichkeit[] = ["notfall", "zeitnah", "planbar"]

function dringlichkeitAusPrioritaet(prioritaet: string | null): Dringlichkeit {
  if (prioritaet && (ERLAUBTE_DRINGLICHKEITEN as string[]).includes(prioritaet)) {
    return prioritaet as Dringlichkeit
  }
  // Altbestand/unbekannt → konservativ planbar (längster Timeout, kein
  // unnötiger Surge).
  return "planbar"
}

export type AutoVergabeErgebnis =
  | { ok: true; modus: "stamm_anfrage" | "direktvergabe" | "auktion" | "uebersprungen"; grund?: string }
  | { ok: false; grund: string }

export interface AutoVergabeOptions {
  /**
   * Sprint BD "Sicherheitsnetz": wenn true, startet die Vergabe nur bei
   * Notfall-Tickets sofort. Zeitnah/planbar bleiben 'offen' und warten auf
   * die Freigabe des Verwalters (bzw. später Auto-Confirm über die
   * Verwalter-Präferenzen). Gedacht für den Mieter-Melden-Flow, damit
   * unsinnige/doppelte Meldungen nicht ungeprüft kostenpflichtige Einsätze
   * auslösen. Verwalter-erstellte Tickets rufen ohne diese Option auf.
   */
  nurNotfallSofort?: boolean
}

/**
 * Startet die automatische Vergabe für ein frisch erstelltes Ticket.
 * Idempotent + defensiv: greift nur, wenn das Ticket wirklich noch offen,
 * unzugewiesen und geocodiert ist und noch keine Vergabe-Kette läuft.
 */
export async function vergebeTicketAutomatisch(
  ticketId: string,
  options: AutoVergabeOptions = {},
): Promise<AutoVergabeErgebnis> {
  try {
    const admin = createServiceRoleClient()

    const { data: ticket, error } = await admin
      .from("tickets")
      .select("id, titel, beschreibung, gewerk, prioritaet, status, zugewiesener_hw, einsatzort_lat, einsatzort_lng, einsatzort_adresse, objekt_id, verwalter_id, direktvergabe_kandidaten")
      .eq("id", ticketId)
      .single<{
        id: string
        titel: string
        beschreibung: string | null
        gewerk: string | null
        prioritaet: string | null
        status: string
        zugewiesener_hw: string | null
        einsatzort_lat: number | null
        einsatzort_lng: number | null
        einsatzort_adresse: string | null
        objekt_id: string | null
        verwalter_id: string | null
        direktvergabe_kandidaten: unknown
      }>()

    if (error || !ticket) {
      return { ok: false, grund: `ticket_not_found: ${error?.message ?? "null"}` }
    }

    // --- Guards: nur frische, vergebbare Tickets ---
    if (ticket.status !== "offen") {
      return { ok: true, modus: "uebersprungen", grund: `status_${ticket.status}` }
    }
    if (ticket.zugewiesener_hw) {
      return { ok: true, modus: "uebersprungen", grund: "bereits_zugewiesen" }
    }
    if (ticket.direktvergabe_kandidaten != null) {
      // Eine Vergabe-Kette läuft bereits → kein Doppel-Start.
      return { ok: true, modus: "uebersprungen", grund: "vergabe_laeuft_bereits" }
    }
    // Läuft bereits eine 1:1-Stamm-Anfrage? Dann nicht erneut anstoßen
    // (verhindert Doppel-Anfragen, wenn z.B. der Auto-Freigabe-Cron ein
    // Ticket erneut aufgreift, das schon beim Anlegen einen Stamm-HW
    // angefragt hat).
    const { data: offeneStamm } = await admin
      .from("stamm_anfragen")
      .select("id")
      .eq("ticket_id", ticket.id)
      .not("status", "in", "(abgelehnt,abgelaufen)")
      .limit(1)
    if (offeneStamm && offeneStamm.length > 0) {
      return { ok: true, modus: "uebersprungen", grund: "stamm_anfrage_laeuft" }
    }
    if (ticket.einsatzort_lat == null || ticket.einsatzort_lng == null) {
      // Ohne Koordinaten kann die Radius-Suche nicht ranken → Ticket
      // bleibt offen, Verwalter sieht im Marktplatz den Hinweis.
      return { ok: true, modus: "uebersprungen", grund: "kein_einsatzort" }
    }

    const dringlichkeit = dringlichkeitAusPrioritaet(ticket.prioritaet)

    // Sicherheitsnetz (Mieter-Flow): nur Notfälle laufen ungeprüft sofort.
    if (options.nurNotfallSofort && dringlichkeit !== "notfall") {
      return { ok: true, modus: "uebersprungen", grund: "wartet_auf_verwalter" }
    }

    const config = konfigFuer(dringlichkeit)

    // --- Verwalter-Leitplanken (Sprint BD) ---
    const prefs = await ladeVerwalterPraeferenzen(admin, ticket.verwalter_id)
    if (!prefs.autoVergabeAktiv) {
      // Master-Schalter aus → Verwalter vergibt manuell. Ticket bleibt offen.
      return { ok: true, modus: "uebersprungen", grund: "auto_vergabe_deaktiviert" }
    }

    // --- Schritt 1: Stamm-HW-Vorzug (wie /api/auction/start) ---
    if (ticket.verwalter_id) {
      const stamm = await findeUndErzeugeStammAnfrage({
        ticketId: ticket.id,
        verwalterId: ticket.verwalter_id,
        objektId: ticket.objekt_id,
        gewerk: ticket.gewerk,
      })
      if (stamm.matched) {
        await admin
          .from("tickets")
          .update({ dringlichkeit, surge_faktor: config.surgeFaktor })
          .eq("id", ticket.id)
        return { ok: true, modus: "stamm_anfrage" }
      }
    }

    const ticketKontext: DirektvergabeTicketKontext = {
      id: ticket.id,
      titel: ticket.titel,
      beschreibung: ticket.beschreibung,
      gewerk: ticket.gewerk,
      dringlichkeit,
      einsatzort_lat: ticket.einsatzort_lat,
      einsatzort_lng: ticket.einsatzort_lng,
      einsatzort_adresse: ticket.einsatzort_adresse,
    }

    // --- Budget-Leitplanke (Sprint BD): nur wenn ein Limit gesetzt ist ---
    // Stamm-HW (oben) sind als vertrauenswürdig immer erlaubt; die
    // Budget-Grenze greift erst bei der Markt-Direktvergabe. Wir bilden die
    // Kandidatenliste einmal vorab und prüfen den Preis des Top-Kandidaten.
    if (prefs.budgetEur != null) {
      const vorschau = await bildeKandidatenliste(ticketKontext)
      const top = vorschau[0]
      if (top && top.preis > prefs.budgetEur) {
        // Über Budget → keine Auto-Vergabe. Ticket bleibt offen, der
        // Verwalter sieht es im Marktplatz und kann bewusst freigeben.
        return { ok: true, modus: "uebersprungen", grund: "ueber_budget" }
      }
    }

    // --- Schritt 2: sequenzielle Direktvergabe (Top-Kandidat zuerst) ---
    const direktvergabe = await starteDirektvergabe(ticketKontext)

    if (direktvergabe.modus === "direktvergabe") {
      await admin
        .from("tickets")
        .update({ dringlichkeit, surge_faktor: config.surgeFaktor })
        .eq("id", ticket.id)
      return { ok: true, modus: "direktvergabe" }
    }

    // --- Schritt 3: Mass-Invite-Fallback (kein Kandidat im Radius) ---
    const start = new Date()
    const ende = berechneAuktionsEnde(start, config.auktionsDauerStunden)
    await admin
      .from("tickets")
      .update({
        dringlichkeit,
        surge_faktor: config.surgeFaktor,
        auktion_start: start.toISOString(),
        auktion_ende: ende?.toISOString() ?? null,
        status: "auktion",
      })
      .eq("id", ticket.id)

    void fuehreMassInviteAus(ticketKontext, ende).catch(err =>
      console.error("[auto-vergabe] Mass-Invite-Mails fehlgeschlagen:", err),
    )
    return { ok: true, modus: "auktion" }
  } catch (err) {
    console.error("[auto-vergabe] unerwarteter Fehler:", err)
    return { ok: false, grund: err instanceof Error ? err.message : "unknown" }
  }
}
