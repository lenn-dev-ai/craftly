"use client"

import { authFetch } from "@/lib/auth/clientFetch"

// Nutzungs-Telemetrie (Audit 11.07.2026) — Client-Helper.
//
// trackFeature("karte") meldet eine Feature-Nutzung an /api/telemetrie
// (→ Cortex-Ereignisstrom). Leitplanken:
// - Dedupe pro Browser-Sitzung: ein Event je Feature+Detail, nicht je
//   Rerender/Navigation — wir zählen Nutzungs-Sitzungen, keine Klicks.
// - Fire-and-forget + fehlerschluckend: Telemetrie darf nie die UX
//   blockieren oder Konsolen-Rauschen erzeugen.

type Feature = "karte" | "voice" | "diagnose" | "frag_reparo"

export function trackFeature(feature: Feature, detail?: string): void {
  try {
    const key = `reparo_tm_${feature}${detail ? `_${detail}` : ""}`
    if (typeof window === "undefined") return
    if (window.sessionStorage.getItem(key) === "1") return
    window.sessionStorage.setItem(key, "1")

    void authFetch("/api/telemetrie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, ...(detail ? { detail } : {}) }),
    }).catch(() => { /* still */ })
  } catch { /* still — z.B. sessionStorage gesperrt */ }
}
