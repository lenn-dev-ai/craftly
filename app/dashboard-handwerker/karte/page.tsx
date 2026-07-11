"use client"

import dynamic from "next/dynamic"
import { useEffect } from "react"
import { trackFeature } from "@/lib/telemetrie"

// Leaflet greift auf window zu — Client-Only, kein SSR.
const KarteView = dynamic(() => import("@/components/handwerker/KarteView"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent/20 border-t-[#3D8B7A] rounded-full animate-spin" />
    </div>
  ),
})

// Audit-M2: vorheriger "Reparo organisiert deinen Tag"-Hero entfernt —
// redundant über der Karte, die ja gerade die Tagesorganisation zeigt.
export default function KartePage() {
  // Telemetrie (Audit 11.07.): zählt Karten-Sitzungen für die
  // Streichen-oder-Vertiefen-Entscheidung. Dedupe pro Session im Helper.
  useEffect(() => { trackFeature("karte") }, [])
  return <KarteView />
}
