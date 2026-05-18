"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/components/Toast"
import { MessageSquare, X } from "lucide-react"

// Floating Feedback-Button für Beta-User-Loop.
//
// Sichtbar nur wenn ein User eingeloggt ist (auth.getUser → user).
// Auf Auth-Routes (/login, /registrierung, /onboarding) versteckt —
// dort macht ein Feedback-Button keinen Sinn (User ist Mid-Funnel).
//
// Submit speichert via /api/feedback (RLS = self-insert) und löst
// optional eine Mail an REPARO_FEEDBACK_EMAIL aus.

const HIDDEN_ON: Array<string | RegExp> = [
  "/login",
  "/registrierung",
  "/passwort-vergessen",
  "/passwort-zuruecksetzen",
  "/email-bestaetigt",
  "/onboarding",
  /^\/auth\//,
]

export function FeedbackWidget() {
  const pathname = usePathname()
  const toast = useToast()
  const [signedIn, setSignedIn] = useState(false)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let aktiv = true
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (aktiv) setSignedIn(!!user)
    })
    return () => { aktiv = false }
  }, [pathname])

  const hidden = HIDDEN_ON.some(p =>
    typeof p === "string" ? pathname === p : p.test(pathname),
  )
  if (!signedIn || hidden || pathname === "/") return null

  async function submit() {
    const message = text.trim()
    if (!message) return
    setPending(true)
    try {
      // B1: Vorheriges Submit lieferte 401 — die SSR-Cookies vom
      // @supabase/ssr v0.3 wurden in /api/feedback nicht zuverlässig
      // gelesen (gleiches Pattern, andere POST-Routes funktionieren).
      // Workaround: Access-Token explizit aus der Client-Session ziehen
      // und als Bearer-Header mitgeben — der createServerSupabaseClient
      // bevorzugt Authorization-Header vor Cookies (siehe lib/supabase-server.ts).
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.show("Bitte neu anmelden — Session abgelaufen.", "error")
        return
      }
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message,
          kontext_url: typeof window !== "undefined" ? window.location.href : null,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.show(body.error || "Senden fehlgeschlagen", "error")
        return
      }
      toast.show("Danke fürs Feedback!", "success")
      setText("")
      setOpen(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {/* F6: Tooltip auf Hover/Focus, damit klar wird, was der Button tut.
          Vorher gab es nur ein aria-label — User mussten erst klicken um
          den Zweck zu verstehen. */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6 z-40 group">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Feedback ans Reparo-Team"
          title="Feedback ans Reparo-Team"
          className="w-12 h-12 rounded-full bg-accent text-white shadow-lg hover:shadow-xl hover:bg-accent-hover transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <MessageSquare size={20} />
        </button>
        <span
          className="pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink/90 text-white text-xs px-3 py-1.5 opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-within:opacity-100 group-focus-within:translate-x-0 transition-all"
          role="tooltip"
        >
          Feedback ans Reparo-Team
        </span>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-end md:items-center justify-center p-4"
          onClick={() => !pending && setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Feedback geben"
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h2 className="text-base font-semibold text-ink">Feedback an Reparo</h2>
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                aria-label="Schließen"
                className="text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-ink-muted">
                Dein Feedback geht direkt an das Reparo-Team — wir lesen jede Nachricht.
                Was nervt, was fehlt, was ist verwirrend?
              </p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={6}
                maxLength={5000}
                placeholder="Dein Feedback…"
                className="w-full px-3 py-2 rounded-xl border border-line text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
                disabled={pending}
              />
              <div className="flex justify-between items-center text-[11px] text-ink-muted">
                <span>Wir sehen den aktuellen Pfad ({pathname}) und deine Rolle.</span>
                <span>{text.length}/5000</span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => !pending && setOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm text-ink-secondary hover:bg-surface-alt"
                  disabled={pending}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending || !text.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {pending ? "Sende…" : "Senden"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
