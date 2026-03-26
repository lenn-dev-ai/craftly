"use client"
import { TicketStatus, Prioritaet } from "@/types"

export function Badge({ status }: { status: TicketStatus }) {
  const map: Record<TicketStatus, { label: string; cls: string }> = {
    offen:          { label: "Offen",          cls: "badge-offen" },
    auktion:        { label: "Auktion",        cls: "badge-auktion" },
    in_bearbeitung: { label: "In Bearbeitung", cls: "badge-progress" },
    erledigt:       { label: "Erledigt",       cls: "badge-erledigt" },
  }
  const { label, cls } = map[status]
  return (
    <span className={`${cls} text-xs font-medium px-2.5 py-1 rounded-full`}>
      {label}
    </span>
  )
}

export function PrioBadge({ prio }: { prio: Prioritaet }) {
  const map: Record<Prioritaet, { label: string; cls: string }> = {
    normal:   { label: "Normal",   cls: "prio-normal" },
    hoch:     { label: "Hoch",     cls: "prio-hoch" },
    dringend: { label: "Dringend", cls: "prio-dringend" },
  }
  const { label, cls } = map[prio]
  return (
    <span className={`${cls} text-xs font-medium px-2.5 py-1 rounded-full`}>
      {label}
    </span>
  )
}

export function StatusDot({ status }: { status: TicketStatus }) {
  const colors: Record<TicketStatus, string> = {
    offen: "bg-red-500", auktion: "bg-blue-500",
    in_bearbeitung: "bg-amber-400", erledigt: "bg-green-500",
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status]} flex-shrink-0`} />
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const sizes = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-12 h-12 text-base" }
  return (
    <div className={`${sizes[size]} rounded-full bg-green-light flex items-center justify-center font-medium text-green-dark flex-shrink-0`}
      style={{ background: "#E1F5EE", color: "#0F6E56" }}>
      {initials}
    </div>
  )
}

export function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`bg-white border border-gray-100 rounded-xl p-4 ${className}`} onClick={onClick}>
      {children}
    </div>
  )
}

export function Button({
  children, onClick, variant = "primary", size = "md", disabled = false, className = "", type = "button"
}: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"
  size?: "sm" | "md"; disabled?: boolean; className?: string; type?: "button" | "submit"
}) {
  const base = "font-medium rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  const variants = {
    primary: "bg-[#1D9E75] text-white hover:bg-[#0F6E56]",
    ghost: "bg-transparent border border-gray-200 text-gray-700 hover:bg-gray-50",
    danger: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
  }
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5 text-sm" }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  )
}

export function Input({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-500">{label}</label>}
      <input {...props}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#1D9E75] transition-colors" />
    </div>
  )
}

export function Select({ label, children, ...props }: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-500">{label}</label>}
      <select {...props}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#1D9E75] cursor-pointer">
        {children}
      </select>
    </div>
  )
}

export function Textarea({ label, ...props }: { label?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-500">{label}</label>}
      <textarea {...props} rows={3}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#1D9E75] resize-none" />
    </div>
  )
}

export function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <div className="text-2xl font-medium text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-[#1D9E75] mt-0.5">{sub}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, desc, action }: {
  icon: string; title: string; desc: string; action?: React.ReactNode
}) {
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-medium text-gray-800 mb-1">{title}</div>
      <div className="text-sm text-gray-500 mb-4">{desc}</div>
      {action}
    </div>
  )
}
