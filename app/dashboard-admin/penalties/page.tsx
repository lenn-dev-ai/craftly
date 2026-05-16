"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Card, Button } from "@/components/ui"
import { useToast } from "@/components/Toast"
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react"

// Admin-Übersicht offener Frist-Penalties.
//
// Aktuell läuft Penalty-Markierung im abwicklungsfrist-Cron — die
// echte Stripe-Buchung kommt in Phase 2. Bis dahin verrechnet
// Reparo manuell und markiert hier den Status auf 'paid'.
//
// Service-Role-Update via /api/admin/penalties/[ticketId]/mark-paid,
// damit der protect_ticket_fields-Trigger nicht blockt.

interface PenaltyRow {
  id: string
  titel: string
  zugewiesener_hw: string | null
  penalty_amount_cents: number | null
  penalty_buchung_versucht_am: string | null
  handwerker_name: string | null
  handwerker_email: string | null
  stripe_account_id: string | null
  stripe_charges_enabled: boolean
}

export default function PenaltiesPage() {
  const toast = useToast()
  const [rows, setRows] = useState<PenaltyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("tickets")
      .select(`
        id,
        titel,
        zugewiesener_hw,
        penalty_amount_cents,
        penalty_buchung_versucht_am,
        handwerker:profiles!tickets_zugewiesener_hw_fkey (
          name,
          email,
          stripe_account_id,
          stripe_charges_enabled
        )
      `)
      .eq("penalty_status", "manual_pending")
      .order("penalty_buchung_versucht_am", { ascending: false })

    if (error) {
      toast.show("Fehler beim Laden: " + error.message, "error")
      setLoading(false)
      return
    }

    setRows(
      (data ?? []).map((t: Record<string, unknown>) => {
        const hw = t.handwerker as { name?: string | null; email?: string | null; stripe_account_id?: string | null; stripe_charges_enabled?: boolean } | null
        return {
          id: t.id as string,
          titel: t.titel as string,
          zugewiesener_hw: t.zugewiesener_hw as string | null,
          penalty_amount_cents: t.penalty_amount_cents as number | null,
          penalty_buchung_versucht_am: t.penalty_buchung_versucht_am as string | null,
          handwerker_name: hw?.name ?? null,
          handwerker_email: hw?.email ?? null,
          stripe_account_id: hw?.stripe_account_id ?? null,
          stripe_charges_enabled: !!hw?.stripe_charges_enabled,
        }
      }),
    )
    setLoading(false)
  }, [toast])

  useEffect(() => { void load() }, [load])

  async function markPaid(ticketId: string) {
    const ok = await toast.confirm(
      "Damit wird die Penalty außerhalb von Stripe als verrechnet markiert. Nicht rückgängig.",
    )
    if (!ok) return
    setPendingId(ticketId)
    try {
      const res = await fetch(`/api/admin/penalties/${ticketId}/mark-paid`, { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.show(body.error || "Markierung fehlgeschlagen", "error")
        return
      }
      toast.show("Als bezahlt markiert", "success")
      await load()
    } finally {
      setPendingId(null)
    }
  }

  const totalCents = rows.reduce((sum, r) => sum + (r.penalty_amount_cents ?? 0), 0)
  const totalEur = (totalCents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })

  return (
    <div className="p-6 max-w-5xl mx-auto pt-16 md:pt-8 space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warm-light flex items-center justify-center">
            <AlertTriangle size={20} className="text-warm-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Offene Frist-Penalties</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              Manuell zu verrechnen, solange Stripe-Charging-Logik in Phase 2 steht.
            </p>
          </div>
        </div>
      </header>

      {!loading && rows.length === 0 && (
        <Card className="bg-white border border-line">
          <div className="flex items-center gap-3 text-ink-muted text-sm">
            <CheckCircle2 size={18} className="text-accent" />
            Keine offenen Penalties — alles ausgeglichen.
          </div>
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="bg-white border border-line">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-ink-secondary">
              {rows.length} offen · gesamt <strong className="text-ink">€{totalEur}</strong>
            </div>
          </div>

          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-line text-ink-muted text-xs uppercase tracking-wider">
                  <th className="px-6 py-2 font-semibold">Ticket</th>
                  <th className="px-3 py-2 font-semibold">Handwerker</th>
                  <th className="px-3 py-2 font-semibold">Stripe</th>
                  <th className="px-3 py-2 font-semibold text-right">Betrag</th>
                  <th className="px-3 py-2 font-semibold">Markiert</th>
                  <th className="px-6 py-2 font-semibold text-right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const ets = r.penalty_buchung_versucht_am
                  const datum = ets ? new Date(ets).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"
                  return (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-alt">
                      <td className="px-6 py-3">
                        <Link href={`/dashboard-admin/ticket/${r.id}`} className="text-accent hover:underline inline-flex items-center gap-1">
                          {r.titel}
                          <ExternalLink size={12} />
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-ink">{r.handwerker_name ?? "—"}</div>
                        <div className="text-xs text-ink-muted">{r.handwerker_email ?? ""}</div>
                      </td>
                      <td className="px-3 py-3">
                        {r.stripe_charges_enabled ? (
                          <span className="text-xs text-accent">verbunden</span>
                        ) : r.stripe_account_id ? (
                          <span className="text-xs text-warm-dark">onboarding offen</span>
                        ) : (
                          <span className="text-xs text-ink-muted">nicht verbunden</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        €{((r.penalty_amount_cents ?? 0) / 100).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-ink-muted text-xs">{datum}</td>
                      <td className="px-6 py-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => markPaid(r.id)}
                          disabled={pendingId === r.id}
                        >
                          {pendingId === r.id ? "…" : "Als bezahlt"}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {loading && (
        <div className="text-sm text-ink-muted">Lade…</div>
      )}
    </div>
  )
}
