"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { X, Check, AlertTriangle } from "lucide-react"

// Sprint AE Phase 2 — Kompakter Banner für Kalender-Page.
// Disconnected → CTA "Mit Google verbinden".
// U4-Fix (27.05., Sprint AE Phase 3): Connected → schmaler grüner
// Status-Hinweis "Verbunden mit <email> seit <datum>", dismissable.
// So weiß HW, dass Sync läuft, und sieht wo er die Verbindung verwaltet.

const DISMISS_KEY = "googleCalBannerDismissed"
const STATUS_DISMISS_KEY = "googleCalStatusDismissed"

interface OauthRow {
  connected_at: string | null
  scope: string | null
  user_id: string
  last_error: string | null
}

export function GoogleCalBanner() {
  // "broken" = OAuth-Zeile existiert, aber Token-Refresh hat zuletzt
  // gefailt (last_error gesetzt durch lib/google-cal/oauth.ts). HW muss
  // neu verbinden, sonst bleibt der Layer leer ohne sichtbaren Grund.
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected" | "broken">("loading")
  const [oauthRow, setOauthRow] = useState<OauthRow | null>(null)
  const [userEmail, setUserEmail] = useState<string>("")
  const [dismissed, setDismissed] = useState(false)
  const [statusDismissed, setStatusDismissed] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true)
      if (localStorage.getItem(STATUS_DISMISS_KEY) === "1") setStatusDismissed(true)
    }
    let aktiv = true
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (aktiv) setStatus("disconnected"); return }
      setUserEmail(user.email ?? "")
      const { data } = await supabase
        .from("hw_google_oauth")
        .select("user_id, connected_at, scope, last_error")
        .eq("user_id", user.id)
        .maybeSingle<OauthRow>()
      if (aktiv) {
        setOauthRow(data ?? null)
        if (!data) setStatus("disconnected")
        else if (data.last_error) setStatus("broken")
        else setStatus("connected")
      }
    })()
    return () => { aktiv = false }
  }, [])

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

  // Audit-Fix #5 — broken: Token-Refresh ist gefailt, HW muss neu verbinden.
  if (status === "broken") {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={16} className="text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-amber-900">Google-Verbindung abgelaufen</div>
          <div className="text-xs text-amber-800 mt-0.5">
            Wir konnten dein Google-Konto nicht mehr aktualisieren. Bitte einmal neu verbinden, damit die Events wieder erscheinen.
          </div>
        </div>
        <button
          type="button"
          onClick={connect}
          className="text-xs font-semibold bg-amber-600 text-white px-3 py-2 rounded-xl hover:bg-amber-700 transition-colors whitespace-nowrap"
        >
          Neu verbinden
        </button>
      </div>
    )
  }

  // Connected → schmaler grüner Status, dismissable
  if (status === "connected" && !statusDismissed) {
    const seitText = oauthRow?.connected_at
      ? new Date(oauthRow.connected_at).toLocaleDateString("de", { day: "numeric", month: "short", year: "numeric" })
      : ""
    const dismissStatus = () => {
      if (typeof window !== "undefined") localStorage.setItem(STATUS_DISMISS_KEY, "1")
      setStatusDismissed(true)
    }
    return (
      <div className="bg-accent/8 border border-accent/30 rounded-xl px-3 py-2 mb-4 flex items-center gap-2.5">
        <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
          <Check size={12} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0 text-xs text-ink">
          <span className="font-semibold">Google-Kalender verbunden</span>
          {userEmail && <span className="text-ink-muted"> · {userEmail}</span>}
          {seitText && <span className="text-ink-muted"> · seit {seitText}</span>}
        </div>
        <button
          type="button"
          onClick={dismissStatus}
          aria-label="Status-Hinweis ausblenden"
          className="p-1 text-ink-muted hover:text-ink"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  if (status !== "disconnected" || dismissed) return null

  const dismiss = () => {
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
