"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { X } from "lucide-react"

// Sprint AE Phase 2 — Kompakter Banner für Kalender-Page.
// Zeigt sich nur wenn HW Google-Kalender noch NICHT verbunden hat.
// Klick → /dashboard-handwerker/profil#google-cal (Section-Anchor) ODER
// startet OAuth-Flow direkt. Dismiss via X (Browser-Local-Storage).

const DISMISS_KEY = "googleCalBannerDismissed"

export function GoogleCalBanner() {
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected">("loading")
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true)
    }
    let aktiv = true
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (aktiv) setStatus("disconnected"); return }
      const { data } = await supabase
        .from("hw_google_oauth")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle<{ user_id: string }>()
      if (aktiv) setStatus(data ? "connected" : "disconnected")
    })()
    return () => { aktiv = false }
  }, [])

  if (status !== "disconnected" || dismissed) return null

  async function connect() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      window.location.href = "/login"
      return
    }
    const res = await fetch("/api/auth/google/connect", {
      headers: { authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      alert("Google-Verbindung konnte nicht gestartet werden")
      return
    }
    const data = await res.json() as { redirectUrl?: string }
    if (data.redirectUrl) window.location.href = data.redirectUrl
  }
  function dismiss() {
    if (typeof window !== "undefined") localStorage.setItem(DISMISS_KEY, "1")
    setDismissed(true)
  }

  return (
    <div className="bg-accent/5 border border-accent/30 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
      <div className="text-2xl">📅</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink">Verbinde deinen Google-Kalender</div>
        <div className="text-xs text-ink-muted mt-0.5">
          Pflege deine freien Zeiten nur in Google — Reparo synct automatisch.
        </div>
      </div>
      <button
        type="button"
        onClick={connect}
        className="text-xs font-semibold bg-accent text-white px-4 py-2 rounded-xl hover:bg-accent-hover transition-colors whitespace-nowrap"
      >
        Verbinden
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Banner schließen"
        className="p-1 text-ink-muted hover:text-ink"
      >
        <X size={16} />
      </button>
    </div>
  )
}
