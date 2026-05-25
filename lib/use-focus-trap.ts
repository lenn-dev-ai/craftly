"use client"

import { useEffect, type RefObject } from "react"

// Custom-Focus-Trap-Hook für Modals/Dialoge (A11y-Post-Beta-Backlog).
// Keine zusätzliche Dep (kein focus-trap-react), reines React + DOM.
//
// Behavior:
// - Beim Aktivieren (open=true): aktives Element merken, ersten
//   fokussierbaren Knoten im Container fokussieren
// - Tab + Shift+Tab kreisen IM Container (kein Tab-out)
// - Beim Deaktivieren: vorherigen Fokus wiederherstellen
//
// Usage:
//   const ref = useRef<HTMLDivElement>(null)
//   useFocusTrap(ref, isOpen)
//   return <div ref={ref} role="dialog" aria-modal="true">…</div>

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    // Erst-Fokus auf das erste fokussierbare Kind. Falls keins: Container
    // selbst (tabindex=-1 würde noch sicherer sein, aber lassen wir es
    // pragmatisch).
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    )
    if (focusables.length > 0) {
      focusables[0].focus()
    } else {
      container.focus?.()
    }

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || !containerRef.current) return
      const current = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(el => !el.hasAttribute("disabled") && el.offsetParent !== null)
      if (current.length === 0) {
        e.preventDefault()
        return
      }
      const first = current[0]
      const last = current[current.length - 1]
      const activeEl = document.activeElement as HTMLElement | null
      if (e.shiftKey && activeEl === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      // Fokus zurück auf das vorher aktive Element, sofern es noch im DOM
      // ist. Sonst: nichts (Document hat Default-Fokus).
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus?.()
      }
    }
  }, [active, containerRef])
}
