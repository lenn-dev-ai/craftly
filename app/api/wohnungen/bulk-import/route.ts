import { NextResponse, type NextRequest } from "next/server"
import { getUserFromRequest } from "@/lib/auth/getUserFromRequest"

// POST /api/wohnungen/bulk-import (Sprint I)
// Body: { wohnungen: [{ strasse, hausnummer, plz, ort, whg_bezeichnung, ... }], strategy?: "upsert" | "insert_only" }
// Auth: nur Verwalter (rolle = 'verwalter')
// UPSERT auf (verwalter_id, strasse, hausnummer, whg_bezeichnung). Batches
// von 50 sind vom Client geliefert — wir machen einen Single-Insert pro Call.

type Wohnung = {
  strasse?: string
  hausnummer?: string
  plz?: string
  ort?: string
  whg_bezeichnung?: string
  mieter_name?: string
  mieter_email?: string
  mieter_telefon?: string
  baujahr?: string
  qm?: string
}

const PFLICHT = ["strasse", "hausnummer", "plz", "ort", "whg_bezeichnung"] as const

export async function POST(request: NextRequest) {
  let body: { wohnungen?: Wohnung[]; strategy?: "upsert" | "insert_only" }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const wohnungen = body.wohnungen
  const strategy = body.strategy ?? "upsert"
  if (!Array.isArray(wohnungen) || wohnungen.length === 0) {
    return NextResponse.json({ error: "wohnungen muss ein nicht-leeres Array sein" }, { status: 400 })
  }
  if (wohnungen.length > 100) {
    return NextResponse.json({ error: "Max 100 Wohnungen pro Batch" }, { status: 400 })
  }

  const { supabase, user } = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("rolle")
    .eq("id", user.id)
    .single<{ rolle: string }>()
  if (!profile || profile.rolle !== "verwalter") {
    return NextResponse.json({ error: "Nur Verwalter dürfen Wohnungen importieren" }, { status: 403 })
  }

  let skipped = 0
  const rowsToInsert: Record<string, unknown>[] = []

  for (const w of wohnungen) {
    const missing = PFLICHT.find(p => !w[p]?.trim())
    if (missing) {
      skipped++
      continue
    }
    rowsToInsert.push({
      verwalter_id: user.id,
      strasse: w.strasse!.trim(),
      hausnummer: w.hausnummer!.trim(),
      plz: w.plz!.trim(),
      ort: w.ort!.trim(),
      whg_bezeichnung: w.whg_bezeichnung!.trim(),
      mieter_name: w.mieter_name?.trim() || null,
      mieter_email: w.mieter_email?.trim() || null,
      mieter_telefon: w.mieter_telefon?.trim() || null,
      baujahr: w.baujahr ? Number(w.baujahr) || null : null,
      qm: w.qm ? Number(w.qm) || null : null,
    })
  }

  if (rowsToInsert.length === 0) {
    return NextResponse.json({ inserted: 0, updated: 0, skipped })
  }

  // Insert vs. Upsert. UPSERT geht via onConflict auf die Unique-Constraint
  // (verwalter_id, strasse, hausnummer, whg_bezeichnung).
  const query = strategy === "upsert"
    ? supabase.from("wohnungen").upsert(rowsToInsert, {
        onConflict: "verwalter_id,strasse,hausnummer,whg_bezeichnung",
        ignoreDuplicates: false,
      }).select("id")
    : supabase.from("wohnungen").insert(rowsToInsert).select("id")

  const { data, error } = await query

  if (error) {
    return NextResponse.json({
      error: error.message,
      hint: "Falls 'relation \"public.wohnungen\" does not exist': Migration 20260605000060 noch nicht angewandt.",
    }, { status: 500 })
  }

  // UPSERT-Aufruf liefert nur die affected IDs zurück, aber keinen
  // direkten Indikator inserted-vs-updated. Best-Effort:
  // wir behandeln alle als "verarbeitet" — Aufteilung nur für UI-Stat.
  // Wenn der UPSERT-Modus aktiv ist, sind potenziell beide möglich,
  // aktuell wird das nicht unterschieden.
  const verarbeitet = data?.length ?? 0
  return NextResponse.json({
    inserted: strategy === "insert_only" ? verarbeitet : verarbeitet,
    updated: 0,
    skipped,
  })
}
