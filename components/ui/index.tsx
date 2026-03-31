"use client"
import { TicketStatus, Prioritaet } from "@/types"

export function Badge({ status }: { status: TicketStatus }) {
  const map: Record<TicketStatus, { label: string; cls: string }> = {
    offen:          { label: "Offen",          cls: "badge-offen" },
    auktion:        { label: "Auktion aktiv",  cls: "badge-auktion" },
    in_bearbeitung: { label: "In Arbeit",      cls: "badge-progress" },
    erledigt:       { label: "Erledigt",       cls: "badge-erledigt" },
  }
  const { label, cls } = map[status]
  return (
    <span className={`${cls} text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  )
}

export function PrioBadge({ prio }: { prio: Prioritaet }) {
  const map: Record<Prioritaet, { label: string; icon: string; cls: string }> = {
    normal:   { label: "Normal",   icon: "—",  cls: "prio-normal" },
    hoch:     { label: "Hoch",     icon: "⚡", cls: "prio-hoch" },
    dringend: { label: "Dringend", icon: "🔥", cls: "prio-dringend" },
  }
  const { label, icon, cls } = map[prio]
  return (
    <span className={`${cls} text-xs font-semibold px-3 py-1.5 rounded-full`}>
      {icon} {label}
    </span>
  )
}

export function StatusDot({ status }: { status: TicketStatus }) {
  const colors: Record<TicketStatus, string> = {
    offen: "bg-[#FF6363]", auktion: "bg-[#00B4D8]",
    in_bearbeitung: "bg-[#FFB74D]", erledigt: "bg-[#00D4AA]",
  }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]} flex-shrink-0 ring-2 ring-current/20`} />
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-base" }
  return (
    <div className={`${sizes[size]} rounded-xl flex items-center justify-center font-bold flex-shrink-0`}
      style={{ background: "linear-gradient(135deg, #00D4AA, #00B4D8)", color: "#fff" }}>
      {initials}
    </div>
  )
}

export function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`bg-[#12121a] border border-white/[0.06] rounded-2xl p-5 shadow-lg shadow-black/20 ${className}`} onClick={onClick}>
      {children}
    </div>
  )
}

export function Button({
  children, onClick, variant = "primary", size = "md", disabled = false, className = "", type = "button"
}: {
  children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "secondary" | "secondary"
  size?: "sm" | "md"; disabled?: boolean; className?: string; type?: "button" | "submit"
}) {
  const base = "font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
  const variants = {
    primary: "bg-gradient-to-r from-[#00D4AA] to-[#00B4D8] text-white hover:shadow-lg hover:shadow-[#00D4AA]/20 hover:brightness-110",
    ghost: "bg-white/[0.04] border border-white/[0.08] text-gray-300 hover:bg-white/[0.08] hover:border-white/[0.15]",
    danger: "bg-[#FF6363]/10 text-[#FF6363] border border-[#FF6363]/20 hover:bg-[#FF6363]/20",
    secondary: "bg-white/[0.06] border border-white/[0.1] text-gray-300 hover:bg-white/[0.1]",
  }
  const sizes = { sm: "px-4 py-2 text-sm", md: "px-5 py-3 text-sm" }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  )
}

export function Input({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-400">{label}</label>}
      <input {...props}
        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/20 transition-all" />
    </div>
  )
}

export function Select({ label, children, ...props }: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-400">{label}</label>}
      <select {...props}
        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-[#00D4AA]/50 cursor-pointer">
        {children}
      </select>
    </div>
  )
}

export function Textarea({ label, ...props }: { label?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-gray-400">{label}</label>}
      <textarea {...props} rows={3}
        className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00D4AA]/50 resize-none" />
    </div>
  )
}

export function MetricCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon?: string }) {
  return (
    <div className="bg-white/[0.03] rounded-2xl p-5 border border-white/[0.06]">
      <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
      <div className="text-xs text-gray-500 mt-1.5 font-medium uppercase tracking-wider">{label}</div>
      {sub && <div className="text-xs text-[#00D4AA] mt-1 font-medium">{sub}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, desc, action }: {
  icon: string; title: string; desc: string; action?: React.ReactNode
}) {
  return (
    <div className="text-center py-20">
      <div className="text-5xl mb-4">{icon}</div>
      <div className="font-semibold text-white text-lg mb-2">{title}</div>
      <div className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">{desc}</div>
      {action}
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-[#00D4AA]/20 border-t-[#00D4AA] rounded-full animate-spin" />
    </div>
  )
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-[#12121a] border border-white/[0.08] text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-black/40 flex items-center gap-3 animate-[slideUp_0.3s_ease-out]">
      <span className="text-[#00D4AA]">✓</span>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="text-gray-500 hover:text-white ml-2 text-lg">×</button>
    </div>
  )
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {action}
    </div>
  )
}

export function PreisTag({ preis }: { preis: number }) {
  return (
    <span className="text-sm font-bold text-[#00D4AA] tabular-nums">
      {preis.toLocaleString("de")} €
    </span>
  )
}
