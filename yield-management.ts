import { Zeitslot, ZeitslotGebot } from "@/types"

/* ============================================================
   REPARO YIELD MANAGEMENT ENGINE
   Dynamisches Pricing nach Uber/Hotel-Modell fÃ¼r Handwerker
   ============================================================ */

// Basis-StundensÃ¤tze nach Gewerk (Marktdurchschnitt Deutschland)
export const GEWERK_BASIS_PREISE: Record<string, number> = {
  sanitaer: 65, elektro: 60, heizung: 70, maler: 45,
  schreiner: 55, dachdecker: 75, schlosser: 50, allgemein: 50,
}

// Tageszeit-Faktoren (FrÃ¼h/SpÃ¤t = premium)
export function tageszeitFaktor(von: string): number {
  const h = parseInt(von.split(":")[0])
  if (h < 8) return 1.3    // FrÃ¼hmorgens â Premium
  if (h >= 17) return 1.2   // Abends â Premium
  if (h >= 12 && h <= 13) return 0.95 // Mittagspause â leichter Rabatt
  return 1.0
}

// Wochentag-Faktoren
export function wochentagFaktor(datum: string): number {
  const day = new Date(datum).getDay()
  if (day === 0) return 1.5  // Sonntag
  if (day === 6) return 1.3  // Samstag
  if (day === 1) return 1.15 // Montag â hohe Nachfrage
  return 1.0
}

// Nachfrage-Faktor basierend auf aktiven Geboten
export function nachfrageFaktor(geboteAnzahl: number): number {
  if (geboteAnzahl >= 5) return 1.4
  if (geboteAnzahl >= 3) return 1.25
  if (geboteAnzahl >= 1) return 1.1
  return 1.0
}

// Knappheits-Faktor (wenige verfÃ¼gbare Slots im gleichen Gewerk)
export function knappheitsFaktor(verfuegbareSlots: number): number {
  if (verfuegbareSlots <= 1) return 1.5
  if (verfuegbareSlots <= 3) return 1.25
  if (verfuegbareSlots <= 5) return 1.1
  return 1.0
}

// LÃ¼cken-Rabatt (Slot zwischen zwei Jobs â leichter Discount fÃ¼r Auslastung)
export function lueckenRabatt(istLuecke: boolean): number {
  return istLuecke ? 0.85 : 1.0
}

// Gesamtfaktor berechnen
export interface PreisBerechnung {
  basisPreis: number
  dynamischerPreis: number
  gesamtFaktor: number
  faktoren: {
    tageszeit: number
    wochentag: number
    nachfrage: number
    knappheit: number
    luecke: number
  }
  label: string
  farbe: string
}

export function berechneDynamischenPreis(
  basisPreisStunde: number,
  datum: string,
  von: string,
  geboteAnzahl: number,
  verfuegbareSlots: number,
  istLuecke: boolean
): PreisBerechnung {
  const faktoren = {
    tageszeit: tageszeitFaktor(von),
    wochentag: wochentagFaktor(datum),
    nachfrage: nachfrageFaktor(geboteAnzahl),
    knappheit: knappheitsFaktor(verfuegbareSlots),
    luecke: lueckenRabatt(istLuecke),
  }

  const gesamtFaktor = Math.round(
    faktoren.tageszeit * faktoren.wochentag * faktoren.nachfrage *
    faktoren.knappheit * faktoren.luecke * 100
  ) / 100

  const dynamischerPreis = Math.round(basisPreisStunde * gesamtFaktor)

  let label: string, farbe: string
  if (gesamtFaktor >= 1.8) { label = "Sehr hohe Nachfrage"; farbe = "#EF4444" }
  else if (gesamtFaktor >= 1.4) { label = "Hohe Nachfrage"; farbe = "#F59E0B" }
  else if (gesamtFaktor >= 1.15) { label = "ErhÃ¶hte Nachfrage"; farbe = "#00B4D8" }
  else if (gesamtFaktor < 1.0) { label = "LÃ¼cken-Angebot"; farbe = "#8B5CF6" }
  else { label = "Normaler Marktpreis"; farbe = "#00D4AA" }

  return { basisPreis: basisPreisStunde, dynamischerPreis, gesamtFaktor, faktoren, label, farbe }
}

// LÃ¼cken-Erkennung: Findet Zeitfenster zwischen bestehenden Slots
export interface Luecke {
  datum: string
  von: string
  bis: string
  stunden: number
  vorher?: string // Titel des vorherigen Auftrags
  nachher?: string // Titel des nÃ¤chsten Auftrags
}

export function erkenneLuecken(
  slots: Zeitslot[],
  termine: { datum: string; von: string; bis: string; titel: string }[],
  arbeitsbeginn = "07:00",
  arbeitsende = "18:00"
): Luecke[] {
  const luecken: Luecke[] = []

  // Gruppiere nach Datum
  const nachDatum = new Map<string, { von: string; bis: string; titel: string }[]>()

  for (const s of slots) {
    const d = s.datum.split("T")[0]
    if (!nachDatum.has(d)) nachDatum.set(d, [])
    nachDatum.get(d)!.push({ von: s.von, bis: s.bis, titel: s.titel })
  }
  for (const t of termine) {
    const d = t.datum.split("T")[0]
    if (!nachDatum.has(d)) nachDatum.set(d, [])
    nachDatum.get(d)!.push(t)
  }

  for (const [datum, events] of nachDatum.entries()) {
    const sorted = events.sort((a, b) => a.von.localeCompare(b.von))

    for (let i = 0; i < sorted.length - 1; i++) {
      const aktuellesEnde = sorted[i].bis
      const naechsterStart = sorted[i + 1].von

      const endeMin = zeitZuMinuten(aktuellesEnde)
      const startMin = zeitZuMinuten(naechsterStart)
      const differenz = startMin - endeMin

      // LÃ¼cke >= 1.5 Stunden ist verwertbar
      if (differenz >= 90) {
        luecken.push({
          datum,
          von: aktuellesEnde,
          bis: naechsterStart,
          stunden: Math.round(differenz / 60 * 10) / 10,
          vorher: sorted[i].titel,
          nachher: sorted[i + 1].titel,
        })
      }
    }
  }

  return luecken
}

function zeitZuMinuten(zeit: string): number {
  const [h, m] = zeit.split(":").map(Number)
  return h * 60 + m
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

  // Angenommene Gebote zÃ¤hlen
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
  else if (offeneSlots <= 3) tipp = `${offeneSlots} offene Slots = ${Math.round(potenzial)} â¬ Potenzial. Teile mehr VerfÃ¼gbarkeit!`
  else tipp = `Super! ${offeneSlots} Slots online. Dein Potenzial: ${Math.round(potenzial)} â¬`

  return {
    dieseWoche: Math.round(dieseWoche),
    naechsteWoche: Math.round(naechsteWoche),
    potenzialNaechsteWoche: Math.round(potenzial),
    offeneSlots,
    tipp,
  }
}
