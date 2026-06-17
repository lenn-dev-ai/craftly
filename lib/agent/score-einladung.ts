// lib/agent/score-einladung.ts
// Sprint AX — Handwerker-Agent: Einladung gegen HW-Präferenzen bewerten.
//
// Gibt Score (0-100) + Empfehlung + menschenlesbare Begründung zurück.
// Wird sowohl vom Dashboard-Panel als auch vom Vapi-Webhook genutzt.

export interface EinladungInput {
  id: string
  ticket_id: string
  titel: string
  gewerk: string | null
  einsatzort_adresse: string | null
  einsatzort_lat: number | null
  einsatzort_lng: number | null
  kosten_final: number | null
  dringlichkeit: string | null
}

export interface HwPreferences {
  handwerker_gewerke: string[] | null
  gewerk: string | null               // Fallback single-Gewerk
  radius_km: number | null            // Profil-Radius (Fallback)
  agent_max_radius_km: number | null  // Agent-spezifisch (überschreibt radius_km)
  agent_auto_accept: boolean
  agent_min_auftragswert: number | null
  startort_lat: number | null
  startort_lng: number | null
  mindest_stundensatz: number | null  // Preis-Untergrenze pro Stunde
}

export interface AgentScore {
  score: number                        // 0-100
  empfehlung: "annehmen" | "ablehnen" | "prüfen"
  // Kurze Stichpunkte für Dashboard + Voice-Briefing
  gruende: string[]
  // Für Auto-Accept-Entscheidung
  autoAcceptEligible: boolean
  distanzKm: number | null
}

// Haversine-Abstand in km
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function gewerkeMatch(einladungGewerk: string | null, hw: HwPreferences): boolean {
  if (!einladungGewerk) return true // kein Filter wenn unbekannt
  const gewerke = hw.handwerker_gewerke?.length
    ? hw.handwerker_gewerke
    : hw.gewerk ? [hw.gewerk] : []
  if (gewerke.length === 0) return true
  return gewerke.includes(einladungGewerk)
}

export function scoreEinladung(
  einladung: EinladungInput,
  hw: HwPreferences,
): AgentScore {
  const gruende: string[] = []
  let score = 50 // Neutral-Basis
  let autoAcceptEligible = true

  // ── 1. Gewerk-Match ────────────────────────────────────────────────────────
  const gewerktMatch = gewerkeMatch(einladung.gewerk, hw)
  if (gewerktMatch) {
    score += 25
    gruende.push("Passt ins Gewerk")
  } else {
    score -= 30
    autoAcceptEligible = false
    const einladungsGewerk = einladung.gewerk ?? "unbekannt"
    gruende.push(`Gewerk passt nicht (${einladungsGewerk})`)
  }

  // ── 2. Entfernung ──────────────────────────────────────────────────────────
  let distanzKm: number | null = null
  const maxRadius = hw.agent_max_radius_km ?? hw.radius_km ?? 25

  if (
    hw.startort_lat != null && hw.startort_lng != null &&
    einladung.einsatzort_lat != null && einladung.einsatzort_lng != null
  ) {
    distanzKm = Math.round(
      haversineKm(
        hw.startort_lat, hw.startort_lng,
        einladung.einsatzort_lat, einladung.einsatzort_lng,
      ) * 10,
    ) / 10

    if (distanzKm <= maxRadius * 0.4) {
      score += 20
      gruende.push(`Nur ${distanzKm} km entfernt`)
    } else if (distanzKm <= maxRadius * 0.75) {
      score += 10
      gruende.push(`${distanzKm} km entfernt`)
    } else if (distanzKm <= maxRadius) {
      score += 0
      gruende.push(`${distanzKm} km (am Rand des Radius)`)
    } else {
      score -= 25
      autoAcceptEligible = false
      gruende.push(`Zu weit: ${distanzKm} km (max. ${maxRadius} km)`)
    }
  } else {
    gruende.push("Entfernung unbekannt")
  }

  // ── 3. Auftragswert ────────────────────────────────────────────────────────
  if (einladung.kosten_final != null) {
    const minWert = hw.agent_min_auftragswert
    if (minWert != null && einladung.kosten_final < minWert) {
      score -= 15
      autoAcceptEligible = false
      gruende.push(`Auftragswert ${einladung.kosten_final}€ unter Mindest-${minWert}€`)
    } else if (einladung.kosten_final >= 150) {
      score += 10
      gruende.push(`Guter Auftragswert (${einladung.kosten_final}€)`)
    } else {
      gruende.push(`Auftragswert ${einladung.kosten_final}€`)
    }
  }

  // ── 4. Dringlichkeit Bonus ─────────────────────────────────────────────────
  if (einladung.dringlichkeit === "notfall") {
    score += 5
    gruende.push("Notfall-Auftrag (Priorität)")
  }

  // ── 5. Empfehlung ──────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score))

  let empfehlung: AgentScore["empfehlung"]
  if (score >= 65) {
    empfehlung = "annehmen"
  } else if (score <= 35) {
    empfehlung = "ablehnen"
    autoAcceptEligible = false
  } else {
    empfehlung = "prüfen"
    autoAcceptEligible = false
  }

  // Auto-Accept nur wenn HW das aktiviert hat UND alle Hard-Blocker grün
  if (!hw.agent_auto_accept) autoAcceptEligible = false

  return { score, empfehlung, gruende, autoAcceptEligible, distanzKm }
}

/** Für Voice-Briefing: Kurzer gesprochener Text mit Empfehlung */
export function scoreZuSprache(
  einladung: EinladungInput,
  result: AgentScore,
): string {
  const adresse = einladung.einsatzort_adresse?.split(",")[0] ?? "unbekannter Ort"
  const distanzText = result.distanzKm != null ? `, ${result.distanzKm} km entfernt` : ""

  if (result.empfehlung === "annehmen") {
    return `${einladung.titel} in ${adresse}${distanzText}. Ich empfehle die anzunehmen — ${result.gruende[0]}.`
  } else if (result.empfehlung === "ablehnen") {
    return `${einladung.titel} in ${adresse}${distanzText}. Ich würde ablehnen — ${result.gruende.find(g => g.includes("nicht") || g.includes("weit") || g.includes("unter")) ?? result.gruende[0]}.`
  } else {
    return `${einladung.titel} in ${adresse}${distanzText}. Schau dir die selbst an — nicht eindeutig.`
  }
}
