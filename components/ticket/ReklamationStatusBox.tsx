"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/components/Toast"

// Reklamations-Transparenz (Audit-Report 2026-06-15, Abschnitt 4.1/6.1):
// Bisher verschwand jeglicher Hinweis auf eine laufende Reklamation, sobald
// ticket.status auf "reklamiert" wechselte (ReklamationButton war an
// status === "erledigt" gebunden). Mieter sahen nur ein rotes "Reklamiert"-
// Badge ohne Grund, Status oder nächsten Schritt — genau im Moment, in dem
// am meisten Information nötig wäre. Diese Box zeigt Grund, Details,
// aktuellen Bearbeitungsstand und (für Verwalter) eine Möglichkeit, den
// Status zu aktualisieren — und schließt damit den Kreis.

export type ReklamationStatus = "offen" | "in_klaerung" | "geloest" | "abgelehnt"

interface ReklamationRow {
  id: string
  grund: string
  details: string | null
  status: ReklamationStatus
  created_at: string
  geloest_at: string | null
}

const STATUS_META: Record<ReklamationStatus, { label: string; badge: string; mieterHinweis: string }> = {
  offen: {
    label: "Offen",
    badge: "bg-warm/15 text-warm-dark border border-warm/30",
    mieterHinweis: "Die Verwaltung hat deine Reklamation erhalten und prüft sie. Du wirst informiert, sobald es weitergeht.",
  },
  in_klaerung: {
    label: "Wird geklärt",
    badge: "bg-accent/10 text-accent border border-accent/20",
    mieterHinweis: "Die Verwaltung ist dabei, das Problem zu klären — ggf. gemeinsam mit dem Handwerksbetrieb.",
  },
  geloest: {
    label: "Gelöst",
    badge: "bg-success/10 text-success border border-success/20",
    mieterHinweis: "Die Reklamation wurde als gelöst markiert. Falls das Problem weiterhin besteht, kannst du dich direkt an die Verwaltung wenden.",
  },
  abgelehnt: {
    label: "Abgelehnt",
    badge: "bg-danger/10 text-danger border border-danger/20",
    mieterHinweis: "Die Verwaltung hat die Reklamation geprüft und sieht aktuell keinen weiteren Handlungsbedarf. Bei Fragen wende dich gerne direkt an die Verwaltung.",
  },
}

const STATUS_OPTIONS: ReklamationStatus[] = ["offen", "in_klaerung", "geloest", "abgelehnt"]

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("de", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function ReklamationStatusBox({ ticketId, canManage = false }: { ticketId: string; canManage?: boolean }) {
  const [reklamation, setReklamation] = useState<ReklamationRow | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    let aktiv = true
    void (async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from("ticket_reklamationen")
          .select("id, grund, details, status, created_at, geloest_at")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<ReklamationRow>()
        if (aktiv) {
          setReklamation(data ?? null)
          setLoaded(true)
        }
      } catch {
        if (aktiv) setLoaded(true)
      }
    })()
    return () => { aktiv = false }
  }, [ticketId])

  if (!loaded || !reklamation) return null

  const meta = STATUS_META[reklamation.status] ?? STATUS_META.offen

  async function updateStatus(next: ReklamationStatus) {
    if (!reklamation || next === reklamation.status) return
    setSaving(true)
    try {
      const supabase = createClient()
      const update: { status: ReklamationStatus; geloest_at?: string | null } = { status: next }
      update.geloest_at = next === "geloest" ? new Date().toISOString() : null
      const { error } = await supabase
        .from("ticket_reklamationen")
        .update(update)
        .eq("id", reklamation.id)
      if (error) {
        show(error.message || "Status konnte nicht aktualisiert werden", "error")
        return
      }
      setReklamation({ ...reklamation, status: next, geloest_at: update.geloest_at ?? null })
      show("Status aktualisiert", "success")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-line rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="text-sm font-semibold text-ink">Reklamation</div>
        <span className={`text-xs font-medium px-2 py-1 rounded-lg ${meta.badge}`}>{meta.label}</span>
      </div>
      <div className="text-xs text-ink-muted mb-3">Eingereicht am {formatDatum(reklamation.created_at)}</div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="text-xs font-medium text-ink-muted mb-0.5">Grund</div>
          <div className="text-sm text-ink-secondary break-words">{reklamation.grund}</div>
        </div>
        {reklamation.details && (
          <div>
            <div className="text-xs font-medium text-ink-muted mb-0.5">Details</div>
            <div className="text-sm text-ink-secondary break-words whitespace-pre-wrap">{reklamation.details}</div>
          </div>
        )}
      </div>

      {reklamation.status === "geloest" && reklamation.geloest_at && (
        <div className="text-xs text-ink-muted mb-3">Als gelöst markiert am {formatDatum(reklamation.geloest_at)}</div>
      )}

      {!canManage && (
        <div className="text-xs text-ink-secondary bg-surface rounded-xl p-3">
          <span className="font-medium text-ink">Nächster Schritt: </span>{meta.mieterHinweis}
        </div>
      )}

      {canManage && (
        <div className="pt-3 border-t border-line">
          <label className="block text-xs font-medium text-ink-muted mb-1.5">Status aktualisieren</label>
          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                disabled={saving || opt === reklamation.status}
                onClick={() => updateStatus(opt)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  opt === reklamation.status
                    ? `${STATUS_META[opt].badge} cursor-default`
                    : "border-line text-ink-secondary hover:border-accent/40 hover:text-accent"
                } ${saving ? "opacity-50" : ""}`}
              >
                {STATUS_META[opt].label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-muted mt-2">
            Der Mieter sieht den aktualisierten Status und einen passenden Hinweis zum nächsten Schritt.
          </p>
        </div>
      )}
    </div>
  )
}
