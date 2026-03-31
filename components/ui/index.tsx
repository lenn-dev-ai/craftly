"use client"
import { TicketStatus, Prioritaet } from "@/types"
import { useState, useEffect } from "react"

/* ═══ BADGE — Status-Anzeige für Tickets ═══ */
export function Badge({ status }: { status: TicketStatus }) {
  const map: Record<TicketStatus, { label: string; cls: string }> = {
    offen: { label: "Offen", cls: "badge-offen" },
    auktion: { label: "Auktion aktiv", cls: "badge-auktion" },
    in_bearbeitung: { label: "In Arbeit", cls: "badge-progress" },
    erledigt: { label: "Erledigt", cls: "badge-erledigt" },
  }
  const { label, cls } = map[status]
  return (
    <span className={`${cls} text-[11px] font-semibold px-2.5 py-1 rounded-full tracking-wide uppercase`}>
      {label}
    </span>
  )
}

/* ═══ PRIO BADGE — Dringlichkeits-Anzeige ═══ */
export function PrioBadge({ prio }: { prio: Prioritaet }) {
  const map: Record<Prioritaet, { label: string; cls: string; icon: string }> = {
    normal: { label: "Normal", cls: "prio-normal", icon: "○" },
    hoch: { label: "Hoch", cls: "prio-hoch", icon: "▲" },
    dringend: { label: "Dringend", cls: "prio-dringend", icon: "⚡" },
  }
  const { label, cls, icon } = map[prio]
  return (
    <span className={`${cls} text-[11px] font-semibold px-2.5 py-1 rounded-full tracking-wide uppercase flex items-center gap-1`}>
      <span className="text-[10px]">{icon}</span> {label}
    </span>
  )
}

/* ═══ STATUS DOT — Kleiner farbiger Indikator ═══ */
export function StatusDot({ status }: { status: TicketStatus }) {
  const colors: Record<TicketStatus, string> = {
    offen: "bg-red-500", auktion: "bg-blue-500",
    in_bearbeitung: "bg-amber-400", erledigt: "bg-emerald-500",
  }
  return (
    <span className="relative flex-shrink-0">
      <span className={`block w-2.5 h-2.5 rounded-full ${colors[status]}`} />
      {(status === "auktion" || status === "in_bearbeitung") && (
        <span className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${colors[status]} animate-ping opacity-40`} />
      )}
    </span>
  )
}

/* ═══ AVATAR — Initialen-Avatar mit Gradient ═══ */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const sizes = { sm: "w-8 h-8 text-[11px]", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" }
  return (
    <div className={`${sizes[size]} rounded-full gradient-green flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm`}>
      {initials}
    </div>
  )
}

/* ═══ CARD — Container mit modernem Design ═══ */
export function Card({ children, className = "", onClick, style }: {
  children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties
}) {
  return (
    <div
      className={`bg-white border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] ${onClick ? "cursor-pointer card-hover" : ""} ${className}`}
      onClick={onClick} style={style}
    >
      {children}
    </div>
  )
}

/* ═══ BUTTON — Bold Modern Button ═══ */
export function Button({
  children, onClick, variant = "primary", size = "md", disabled = false, className = "", type = "button"
}: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "secondary"
  size?: "sm" | "md" | "lg"; disabled?: boolean; className?: string; type?: "button" | "submit"
}) {
  const base = "font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
  const variants = {
    primary: "gradient-green text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
    secondary: "bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface)] hover:border-[var(--border-hover)] hover:shadow-md",
    ghost: "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]",
    danger: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:shadow-md",
  }
  const sizes = { sm: "px-3.5 py-2 text-[13px]", md: "px-5 py-2.5 text-sm", lg: "px-6 py-3 text-base" }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  )
}

/* ═══ INPUT — Modernes Eingabefeld ═══ */
export function Input({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-[13px] font-semibold text-[var(--text-secondary)]">{label}</label>}
      <input {...props}
        className="w-full px-4 py-3 border border-[var(--border)] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:ring-offset-1 focus:border-transparent transition-all placeholder:text-[var(--text-muted)]" />
    </div>
  )
}

/* ═══ SELECT — Modernes Auswahlfeld ═══ */
export function Select({ label, children, ...props }: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-[13px] font-semibold text-[var(--text-secondary)]">{label}</label>}
      <select {...props}
        className="w-full px-4 py-3 border border-[var(--border)] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:ring-offset-1 focus:border-transparent cursor-pointer appearance-none">
        {children}
      </select>
    </div>
  )
}

/* ═══ TEXTAREA — Mehrzeiliges Eingabefeld ═══ */
export function Textarea({ label, ...props }: { label?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-[13px] font-semibold text-[var(--text-secondary)]">{label}</label>}
      <textarea {...props} rows={3}
        className="w-full px-4 py-3 border border-[var(--border)] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:ring-offset-1 focus:border-transparent resize-none placeholder:text-[var(--text-muted)]" />
    </div>
  )
}

/* ═══ METRIC CARD — Bold Kennzahlen-Karte ═══ */
export function MetricCard({ label, value, sub, icon }: {
  label: string; value: string | number; sub?: string; icon?: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[var(--border)] shadow-[var(--shadow-sm)] card-hover">
      <div className="flex items-start justify-between">
        <div>
          <div className="metric-value text-[var(--text)]">{value}</div>
          <div className="text-[12px] font-medium text-[var(--text-muted)] mt-2 uppercase tracking-wider">{label}</div>
          {sub && <div className="text-[12px] font-semibold text-[var(--green)] mt-1">{sub}</div>}
        </div>
        {icon && <span className="text-2xl opacity-60">{icon}</span>}
      </div>
    </div>
  )
}

/* ═══ EMPTY STATE — Leerer Zustand ═══ */
export function EmptyState({ icon, title, desc, action }: {
  icon: string; title: string; desc: string; action?: React.ReactNode
}) {
  return (
    <div className="text-center py-20 animate-fade-in">
      <div className="text-5xl mb-4 animate-scale-in" style={{ animationDelay: "100ms" }}>{icon}</div>
      <div className="text-lg font-bold text-[var(--text)] mb-2">{title}</div>
      <div className="text-sm text-[var(--text-muted)] mb-6 max-w-xs mx-auto">{desc}</div>
      {action}
    </div>
  )
}

/* ═══ TOAST — Benachrichtigungs-Popup ═══ */
export function Toast({ message, type = "success", onClose }: {
  message: string; type?: "success" | "error" | "info"; onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])
  const styles = {
    success: "bg-emerald-900 text-emerald-50 border-emerald-700",
    error: "bg-red-900 text-red-50 border-red-700",
    info: "bg-slate-900 text-slate-50 border-slate-700",
  }
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl border shadow-xl ${styles[type]} animate-slide-up flex items-center gap-3`}>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="text-current opacity-60 hover:opacity-100 text-lg leading-none ml-2">&times;</button>
    </div>
  )
}

/* ═══ LOADING SPINNER ═══ */
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-[3px] border-[var(--green)] border-t-transparent rounded-full animate-spin" />
        <div className="text-sm font-medium text-[var(--text-muted)]">Wird geladen...</div>
      </div>
    </div>
  )
}

/* ═══ SKELETON CARD — Lade-Platzhalter ═══ */
export function SkeletonCard() {
  return (
    <div className="bg-white border border-[var(--border)] rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-slate-200 flex-shrink-0 animate-pulse" />
        <div className="flex-1">
          <div className="h-4 bg-slate-200 rounded-lg w-3/4 mb-2.5 animate-pulse" />
          <div className="h-3 bg-slate-100 rounded-lg w-1/2 animate-pulse" />
        </div>
        <div className="h-6 bg-slate-200 rounded-full w-16 animate-pulse" />
      </div>
    </div>
  )
}

/* ═══ SECTION HEADER — Abschnittsüberschrift ═══ */
export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="section-title">{title}</h2>
      {action}
    </div>
  )
}

/* ═══ PREIS TAG — Preisanzeige mit Hervorhebung ═══ */
export function PreisTag({ preis, highlight = false }: { preis: number; highlight?: boolean }) {
  return (
    <span className={`text-base font-bold tabular-nums ${highlight ? "text-[var(--green)]" : "text-[var(--text)]"}`}>
      {preis.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
    </span>
  )
}
