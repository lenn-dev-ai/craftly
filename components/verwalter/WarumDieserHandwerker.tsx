"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { haversineKm } from "@/lib/distance"
import { formatGewerk } from "@/types"

// „Warum dieser Handwerker?" (Produkt-Review 2026-07-03)
//
// Vertrauen in die KI-Vergabe entsteht durch Erklärung, nicht durch das
// Ergebnis allein — gerade konservative Verwalter genehmigen nur, was sie
// verstehen. Diese Karte erklärt die Auswahl in Klartext-Stichpunkten aus
// echten Profildaten (kein LLM-Text, keine erfundenen Gründe).

interface Props {
  hwId: string
  ticketGewerk: string | null
  einsatzortLat: number | null
  einsatzortLng: number | null
}

interface HwProfil {
  name: string | null
  handwerker_gewerke: string[] | null
  gewerk: string | null
  bewertung_avg: number | null
  auftraege_anzahl: number | null
  angebotstreue: number | null
  startort_lat: number | null
  startort_lng: number | null
}

export function WarumDieserHandwerker({ hwId, ticketGewerk, einsatzortLat, einsatzortLng }: Props) {
  const [profil, setProfil] = useState<HwProfil | null>(null)

  useEffect(() => {
    let aktiv = true
    const supabase = createClient()
    supabase
      .from("profiles")
      .select("name, handwerker_gewerke, gewerk, bewertung_avg, auftraege_anzahl, angebotstreue, startort_lat, startort_lng")
      .eq("id", hwId)
      .maybeSingle<HwProfil>()
      .then(({ data }) => { if (aktiv) setProfil(data) })
    return () => { aktiv = false }
  }, [hwId])

  if (!profil) return null

  const gruende: string[] = []

  // Gewerk-Match
  const gewerke = profil.handwerker_gewerke?.length
    ? profil.handwerker_gewerke
    : profil.gewerk ? [profil.gewerk] : []
  if (ticketGewerk && gewerke.includes(ticketGewerk)) {
    gruende.push(`Fachbetrieb für ${formatGewerk(ticketGewerk)}`)
  }

  // Nähe
  if (
    profil.startort_lat != null && profil.startort_lng != null &&
    einsatzortLat != null && einsatzortLng != null
  ) {
    const km = Math.round(haversineKm(profil.startort_lat, profil.startort_lng, einsatzortLat, einsatzortLng) * 10) / 10
    gruende.push(km <= 10 ? `nur ${km.toLocaleString("de-DE")} km vom Einsatzort` : `${km.toLocaleString("de-DE")} km vom Einsatzort`)
  }

  // Bewertung & Erfahrung
  if (profil.bewertung_avg && profil.bewertung_avg > 0) {
    const sterne = Number(profil.bewertung_avg).toFixed(1).replace(".", ",")
    gruende.push(
      profil.auftraege_anzahl
        ? `${sterne} ★ aus ${profil.auftraege_anzahl} Aufträgen`
        : `${sterne} ★ Bewertung`,
    )
  }

  // Zuverlässigkeit
  if (profil.angebotstreue != null && Number(profil.angebotstreue) >= 90) {
    gruende.push(`${Number(profil.angebotstreue).toFixed(0)} % Zusagen eingehalten`)
  }

  if (gruende.length === 0) return null

  return (
    <div className="mt-4 pt-4 border-t border-[#5B6ABF]/15">
      <div className="text-sm font-medium text-ink-muted mb-2">
        Warum die KI {profil.name ?? "diesen Handwerker"} gewählt hat
      </div>
      <ul className="flex flex-wrap gap-2">
        {gruende.map(g => (
          <li
            key={g}
            className="text-sm text-accent bg-accent/5 border border-accent/15 rounded-full px-3 py-1"
          >
            ✓ {g}
          </li>
        ))}
      </ul>
    </div>
  )
}
