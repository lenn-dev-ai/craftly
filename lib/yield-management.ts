import { Zeitslot, ZeitslotGebot } from "@/types"

/* ============================================================
   REPARO YIELD MANAGEMENT — EINNAHMEN-PROGNOSE
   Audit 2.0 (#245): Die dynamische Slot-Preisbildung
   (Tageszeit-/Wochentag-/Nachfrage-/Knappheits-Faktoren,
   Lücken-Erkennung) war Teil des alten Zeitslot-Marktplatzes
   und wurde entfernt — toter Code, 0 Referenzen außerhalb
   dieser Datei. Übrig bleibt nur das, was
   `app/dashboard-handwerker/einnahmen/page.tsx` noch nutzt:
   die Basis-Stundensätze und die Einnahmen-Prognose für die
   (auslaufende) Zeitslot-Historie.
   ============================================================ */

// Basis-Stundensätze nach Gewerk (Marktdurchschnitt Deutschland)
export const GEWERK_BASIS_PREISE: Record<string, number> = {
  sanitaer: 65, elektro: 60, heizung: 70, maler: 45,
  schreiner: 55, dachdecker: 75, schlosser: 50, allgemein: 50,
}

// Einnahmen-Prognose
export interface EinnahmenPrognose {
  dieseWoche: number
  naechsteWoche: number
  potenzialNaechsteWoche: number
  offeneSlots: number
  tipp: string
}

export function berechneEinnahmenPrognose(
  slots: Zeitslot[],
  gebote: ZeitslotGebot[]
): EinnahmenPrognose {
  const heute = new Date()
  const wochenStart = new Date(heute)
  wochenStart.setDate(heute.getDate() - heute.getDay() + 1)
  const wochenEnde = new Date(wochenStart)
  wochenEnde.setDate(wochenStart.getDate() + 6)
  const naechsteWocheStart = new Date(wochenEnde)
  naechsteWocheStart.setDate(wochenEnde.getDate() + 1)
  const naechsteWocheEnde = new Date(naechsteWocheStart)
  naechsteWocheEnde.setDate(naechsteWocheStart.getDate() + 6)

  let dieseWoche = 0
  let naechsteWoche = 0
  let potenzial = 0
  let offeneSlots = 0

  for (const s of slots) {
    const d = new Date(s.datum)
    const preis = (s.dynamischer_preis || s.basis_preis_stunde) * s.stunden

    if (d >= wochenStart && d <= wochenEnde) {
      if (s.status === "vergeben") dieseWoche += preis
      else if (s.status === "verfuegbar") { potenzial += preis; offeneSlots++ }
    }
    if (d >= naechsteWocheStart && d <= naechsteWocheEnde) {
      if (s.status === "vergeben") naechsteWoche += preis
      else if (s.status === "verfuegbar") { potenzial += preis; offeneSlots++ }
    }
  }

  // Angenommene Gebote zählen
  for (const g of gebote) {
    if (g.status === "angenommen") {
      const slot = slots.find(s => s.id === g.zeitslot_id)
      if (slot) {
        const d = new Date(slot.datum)
        if (d >= wochenStart && d <= wochenEnde) dieseWoche += g.gebotener_preis
        if (d >= naechsteWocheStart && d <= naechsteWocheEnde) naechsteWoche += g.gebotener_preis
      }
    }
  }

  let tipp = ""
  if (offeneSlots === 0) tipp = "Mehr Zeitslots einstellen um dein Einkommen zu steigern!"
  else if (offeneSlots <= 3) tipp = `${offeneSlots} offene Slots = ${Math.round(potenzial)} € Potenzial. Teile mehr Verfügbarkeit!`
  else tipp = `Super! ${offeneSlots} Slots online. Dein Potenzial: ${Math.round(potenzial)} €`

  return {
    dieseWoche: Math.round(dieseWoche),
    naechsteWoche: Math.round(naechsteWoche),
    potenzialNaechsteWoche: Math.round(potenzial),
    offeneSlots,
    tipp,
  }
}
