import { createServiceRoleClient } from "@/lib/supabase-server"

// Sprint V MVP — Routing-Helper für Stamm-HW.
//
// Diese Funktion wird in Zukunft von /api/auction/start aufgerufen statt
// direkt die Auktion zu öffnen. Wenn ein Stamm-HW matched: 1:1-Anfrage
// erzeugen, Ticket bleibt in 'gemeldet' bis Stamm-HW entschieden hat.
// Wenn kein Stamm-HW: caller öffnet die normale Marktplatz-Auktion.
//
// Sprint V Phase 2 (Code-Integration in start-Route) ist nicht in diesem
// MVP — der Helper liegt schon hier, kann später ohne Schema-Change
// eingebunden werden.

export interface StammRoutingResult {
  matched: boolean
  handwerker_id?: string
  stamm_eintrag_id?: string
  stamm_anfrage_id?: string
  frist_bis?: string
}

export async function findeUndErzeugeStammAnfrage(opts: {
  ticketId: string
  verwalterId: string
  objektId: string | null
  gewerk: string | null
}): Promise<StammRoutingResult> {
  const admin = createServiceRoleClient()

  // Stamm-HW Lookup, am spezifischsten zuerst:
  //   (objekt=X UND gewerk=Y) > (objekt=X UND gewerk=NULL) > (objekt=NULL UND gewerk=Y) > (NULL/NULL)
  // OR-Klausel mit prio-Sortierung tut das in einem Query.
  const { data: kandidaten } = await admin
    .from("stamm_handwerker")
    .select("id, handwerker_id, objekt_id, gewerk, prio, frist_stunden")
    .eq("verwalter_id", opts.verwalterId)
    .order("prio", { ascending: false })
    .order("erstellt_at", { ascending: false })
    .limit(50)

  if (!kandidaten || kandidaten.length === 0) {
    return { matched: false }
  }

  // Spezifität-Score: (objekt match) * 2 + (gewerk match) * 1 + prio/1000
  const scored = kandidaten
    .map(k => {
      const objektMatch = k.objekt_id && k.objekt_id === opts.objektId ? 2 : k.objekt_id == null ? 0.5 : -10
      const gewerkMatch = k.gewerk && k.gewerk === opts.gewerk ? 1 : k.gewerk == null ? 0.25 : -10
      return { ...k, score: objektMatch + gewerkMatch + (k.prio ?? 100) / 1000 }
    })
    .filter(k => k.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return { matched: false }
  }

  const best = scored[0]
  const frist = new Date(Date.now() + (best.frist_stunden ?? 24) * 3600_000)

  const { data: anfrage, error } = await admin
    .from("stamm_anfragen")
    .insert({
      ticket_id: opts.ticketId,
      handwerker_id: best.handwerker_id,
      stamm_eintrag_id: best.id,
      frist_bis: frist.toISOString(),
    })
    .select("id, frist_bis")
    .single()

  if (error || !anfrage) {
    console.warn("[stamm-routing] insert failed", { ticket: opts.ticketId, err: error?.message })
    return { matched: false }
  }

  return {
    matched: true,
    handwerker_id: best.handwerker_id,
    stamm_eintrag_id: best.id,
    stamm_anfrage_id: anfrage.id,
    frist_bis: anfrage.frist_bis,
  }
}
