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
  if (prio === "planbar") return null
  const map: Record<Exclude<Prioritaet, "planbar">, { label: string; icon: string; cls: string }> = {
    notfall: { label: "Notfall", icon: "!!", cls: "bg-danger/10 text-danger" },
    zeitnah: { label: "Zeitnah", icon: "!",  cls: "bg-warm/10 text-warm-dark" },
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
// TrustBadge — Vertrauens-Indikatoren basierend auf realen Daten
// (Erfahrung, Bewertung, Aktivität). Keine Selbst-Auskunft, sondern
// objektive Plattform-Metriken — Audit Punkt 10 (Trust & Polish).
// ============================================================
export function TrustBadge({ kind }: {
  kind: "verifiziert" | "erfahren" | "top-bewertet" | "neu" | "aktiv"
}) {
  const map = {
    // "verifiziert" ist der stärkste Trust-Indikator — manuell vom Admin
    // gesetzt nach Prüfung von Gewerbeschein/Versicherung. Steht visuell
    // über den abgeleiteten Badges (gefüllter Background).
    verifiziert:    { label: "Verifiziert",    icon: "✓", cls: "bg-success text-white border-success" },
    erfahren:       { label: "10+ Aufträge",   icon: "✓", cls: "bg-success-light text-success border-success/20" },
    "top-bewertet": { label: "Top-Bewertet",   icon: "★", cls: "bg-warm-light text-warm-dark border-warm/30" },
    neu:            { label: "Neu auf Reparo", icon: "✦", cls: "bg-info-light text-info border-info/20" },
    aktiv:          { label: "Aktiv",          icon: "●", cls: "bg-accent-light text-accent border-accent/20" },
  } as const
  const { label, icon, cls } = map[kind]
  return (
    <span className={`${cls} border text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1`}>
      <span aria-hidden="true">{icon}</span> {label}
    </span>
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
// EmptyState — konsistenter "nichts da"-Block (Sprint N)
// Akzeptiert Emoji-String ODER Lucide-Icon-Component für icon.
// Optionaler Action-Slot kann beliebiges JSX sein, action-Helper
// {label, href|onClick} ist die häufigste Variante.
// ============================================================
type EmptyStateAction = { label: string; href?: string; onClick?: () => void }
export function EmptyState({ icon, title, desc, action, variant = "default" }: {
  icon: string | React.ComponentType<{ className?: string }>
  title: string
  desc: string
  action?: React.ReactNode | EmptyStateAction
  variant?: "default" | "warn"
}) {
  const wrap = variant === "warn"
    ? "bg-warm-light border border-warm/40 rounded-2xl p-10 text-center"
    : "bg-white border border-line rounded-2xl p-10 text-center"
  const iconEl = typeof icon === "string"
    ? <div className="text-4xl mb-3" aria-hidden="true">{icon}</div>
    : (() => {
        const Icon = icon
        return (
          <div className="w-12 h-12 rounded-2xl bg-surface-muted text-rolle-verwalter mx-auto mb-3 flex items-center justify-center" aria-hidden="true">
            <Icon className="w-6 h-6" />
          </div>
        )
      })()
  const actionEl = action && typeof action === "object" && "label" in action
    ? (action.href
        ? <a href={action.href} className="inline-flex items-center gap-2 text-sm font-semibold bg-accent text-white px-5 py-2.5 rounded-xl hover:bg-accent-hover">{action.label}</a>
        : <button onClick={action.onClick} className="inline-flex items-center gap-2 text-sm font-semibold bg-accent text-white px-5 py-2.5 rounded-xl hover:bg-accent-hover">{action.label}</button>)
    : action
  return (
    <div className={wrap} role="status">
      {iconEl}
      <div className="font-semibold text-ink text-lg mb-2">{title}</div>
      <div className="text-sm text-ink-secondary mb-5 max-w-md mx-auto">{desc}</div>
      {actionEl}
    </div>
  )
}

// ============================================================
// Tooltip — kleines Info-Icon mit Hover/Focus-Tooltip (Sprint N)
// Reines CSS-Tooltip via group + group-hover/focus, kein JS,
// kein Portal. Position fest oberhalb. Inhalt ist nur Text.
// ============================================================
export function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group align-middle">
      <button
        type="button"
        tabIndex={0}
        aria-label={`Hinweis: ${text}`}
        className="ml-1 w-4 h-4 rounded-full bg-ink-faint/20 text-ink-muted text-[10px] font-bold flex items-center justify-center hover:bg-ink-faint/30 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-1"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-ink text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50 shadow-md max-w-xs whitespace-normal"
      >
        {text}
      </span>
    </span>
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

// Re-export Accordion damit Pages `import { Accordion } from "@/components/ui"` machen können.
export { Accordion } from "./Accordion"

// Sprint M Extension — State-Design-System.
// `EmptyState` + `LoadingSpinner` + `Toast` bleiben oben in dieser Datei,
// die neuen 6 Komponenten liegen in `./states/index.tsx`.
export {
  LoadingSkeleton,
  ErrorCard,
  WarningBanner,
  ConflictModal,
  EscalationMarker,
  SuccessBanner,
} from "./states"
