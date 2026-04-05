"use client"

import { TicketStatus, Prioritaet } from "@/types"

export function Badge({ status }: { status: TicketStatus }) {
  const map: Record<TicketStatus, { label: string; cls: string }> = {
    offen:           { label: "Offen",          cls: "badge-offen" },
    marktplatz:      { label: "Marktplatz",     cls: "badge-progress" },
    auktion:         { label: "Auktion aktiv",  cls: "badge-auktion" },
    vergeben:        { label: "Vergeben",       cls: "badge-progress" },
    in_bearbeitung:  { label: "In Bearbeitung", cls: "badge-progress" },
    in_arbeit:       { label: "In Arbeit",      cls: "badge-progress" },
    erledigt:        { label: "Erledigt",       cls: "badge-erledigt" },
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
    normal:   { label: "Normal",   icon: "\u2014", cls: "prio-normal" },
    hoch:     { label: "Hoch",     icon: "\u26A1",  cls: "prio-hoch" },
    dringend: { label: "Dringend", icon: "\uD83D\uDD25",  cls: "prio-dringend" },
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
    offen:          "bg-[#C4956A]",
    marktplatz:     "bg-[#3D8B7A]",
    auktion:        "bg-[#5B6ABF]",
    vergeben:       "bg-[#8B7ABF]",
    in_bearbeitung: "bg-[#5B6ABF]",
    in_arbeit:      "bg-[#5B6ABF]",
    erledigt:       "bg-[#3D8B7A]",
  }
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]} flex-shrink-0`} />
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-base" }
  return (
    <div className={`${sizes[size]} rounded-xl flex items-center justify-center font-bold flex-shrink-0`}
         style={{ background: "linear-gradient(135deg, #3D8B7A, #4A9E8C)", color: "#fff" }}>
      {initials}
    </div>
  )
}

export function Card({ children, className = "", onClick }: {
  children: React.ReactNode; className?: string; onClick?: () => void
}) {
  return (
    <div className={`bg-white border border-[#EDE8E1] rounded-2xl p-5 shadow-sm ${className}`}
         onClick={onClick}>
      {children}
    </div>
  )
}

export function Button({ children, onClick, variant = "primary", size = "md", disabled = false, className = "", type = "button" }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "secondary"
  size?: "sm" | "md"; disabled?: boolean; className?: string; type?: "button" | "submit"
}) {
  const base = "font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
  const variants = {
    primary: "bg-[#3D8B7A] text-white hover:bg-[#327264] hover:shadow-md",
    ghost: "bg-[#F5F3F0] border border-[#EDE8E1] text-[#2D2A26] hover:bg-[#EDE8E1]",
    danger: "bg-[#FDEEEC] text-[#C4574B] border border-[#C4574B]/15 hover:bg-[#C4574B]/10",
    secondary: "bg-[#F5F3F0] border border-[#EDE8E1] text-[#8C857B] hover:bg-[#EDE8E1]",
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
      {label && <label className="text-sm font-medium text-[#8C857B]">{label}</label>}
      <input {...props}
        className="w-full px-4 py-3 bg-white border border-[#EDE8E1] rounded-xl text-sm text-[#2D2A26] placeholder:text-[#B5AEA4] focus:outline-none focus:border-[#3D8B7A]/50 focus:ring-1 focus:ring-[#3D8B7A]/20 transition-all" />
    </div>
  )
}

export function Select({ label, children, ...props }: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#8C857B]">{label}</label>}
      <select {...props}
        className="w-full px-4 py-3 bg-white border border-[#EDE8E1] rounded-xl text-sm text-[#2D2A26] focus:outline-none focus:border-[#3D8B7A]/50 cursor-pointer">
        {children}
      </select>
    </div>
  )
}

export function Textarea({ label, ...props }: { label?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[#8C857B]">{label}</label>}
      <textarea {...props} rows={3}
        className="w-full px-4 py-3 bg-white border border-[#EDE8E1] rounded-xl text-sm text-[#2D2A26] placeholder:text-[#B5AEA4] focus:outline-none focus:border-[#3D8B7A]/50 resize-none" />
    </div>
  )
}

export function MetricCard({ label, value, sub, icon }: {
  label: string; value: string | number; sub?: string; icon?: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#EDE8E1]">
      <div className="text-3xl font-bold text-[#2D2A26] tracking-tight">{value}</div>
      <div className="text-xs text-[#8C857B] mt-1.5 font-medium uppercase tracking-wider">{label}</div>
      {sub && <div className="text-xs text-[#3D8B7A] mt-1 font-medium">{sub}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, desc, action }: {
  icon: string; title: string; desc: string; action?: React.ReactNode
}) {
  return (
    <div className="text-center py-20">
      <div className="text-5xl mb-4">{icon}</div>
      <div className="font-semibold text-[#2D2A26] text-lg mb-2">{title}</div>
      <div className="text-sm text-[#8C857B] mb-6 max-w-xs mx-auto">{desc}</div>
      {action}
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-[#3D8B7A]/20 border-t-[#3D8B7A] rounded-full animate-spin" />
    </div>
  )
}

export function Toast({ message, onClose, type }: {
  message: string; onClose: () => void; type?: "success" | "error"
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white border border-[#EDE8E1] text-[#2D2A26] px-5 py-3.5 rounded-2xl shadow-lg flex items-center gap-3 animate-[slideUp_0.3s_ease-out]">
      <span className="text-[#3D8B7A]">\u2713</span>
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="text-[#B5AEA4] hover:text-[#2D2A26] ml-2 text-lg">\u00D7</button>
    </div>
  )
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-[#2D2A26]">{title}</h2>
      {action}
    </div>
  )
}

export function PreisTag({ preis }: { preis: number }) {
  return (
    <span className="text-sm font-bold text-[#3D8B7A] tabular-nums">
      {preis.toLocaleString("de")} \u20AC
    </span>
  )
}
