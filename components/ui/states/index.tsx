"use client"

import { AlertTriangle, AlertCircle, CheckCircle2, Info, RefreshCw, X } from "lucide-react"
import type { ReactNode } from "react"

// Sprint M Extension (Designer-Audit) — State-Design-System.
// "Loading / Errors / Empty States / Warnings / Konflikte / Eskalationen
// / Success Moments — alles als professionelles System."
//
// Diese Datei bündelt 5 State-Komponenten plus einen Re-Export-Punkt.
// Die schon vorhandenen `EmptyState`, `LoadingSpinner` und `Toast`-
// Provider bleiben in `components/ui/index.tsx` — sie werden hier
// nicht dupliziert.

// ============================================================
// LoadingSkeleton — einheitliches Pulse-Skelett, drei Varianten.
// `card` ist ein einzelner Block, `table` mehrere Zeilen, `page`
// ein Header + Liste-Skelett.
// ============================================================
export function LoadingSkeleton({ variant = "card", rows = 4 }: {
  variant?: "card" | "table" | "page"
  rows?: number
}) {
  if (variant === "page") {
    return (
      <div className="animate-pulse space-y-4" role="status" aria-label="Wird geladen">
        <div className="h-8 w-1/3 bg-line rounded-lg" />
        <div className="h-4 w-1/2 bg-line/60 rounded" />
        <div className="space-y-2 pt-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-12 bg-line/40 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }
  if (variant === "table") {
    return (
      <div className="bg-white border border-line rounded-2xl p-4 animate-pulse" role="status" aria-label="Wird geladen">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2 border-b border-line last:border-0">
            <div className="w-2 h-2 bg-line rounded-full" />
            <div className="h-4 bg-line rounded flex-1 max-w-md" />
            <div className="h-3 bg-line/60 rounded w-24 hidden md:block" />
            <div className="h-5 bg-line/40 rounded-full w-16" />
          </div>
        ))}
      </div>
    )
  }
  // card (default)
  return (
    <div className="bg-white border border-line rounded-2xl p-5 animate-pulse" role="status" aria-label="Wird geladen">
      <div className="h-4 w-1/3 bg-line rounded mb-3" />
      <div className="h-6 w-2/3 bg-line/60 rounded mb-2" />
      <div className="h-3 w-1/2 bg-line/40 rounded" />
    </div>
  )
}

// ============================================================
// ErrorCard — Error-State mit Action (Retry oder Support).
// Im Gegensatz zum Toast bleibt die ErrorCard stehen bis behoben.
// ============================================================
export function ErrorCard({
  title = "Etwas ist schiefgelaufen",
  description,
  onRetry,
  supportHref,
}: {
  title?: string
  description: string
  onRetry?: () => void
  supportHref?: string
}) {
  return (
    <div
      role="alert"
      className="bg-danger/5 border border-danger/20 rounded-2xl p-5 flex items-start gap-3"
    >
      <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <div className="font-semibold text-danger mb-1">{title}</div>
        <div className="text-sm text-ink-secondary mb-3">{description}</div>
        <div className="flex items-center gap-3 flex-wrap">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-danger hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Erneut versuchen
            </button>
          )}
          {supportHref && (
            <a
              href={supportHref}
              className="text-sm font-medium text-ink-muted hover:text-ink underline"
            >
              Support kontaktieren
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// WarningBanner — non-blocking Hinweis, 3 Severity-Stufen.
// Für blockierende Konflikte ConflictModal verwenden.
// ============================================================
export function WarningBanner({
  level = "info",
  title,
  description,
  onDismiss,
}: {
  level?: "info" | "warn" | "critical"
  title: string
  description?: string
  onDismiss?: () => void
}) {
  const styles = {
    info:     { bg: "bg-info/5",    border: "border-info/20",    text: "text-info",    Icon: Info },
    warn:     { bg: "bg-warm/10",   border: "border-warm/30",    text: "text-warm-dark", Icon: AlertTriangle },
    critical: { bg: "bg-danger/8",  border: "border-danger/30",  text: "text-danger",  Icon: AlertTriangle },
  } as const
  const { bg, border, text, Icon } = styles[level]
  return (
    <div role={level === "critical" ? "alert" : "status"} className={`${bg} ${border} border rounded-2xl px-4 py-3 flex items-start gap-3`}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${text}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${text}`}>{title}</div>
        {description && <div className="text-xs text-ink-secondary mt-0.5">{description}</div>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Hinweis schließen"
          className="text-ink-muted hover:text-ink flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// ============================================================
// ConflictModal — z.B. "2 Verwalter bearbeiten gleichzeitig".
// Block-Modal das eine explizite Entscheidung verlangt.
// ============================================================
export function ConflictModal({
  open,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel = "Abbrechen",
  onSecondary,
}: {
  open: boolean
  title: string
  description: ReactNode
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel?: string
  onSecondary: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-warm-dark flex-shrink-0 mt-0.5" aria-hidden="true" />
          <h2 id="conflict-modal-title" className="text-base font-semibold text-ink">{title}</h2>
        </div>
        <div className="text-sm text-ink-secondary mb-5 leading-relaxed">{description}</div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onSecondary}
            className="px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-surface rounded-lg"
          >
            {secondaryLabel}
          </button>
          <button
            onClick={onPrimary}
            className="px-4 py-2 text-sm font-bold bg-warm-dark text-white rounded-lg hover:opacity-90"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// EscalationMarker — rot, prominent. Für Notfälle / Reklamationen /
// SLA-Verletzungen. Wird typischerweise neben dem Ticket-Titel
// gerendert oder als Banner über einer Liste.
// ============================================================
export function EscalationMarker({
  reason,
  inline = false,
}: {
  reason: string
  inline?: boolean
}) {
  if (inline) {
    return (
      <span
        role="alert"
        title={reason}
        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-danger bg-danger/10 border border-danger/20 px-1.5 py-0.5 rounded"
      >
        <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Eskaliert
      </span>
    )
  }
  return (
    <div
      role="alert"
      className="bg-danger/8 border-l-4 border-danger pl-4 pr-3 py-2 flex items-center gap-2"
    >
      <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" aria-hidden="true" />
      <div className="text-sm">
        <span className="font-semibold text-danger">Eskaliert: </span>
        <span className="text-ink">{reason}</span>
      </div>
    </div>
  )
}

// ============================================================
// SuccessBanner — Success-Moment-Banner (anders als Toast: bleibt
// stehen, prominent, mit optionaler Action).
// ============================================================
export function SuccessBanner({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div role="status" className="bg-status-erledigt/8 border border-status-erledigt/25 rounded-2xl px-4 py-3 flex items-center gap-3">
      <CheckCircle2 className="w-5 h-5 text-status-erledigt flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-status-erledigt">{title}</div>
        {description && <div className="text-xs text-ink-secondary mt-0.5">{description}</div>}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="text-sm font-semibold text-status-erledigt hover:underline flex-shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
