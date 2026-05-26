"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui"
import { useToast } from "@/components/Toast"
import { createClient } from "@/lib/supabase"

// Sprint U Phase 2 — Mieter-Reklamations-Button mit Modal.
// Wird im TicketDetailView nach der Bewertungs-Sektion eingebettet.
// Nur sichtbar wenn Mieter + Status erledigt/abgenommen + noch keine
// Reklamation offen (lädt sich selbst via supabase, RLS scoped).

export interface ReklamationButtonProps {
  ticketId: string
  onSuccess?: () => void
}

export function ReklamationButton({ ticketId, onSuccess }: ReklamationButtonProps) {
  const [open, setOpen] = useState(false)
  const [grund, setGrund] = useState("")
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [existingReklamationId, setExistingReklamationId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    let aktiv = true
    void (async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("ticket_reklamationen")
          .select("id")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ id: string }>()
        if (aktiv) {
          setExistingReklamationId(data?.id ?? null)
          setLoaded(true)
        }
      } catch {
        if (aktiv) setLoaded(true)
      }
    })()
    return () => { aktiv = false }
  }, [ticketId])

  if (!loaded) return null

  if (existingReklamationId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-900">
        <div className="font-semibold">⚠️ Reklamation läuft</div>
        <div className="text-xs mt-1">Deine Reklamation wurde an die Verwaltung weitergeleitet. Du wirst kontaktiert.</div>
      </div>
    )
  }

  async function submit() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/reklamieren`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grund, details }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        show(j.error || "Reklamation fehlgeschlagen", "error")
        return
      }
      show("Reklamation wurde an die Verwaltung gesendet", "success")
      setOpen(false)
      setGrund("")
      setDetails("")
      const data = await res.json().catch(() => ({})) as { reklamation_id?: string }
      if (data.reklamation_id) setExistingReklamationId(data.reklamation_id)
      onSuccess?.()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="bg-white border border-line rounded-2xl p-5 mb-6">
        <div className="text-sm font-semibold text-ink mb-1">Reparatur war nicht ok?</div>
        <p className="text-xs text-ink-muted mb-3">
          Wenn die Reparatur nicht zufriedenstellend war oder ein Problem zurückgekommen ist, kannst du eine Reklamation einreichen. Die Verwaltung sieht sie sofort.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Reklamation einreichen
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={() => !submitting && setOpen(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-ink mb-1">Reklamation einreichen</h2>
            <p className="text-xs text-ink-muted mb-4">Was ist das Problem? Bitte konkret beschreiben.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Kurzer Grund *</label>
                <input
                  value={grund}
                  onChange={e => setGrund(e.target.value)}
                  placeholder="z.B. Wasser tropft wieder"
                  className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent/40"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Details (optional)</label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  rows={4}
                  placeholder="Wann ist es aufgefallen? Wie schlimm ist es?"
                  className="w-full bg-white border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent/40 resize-none"
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={submitting}>Abbrechen</Button>
              <Button variant="danger" size="sm" onClick={submit} disabled={submitting || grund.trim().length < 5}>
                {submitting ? "Sendet…" : "Reklamation senden"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
