// Pricing — Reparo Provisions-Modell
// ============================================================================
// Reine Funktionen + Supabase-Lookup-Helfer. Keine UI, keine React-Imports.
//
// Modell:
// - Verwalter zahlt Provision, Handwerker bekommt vollen Stundensatz
// - Standard 5 % vom Auftragswert (versioniert in `provision_settings`)
// - Early Adopter: 0 % bis profiles.early_adopter_bis
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js"

export const STANDARD_PROVISION_RATE = 0.05

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------- Pure functions ----------

export interface CommissionResult {
  provisionBetrag: number
  gesamt: number
}

export function calculateCommission(
  auftragswert: number,
  provisionRate: number,
): CommissionResult {
  const provisionBetrag = round2(auftragswert * provisionRate)
  const gesamt = round2(auftragswert + provisionBetrag)
  return { provisionBetrag, gesamt }
}

export interface TotalResult extends CommissionResult {
  auftragswert: number
}

export function calculateTotal(
  stundensatz: number,
  stunden: number,
  provisionRate: number,
): TotalResult {
  const auftragswert = round2(stundensatz * stunden)
  return { auftragswert, ...calculateCommission(auftragswert, provisionRate) }
}

export interface VerwalterFlags {
  early_adopter_bis?: string | null
  created_at?: string | null
}

export function isEarlyAdopter(profile: VerwalterFlags | null | undefined): boolean {
  if (!profile?.early_adopter_bis) return false
  const bis = new Date(profile.early_adopter_bis)
  if (isNaN(bis.getTime())) return false
  return bis.getTime() > Date.now()
}

// Synchroner Helfer wenn Standard-Rate ausreicht (keine DB-Query)
export function getProvisionRate(
  profile: VerwalterFlags | null | undefined,
  standardRate: number = STANDARD_PROVISION_RATE,
): number {
  return isEarlyAdopter(profile) ? 0 : standardRate
}

// ---------- Strukturierte UI-Daten ----------

export interface PriceBreakdown {
  auftragswert: number          // Handwerkerkosten
  provisionRate: number         // 0.0 ... 1.0
  provisionBetrag: number       // EUR
  gesamt: number                // Was Verwalter zahlt
  handwerkerErhaelt: number     // = auftragswert (immer)
  isEarlyAdopter: boolean
  earlyAdopterBis: string | null
}

export function formatPriceBreakdown(
  auftragswert: number,
  provisionRate: number,
  earlyAdopterBis: string | null = null,
): PriceBreakdown {
  const { provisionBetrag, gesamt } = calculateCommission(auftragswert, provisionRate)
  return {
    auftragswert: round2(auftragswert),
    provisionRate,
    provisionBetrag,
    gesamt,
    handwerkerErhaelt: round2(auftragswert),
    isEarlyAdopter: provisionRate === 0,
    earlyAdopterBis,
  }
}

// ---------- DB-Lookups ----------

// Aktive Provisions-Rate aus `provision_settings`. Fällt auf Standard zurück.
export async function getActiveProvisionRate(
  supabase: SupabaseClient,
): Promise<number> {
  const now = new Date().toISOString()
  const { data } = await supabase
    .from("provision_settings")
    .select("rate")
    .lte("gueltig_ab", now)
    .or(`gueltig_bis.is.null,gueltig_bis.gt.${now}`)
    .order("gueltig_ab", { ascending: false })
    .limit(1)
    .maybeSingle()
  const rate = data?.rate
  return typeof rate === "number" || typeof rate === "string"
    ? Number(rate)
    : STANDARD_PROVISION_RATE
}

// Effektive Rate für Verwalter (berücksichtigt Early-Adopter-Status)
export async function getEffectiveRate(
  supabase: SupabaseClient,
  verwalterProfile: VerwalterFlags | null | undefined,
): Promise<{ rate: number; isEarlyAdopter: boolean }> {
  const earlyAdopter = isEarlyAdopter(verwalterProfile)
  if (earlyAdopter) return { rate: 0, isEarlyAdopter: true }
  const rate = await getActiveProvisionRate(supabase)
  return { rate, isEarlyAdopter: false }
}

// ---------- Format-Helfer ----------

export function formatEUR(amount: number): string {
  return `${amount.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}

export function formatProzent(rate: number): string {
  return `${(rate * 100).toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} %`
}

export function formatDatum(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })
}
