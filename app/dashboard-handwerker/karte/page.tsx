"use client"

import dynamic from "next/dynamic"

// Leaflet greift auf window zu — Client-Only, kein SSR.
const KarteView = dynamic(() => import("@/components/handwerker/KarteView"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#3D8B7A]/20 border-t-[#3D8B7A] rounded-full animate-spin" />
    </div>
  ),
})

export default function KartePage() {
  return (
    <div>
      {/* Ziel-Messaging-Header (über allen Handwerker-Sichten konsistent) */}
      <div className="bg-gradient-to-r from-[#3D8B7A]/[0.08] to-[#5B6ABF]/[0.04] border-b border-[#EDE8E1]">
        <div className="max-w-6xl mx-auto px-6 py-3 text-xs sm:text-sm text-[#2D2A26]">
          <span className="font-semibold text-[#3D8B7A]">Reparo organisiert deinen Tag</span>
          <span className="text-[#6B665E]"> — du konzentrierst dich aufs Handwerk.</span>
        </div>
      </div>
      <KarteView />
    </div>
  )
}
