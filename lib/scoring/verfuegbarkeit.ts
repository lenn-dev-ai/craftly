// Verfügbarkeits-Score für Handwerker.
// Datenquelle: zeitslots-Tabelle (status='verfuegbar' = pflegender
// Handwerker hat den Slot aktiv eingetragen, ist noch nicht reserviert).
//
// Sprint AK Stufe 3 (27.05.2026) — DEPRECATED-MARKIERUNG:
// Slots als Verfügbarkeitssignal sind tot (Mieter-First-Pivot). Diese
// Funktion läuft noch für Profile, die historische Slots haben, gibt
// für neue HW aber zwangsläufig bronze zurück (0 freie Slots).
// Sprint AL ersetzt das durch ein Signal aus:
//   - Antwortrate auf Einladungen
//   - Annahme-Quote von Auctions
//   - Google-Cal-Verbindung als Basis-Score
// Bis dahin: nicht panisch wegnehmen, kein Schaden — nur weniger informativ.
//
// Score (0..100) setzt sich (noch) zusammen aus:
//   40 %  Slot-Faktor (freie Slots diese Woche / MAX_SLOTS)
//   30 %  Pflege-Aktualität (sinkt linear auf 0 nach 7 Tagen)
//   30 %  Streak-Bonus (bis 10 Wochen)
//
// Stufen:
//   gold   — Score ≥ 70 UND ≥ 8 freie Slots
//   silber — Score ≥ 40 UND ≥ 4 freie Slots
//   bronze — sonst

import type { SupabaseClient } from "@supabase/supabase-js"

export type SichtbarkeitsStufe = "gold" | "silber" | "bronze"

export interface VerfuegbarkeitResult {
  score: number
  stufe: SichtbarkeitsStufe
  freieSlots: number
  streak: number
  pflegeRate: number
}

const MAX_SLOTS_PRO_WOCHE = 15
const STREAK_CAP = 10

type AnyClient = SupabaseClient

function wochenfenster(): { mo: string; so: string } {
  const heute = new Date()
  // ISO-Wochentag: Mo = 0, So = 6
  const tagOffset = (heute.getDay() + 6) % 7
  const mo = new Date(heute)
  mo.setDate(heute.getDate() - tagOffset)
  const so = new Date(mo)
  so.setDate(mo.getDate() + 6)
  return { mo: mo.toISOString().slice(0, 10), so: so.toISOString().slice(0, 10) }
}

export async function berechneVerfuegbarkeitScore(
  supabase: AnyClient,
  handwerkerId: string,
): Promise<VerfuegbarkeitResult> {
  const { mo, so } = wochenfenster()

  const { count: freieSlots } = await supabase
    .from("zeitslots")
    .select("id", { count: "exact", head: true })
    .eq("handwerker_id", handwerkerId)
    .eq("status", "verfuegbar")
    .gte("datum", mo)
    .lte("datum", so)

  const { data: profil } = await supabase
    .from("profiles")
    .select("letzte_kalender_pflege, kalender_streak")
    .eq("id", handwerkerId)
    .single<{ letzte_kalender_pflege: string | null; kalender_streak: number | null }>()

  const slots = freieSlots ?? 0
  const streak = profil?.kalender_streak ?? 0

  const letzte = profil?.letzte_kalender_pflege ? new Date(profil.letzte_kalender_pflege) : null
  const tageSeitPflege = letzte ? Math.floor((Date.now() - letzte.getTime()) / 86400000) : 999
  const pflegeRate = Math.max(0, 1 - tageSeitPflege / 7)

  const slotFaktor = Math.min(slots / MAX_SLOTS_PRO_WOCHE, 1)
  const streakBonus = Math.min(streak / STREAK_CAP, 1)

  const score = Math.round(slotFaktor * 40 + pflegeRate * 30 + streakBonus * 30)

  let stufe: SichtbarkeitsStufe = "bronze"
  if (score >= 70 && slots >= 8) stufe = "gold"
  else if (score >= 40 && slots >= 4) stufe = "silber"

  return { score, stufe, freieSlots: slots, streak, pflegeRate }
}

/**
 * Multiplier für den Smart-Score: Gold +10 %, Silber +5 %, Bronze ±0.
 * Wirkt analog zum Routen-Bonus.
 */
export function sichtbarkeitsMultiplier(stufe: SichtbarkeitsStufe | null | undefined): number {
  if (stufe === "gold") return 1.1
  if (stufe === "silber") return 1.05
  return 1.0
}
