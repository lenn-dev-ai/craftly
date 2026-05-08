"use client"
import { useEffect, useState } from "react"

// Auktions-Countdown im Reparo-Design.
// Format: konditional HH:MM:SS oder MM:SS (wenn < 1 h)
// Pulsing-Animation in der letzten Stunde.
export function Timer({ end }: { end: string }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const calc = () => Math.max(0, Math.floor((new Date(end).getTime() - Date.now()) / 1000))
    setSecs(calc())
    const id = setInterval(() => setSecs(calc()), 1000)
    return () => clearInterval(id)
  }, [end])

  if (secs === 0) {
    return <span className="text-xs text-[#C4574B] font-medium">Abgelaufen</span>
  }

  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const fmt = (n: number) => String(n).padStart(2, "0")
  const dringend = secs < 3600

  return (
    <span
      className={`text-xs px-2.5 py-1 rounded-full font-medium tabular-nums ${
        dringend
          ? "bg-[#C4574B]/10 text-[#C4574B] animate-pulse"
          : "bg-[#C4956A]/10 text-[#C4956A]"
      }`}
    >
      {h > 0 && `${fmt(h)}:`}{fmt(m)}:{fmt(s)}
    </span>
  )
}
