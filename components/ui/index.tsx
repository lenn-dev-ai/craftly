"use client"

import { forwardRef, useId } from "react"
import { TicketStatus, Prioritaet } from "@/types"

// ============================================================
// Reparo Designsystem — Komponenten-Library (Sprint 2)
// ============================================================
// Audit-Befund: Status/Typ/Priorität wurden visuell gleich stark
// dargestellt → unruhig. Trennung in drei Badges:
//   - Badge       (Status:  offen/auktion/in_bearbeitung/erledigt)
//   - TypBadge    (Typ:     standard/diagnose/projekt)  ← subtiler
//   - PrioBadge   (Prio:    dringend/hoch/normal)
//
// Faustregel: pro Karte/Zeile nur EIN primär-farbiger Badge.

// ============================================================
// Status-Badge — primär hervorgehoben, eine Farbe pro Workflow-Stufe
// ============================================================
export function Badge({ status }: { status: TicketStatus }) {
  const map: Record<TicketStatus, { label: string; bg: string; text: string; dot: string }> = {
    offen:          { label: "Offen",          bg: "bg-status-offen/10",       text: "text-status-offen",       dot: "bg-status-offen" },
    auktion:        { label: "Auktion",        bg: "bg-status-auktion/10",     text: "text-status-auktion",     dot: "bg-status-auktion" },
    in_bearbeitung: { label: "In Bearbeitung", bg: "bg-status-bearbeitung/10", text: "text-status-bearbeitung", dot: "bg-status-bearbeitung" },
    erledigt:       { label: "Erledigt",       bg: "bg-status-erledigt/10",    text: "text-status-erledigt",    dot: "bg-status-erledigt" },
  }
  const { label, bg, text, dot } = map[status]
  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      className={`${bg} ${text} text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

// ============================================================
// Typ-Badge — subtiler, kein gefüllter Hintergrund
// ============================================================
export function TypBadge({ typ }: { typ: "standard" | "diagnose" | "projekt" }) {
  const map: Record<typeof typ, { label: string; cls: string }> = {
    standard: { label: "Standard", cls: "border-line text-typ-standard" },
    diagnose: { label: "Diagnose", cls: "border-typ-diagnose/30 text-typ-diagnose" },
    projekt:  { label: "Projekt",  cls: "border-typ-projekt/30 text-typ-projekt" },
  }
  const { label, cls } = map[typ]
  return (
    <span
      aria-label={`Typ: ${label}`}
      className={`${cls} border bg-transparent text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center`}
    >
      {label}
    </span>
  )
}

// ============================================================
// Prio-Badge — nur sichtbar bei "dringend" oder "hoch"; "normal" implizit
// ============================================================
export function PrioBadge({ prio }: { prio: Prioritaet }) {
  if (prio === "normal") return null
  const map: Record<Exclude<Prioritaet, "normal">, { label: string; icon: string; cls: string }> = {
    dringend: { label: "Dringend", icon: "!!", cls: "bg-danger/10 text-danger" },
    hoch:     { label: "Hoch",     icon: "!",  cls: "bg-warm/10 text-warm-dark" },
  }
  const { label, icon, cls } = map[prio]
  return (
    <span
      role="status"
      aria-label={`Priorität: ${label}`}
      className={`${cls} text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1`}
    >
      <span aria-hidden="true">{icon}</span> {label}
    </span>
  )
}

// ============================================================
// Status-Dot — minimaler Indikator für dichte Listen
// ============================================================
export function StatusDot({ status }: { status: TicketStatus }) {
  const colors: Record<TicketStatus, string> = {
    offen:          "bg-status-offen",
    auktion:        "bg-status-auktion",
    in_bearbeitung: "bg-status-bearbeitung",
    erledigt:       "bg-status-erledigt",
  }
  return (
    <span
      role="img"
      aria-label={`Status: ${status}`}
      className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]} flex-shrink-0`}
    />
  )
}

// ============================================================
// Avatar — Initialen-Bubble mit Rolle-Akzent (optional)
// ============================================================
export function Avatar({ name, size = "md", rolle }: {
  name: string
  size?: "sm" | "md" | "lg"
  rolle?: "verwalter" | "handwerker" | "mieter" | "admin"
}) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-base" }
  const rolleClass = rolle ? `bg-rolle-${rolle}` : "bg-accent"
  return (
    <div
      role="img"
      aria-label={name}
      className={`${sizes[size]} ${rolleClass} text-white rounded-xl flex items-center justify-center font-bold flex-shrink-0`}
    >
      {initials}
    </div>
  )
}

// ============================================================
// Card — bg-surface-card mit border-line
// ============================================================
export function Card({ children, className = "", onClick }: {
  children: React.ReactNode; className?: string; onClick?: () => void
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } } : undefined}
      className={`bg-surface-card rounded-2xl border border-line shadow-sm p-4 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2" : ""} ${className}`}
    >
      {children}
    </div>
  )
}

// ============================================================
// Button — primary/secondary/ghost/danger × sm/md/lg
// ============================================================
export function Button({ children, onClick, disabled, className = "", variant = "primary", size = "md", type = "button" }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  type?: "button" | "submit"
}) {
  const base = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
  const variants: Record<string, string> = {
    primary:   "bg-accent text-white hover:bg-accent-hover hover:shadow-md",
    secondary: "bg-surface-muted border border-line text-ink-secondary hover:bg-line",
    ghost:     "text-ink-secondary hover:bg-surface-muted hover:text-ink",
    danger:    "bg-danger-light text-danger border border-danger/15 hover:bg-danger/10",
  }
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

// ============================================================
// Input + Select + Textarea — einheitliche Form-Standards
// ============================================================
const formFieldBase =
  "w-full px-4 py-3 bg-surface-card border border-line rounded-xl text-sm text-ink placeholder:text-ink-faint " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent transition-colors"

export const Input = forwardRef<
  HTMLInputElement,
  { label?: string } & React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ label, id, className = "", ...props }, ref) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={fieldId} className="text-sm font-medium text-ink-secondary">{label}</label>}
      <input ref={ref} id={fieldId} {...props} className={`${formFieldBase} ${className}`} />
    </div>
  )
})

export const Select = forwardRef<
  HTMLSelectElement,
  { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ label, id, children, className = "", ...props }, ref) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={fieldId} className="text-sm font-medium text-ink-secondary">{label}</label>}
      <select ref={ref} id={fieldId} {...props} className={`${formFieldBase} appearance-none ${className}`}>
        {children}
      </select>
    </div>
  )
})

export function Textarea({ label, id, className = "", ...props }: { label?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={fieldId} className="text-sm font-medium text-ink-secondary">{label}</label>}
      <textarea id={fieldId} {...props} className={`${formFieldBase} ${className}`} />
    </div>
  )
}

// ============================================================
// MetricCard — KPI-Tile mit großer Zahl
// ============================================================
export function MetricCard({ label, value, sub, onClick }: {
  label: string; value: string | number; sub?: string; onClick?: () => void
}) {
  const Wrapper = onClick ? "button" : "div"
  return (
    <Wrapper
      onClick={onClick}
      className={`bg-surface-card rounded-2xl p-5 border border-line text-left w-full ${onClick ? "cursor-pointer hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2" : ""}`}
      {...(onClick && { type: "button" as const })}
    >
      <div className="text-3xl font-bold text-ink tracking-tight tabular-nums">{value}</div>
      <div className="text-xs text-ink-secondary mt-1.5 font-medium uppercase tracking-wider">{label}</div>
      {sub && <div className="text-xs text-accent mt-1 font-medium">{sub}</div>}
    </Wrapper>
  )
}

// ============================================================
// EmptyState — konsistenter "nichts da"-Block
// ============================================================
export function EmptyState({ icon, title, desc, action }: {
  icon: string; title: string; desc: string; action?: React.ReactNode
}) {
  return (
    <div className="text-center py-20" role="status">
      <div className="text-5xl mb-4" aria-hidden="true">{icon}</div>
      <div className="font-semibold text-ink text-lg mb-2">{title}</div>
      <div className="text-sm text-ink-secondary mb-6 max-w-xs mx-auto">{desc}</div>
      {action}
    </div>
  )
}

// ============================================================
// LoadingSpinner — einheitlich, mit aria
// ============================================================
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]" role="status" aria-label="Wird geladen">
      <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
      <span className="sr-only">Wird geladen...</span>
    </div>
  )
}

// ============================================================
// Toast (legacy — neue Calls bitte über useToast() in components/Toast.tsx)
// ============================================================
export function Toast({ message, onClose, type }: {
  message: string; onClose: () => void; type?: "success" | "error"
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-6 right-6 z-50 bg-surface-card border border-line text-ink px-5 py-3.5 rounded-2xl shadow-lg flex items-center gap-3"
    >
      <span className={type === "error" ? "text-danger" : "text-accent"} aria-hidden="true">
        {type === "error" ? "⚠" : "✓"}
      </span>
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        aria-label="Benachrichtigung schließen"
        className="text-ink-faint hover:text-ink ml-2 text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        {"×"}
      </button>
    </div>
  )
}
