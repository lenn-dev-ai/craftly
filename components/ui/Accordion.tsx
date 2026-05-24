"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

// Sprint Q2 — Shared Akkordeon für stufenweise Dashboards.
// Persistiert geöffneten/geschlossenen State in localStorage falls
// persistKey angegeben — der User behält seine Präferenz pro Akkordeon
// über Page-Reloads hinweg.

interface AccordionProps {
  title: string
  /** Optional kleiner Sub-Text rechts vom Titel (z.B. "12 Items") */
  meta?: string
  /** localStorage-Key. Wenn nicht gesetzt → State nur per Session. */
  persistKey?: string
  defaultOpen?: boolean
  children: ReactNode
}

export function Accordion({ title, meta, persistKey, defaultOpen = false, children }: AccordionProps) {
  // Initial-State: localStorage → falls da, sonst defaultOpen. SSR-safe:
  // beim ersten Render immer defaultOpen, danach effect-basiert anpassen.
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!persistKey) return
    try {
      const saved = localStorage.getItem(`reparo:accordion:${persistKey}`)
      if (saved === "1") setOpen(true)
      else if (saved === "0") setOpen(false)
    } catch { /* localStorage disabled */ }
  }, [persistKey])

  function toggle() {
    setOpen(o => {
      const next = !o
      if (persistKey) {
        try { localStorage.setItem(`reparo:accordion:${persistKey}`, next ? "1" : "0") }
        catch { /* localStorage disabled */ }
      }
      return next
    })
  }

  return (
    <section className="bg-white border border-line rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-surface-muted/50 focus:outline-none focus:bg-surface-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-ink truncate">{title}</h3>
          {meta && <span className="text-xs text-ink-muted flex-shrink-0">{meta}</span>}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-ink-muted flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-line">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </section>
  )
}
