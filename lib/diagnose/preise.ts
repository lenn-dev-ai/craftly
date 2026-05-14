// Lookup-Helper für Diagnose-Festpreise pro Gewerk.
// Quelle: Tabelle public.diagnose_preise. Wenn ein Gewerk dort nicht
// hinterlegt ist, fällt der Lookup auf 'allgemein' zurück.

import type { SupabaseClient } from "@supabase/supabase-js"

const FALLBACK_GEWERK = "allgemein"
const FALLBACK_PREIS = 59

type AnyClient = SupabaseClient

interface DiagnosePreis {
  gewerk: string
  preis: number
}

export async function getDiagnosePreis(
  supabase: AnyClient,
  gewerk: string | null | undefined,
): Promise<number> {
  const key = (gewerk || FALLBACK_GEWERK).toLowerCase()
  const { data } = await supabase
    .from("diagnose_preise")
    .select("preis")
    .eq("gewerk", key)
    .maybeSingle<{ preis: number }>()
  if (data?.preis != null) return data.preis

  // Fallback: 'allgemein' aus der Tabelle, sonst Hardcoded
  const { data: allg } = await supabase
    .from("diagnose_preise")
    .select("preis")
    .eq("gewerk", FALLBACK_GEWERK)
    .maybeSingle<{ preis: number }>()
  return allg?.preis ?? FALLBACK_PREIS
}

export async function getAllDiagnosePreise(
  supabase: AnyClient,
): Promise<DiagnosePreis[]> {
  const { data } = await supabase
    .from("diagnose_preise")
    .select("gewerk, preis")
    .order("gewerk")
    .returns<DiagnosePreis[]>()
  return data ?? []
}
