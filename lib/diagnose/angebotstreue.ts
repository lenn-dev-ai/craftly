// Angebotstreue-Score: bewertet wie verlässlich ein Handwerker seine
// Festpreis-Angebote einhält. Score 0..100 wird als Multiplier im
// Smart-Score eingesetzt (siehe lib/auction/smart-score.ts).
//
// Logik:
//   Score = 100 − 5 × wesentlich_count − 15 × erheblich_count
//   Fenster: nur Nachträge der letzten 365 Tage zählen.
//   Bagatell-Nachträge zählen NICHT (≤10 % Aufpreis ist normal).
//   Score wird nach jeder Nachtrag-Genehmigung neu berechnet und in
//   profiles.angebotstreue persistiert.

import type { SupabaseClient } from "@supabase/supabase-js"

const FENSTER_TAGE = 365
const ABZUG_WESENTLICH = 5
const ABZUG_ERHEBLICH = 15

type AnyClient = SupabaseClient

interface NachtragRow {
  stufe: "bagatell" | "wesentlich" | "erheblich" | null
}

export async function berechneAngebotstreue(
  supabase: AnyClient,
  handwerkerId: string,
): Promise<number> {
  const seit = new Date(Date.now() - FENSTER_TAGE * 86400 * 1000).toISOString()

  const { data } = await supabase
    .from("nachtraege")
    .select("stufe")
    .eq("handwerker_id", handwerkerId)
    .eq("status", "genehmigt")
    .gte("created_at", seit)
    .returns<NachtragRow[]>()

  let wesentlich = 0
  let erheblich = 0
  for (const n of data ?? []) {
    if (n.stufe === "wesentlich") wesentlich++
    else if (n.stufe === "erheblich") erheblich++
  }

  const score = 100 - ABZUG_WESENTLICH * wesentlich - ABZUG_ERHEBLICH * erheblich
  return Math.max(0, Math.min(100, score))
}

export async function aktualisiereAngebotstreue(
  supabase: AnyClient,
  handwerkerId: string,
): Promise<number> {
  const score = await berechneAngebotstreue(supabase, handwerkerId)
  await supabase
    .from("profiles")
    .update({ angebotstreue: score })
    .eq("id", handwerkerId)
  return score
}
