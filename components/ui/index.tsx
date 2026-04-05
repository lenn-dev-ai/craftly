"use client"

import { TicketStatus, Prioritaet } from "@/types"

export function Badge({ status }: { status: TicketStatus }) {
  const map: Record<TicketStatus, { label: string; cls: string }> = {
    offen:            { label: "Offen",            cls: "badge-offen" },
    marktplatz:       { label: "Marktplatz",       cls: "badge-progress" },
    auktion:          { label: "Auktion aktiv",    cls: "badge-auktion" },
    vergeben:         { label: "Vergeben",          cls: "badge-progress" },
    in_bearbeitung:   { label: "In Bearbeitung",   cls: "badge-progress" },
    in_arbeit:        { label: "In Arbeit",        cls: "badge-progress" },
    erledigt:         { label: "Erledigt",          cls: "badge-erledigt" },
  }
  const { label, cls } = map[status]
  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      className={`${cls} text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  )
}

export function PrioBadge({ prio }: { prio: Prioritaet }) {
  const map: Record<Prioritaet, { label: string; icon: string; cls: string }> = {
    dringend: { label: "Dringend", icon: "!!", cls: "badge-dringend" },
    hoch:     { label: "Hoch",     icon: "!",  cls: "badge-hoch" },
    normal:   { label: "Normal",   icon: "-",  cls: "badge-normal" },
    niedrig:  { label: "Niedrig",  icon: "~",  cls: "badge-niedrig" },
  }
  const { label, icon, cls } = map[prio]
  return (
    <span
      role="status"
      aria-label={`Prioritaet: ${label}`}
      className={`${cls} text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1`}
    >
      <span aria-hidden="true">{icon}</span> {label}
    </span>
  )
}

export function StatusDot({ status }: { status: TicketStatus }) {
  const colors: Record<TicketStatus, string> = {
    offen:            "bg-[#C4574B]",
    marktplatz:       "bg-[#3D8B7A]",
    auktion:          "bg-[#5B6ABF]",
    vergeben:         "bg-[#8B7ABF]",
    in_bearbeitung:   "bg-[#5B6ABF]",
    in_arbeit:        "bg-[#5B6ABF]",
    erledigt:         "bg-[#3D8B7A]",
  }
  return (
    <span
      role="img"
      aria-label={`Status: ${status}`}
      className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]} flex-shrink-0`}
    />
  )
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-base" }
  return (
    <div
      role="img"
      aria-label={name}
      className={`${sizes[size]} rounded-xl flex items-center justify-center font-bold flex-shrink-0`}
      style={{ background: "linear-gradient(135deg, #3D8B7A, #4A9E8C)", color: "#fff" }}
    >
      {initials}
    </div>
  )
}

export function Card({ children, className = "", onClick }: {
  children: React.ReactNode; className?: string; onClick?: () => void
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } } : undefined}
      className={`bg-white rounded-2xl border border-[#EDE8E1] shadow-sm ${onClick ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D8B7A] focus-visible:ring-offset-2" : ""} ${className}`}
    >
      {children}
    </div>
  )
}

export function Button({ children, onClick, disabled, className = "", variant = "primary", size = "md", type = "button" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string;
  variant?: "primary" | "ghost" | "danger" | "secondary"; size?: "sm" | "md"; type?: "button" | "submit"
}) {
  const base = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D8B7A] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
  const variants: Record<string, string> = {
    primary: "bg-[#3D8B7A] text-white hover:bg-[#2D7A6A] hover:shadow-md",
    ghost: "bg-[#F5F3F0] border border-[#EDE8E1] text-[#2D2A26] hover:bg-[#EDE8E1]",
    danger: "bg-[#FDEEEC] text-[#C4574B] border border-[#C4574B]/15 hover:bg-[#C4574B]/10",
    secondary: "bg-[#F5F3F0] border border-[#EDE8E1] text-[#736B62] hover:bg-[#EDE8E1]",
  }
  const sizes = { sm: "px-4 py-2 text-sm", md: "px-5 py-3 text-sm" }
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

export function Input({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#736B62]">{label}</label>}
      <input
        {...props}
        className="w-full px-4 py-3 bg-white border border-[#EDE8E1] rounded-xl text-sm text-[#2D2A26] placeholder:text-[#B5AEA4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D8B7A] focus-visible:border-[#3D8B7A] transition-colors"
      />
    </div>
  )
}

export function Select({ label, children, ...props }: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#736B62]">{label}</label>}
      <select
        {...props}
        className="w-full px-4 py-3 bg-white border border-[#EDE8E1] rounded-xl text-sm text-[#2D2A26] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D8B7A] focus-visible:border-[#3D8B7A] transition-colors appearance-none"
      >
        {children}
      </select>
    </div>
  )
}

export function Textarea({ label, ...props }: { label?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#736B62]">{label}</label>}
      <textarea
        {...props}
        className="w-full px-4 py-3 bg-white border border-[#EDE8E1] rounded-xl text-sm text-[#2D2A26] placeholder:text-[#B5AEA4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D8B7A] focus-visible:border-[#3D8B7A] transition-colors"
      />
    </div>
  )
}

export function MetricCard({ label, value, sub, icon }: {
  label: string; value: string | number; sub?: string; icon?: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#EDE8E1]">
      <div className="text-3xl font-bold text-[#2D2A26] tracking-tight">{value}</div>
      <div className="text-xs text-[#736B62] mt-1.5 font-medium uppercase tracking-wider">{label}</div>
      {sub && <div className="text-xs text-[#3D8B7A] mt-1 font-medium">{sub}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, desc, action }: {
  icon: string; title: string; desc: string; action?: React.ReactNode
}) {
  return (
    <div className="text-center py-20" role="status">
      <div className="text-5xl mb-4" aria-hidden="true">{icon}</div>
      <div className="font-semibold text-[#2D2A26] text-lg mb-2">{title}</div>
      <div className="text-sm text-[#736B62] mb-6 max-w-xs mx-auto">{desc}</div>
      {action}
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]" role="status" aria-label="Wird geladen">
      <div className="w-8 h-8 border-2 border-[#3D8B7A]/20 border-t-[#3D8B7A] rounded-full animate-spin" />
      <span className="sr-only">Wird geladen...</span>
    </div>
  )
}

export function Toast({ message, onClose, type }: {
  message: string; onClose: () => void; type?: "success" | "error"
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-6 right-6 z-50 bg-white border border-[#EDE8E1] text-[#2D2A26] px-5 py-3.5 rounded-2xl shadow-lg flex items-center gap-3"
    >
      <span className="text-[#3D8B7A]" aria-hidden="true">{type === "error" ? "\u26A0" : "\u2713"}</span>
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        aria-label="Benachrichtigung schliessen"
        className="text-[#B5AEA4] hover:text-[#2D2A26] ml-2 text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3D8B7A] rounded"
      >
        {"\u00D7"}
      </button>
    </div>
  )
}
