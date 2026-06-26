"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/auth/clientFetch"

// Web-Voice-Button: spricht über das Browser-Mikrofon mit dem Reparo-
// Assistenten (Vapi Web-SDK) — KEINE Telefonie-Minuten, keine Telefonnummer
// nötig. Holt die personalisierte Assistant-Config vom Server
// (/api/vapi/web-call-config) und startet damit den Call.
//
// Voraussetzung: NEXT_PUBLIC_VAPI_PUBLIC_KEY (Vapi "Public Key", client-safe).
// Fehlt er, zeigt der Button einen freundlichen Hinweis statt zu crashen.

type Status = "idle" | "connecting" | "active" | "error"

// Minimaler Typ für die Vapi-Instanz (das SDK wird dynamisch geladen).
interface VapiLike {
  start: (assistant: unknown) => Promise<unknown>
  stop: () => void
  on: (event: string, cb: (...args: unknown[]) => void) => void
  removeAllListeners?: () => void
}

export default function VoiceButton() {
  const [status, setStatus] = useState<Status>("idle")
  const [fehler, setFehler] = useState<string | null>(null)
  const [assistentSpricht, setAssistentSpricht] = useState(false)
  const vapiRef = useRef<VapiLike | null>(null)

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY

  const beenden = useCallback(() => {
    try {
      vapiRef.current?.stop()
    } catch {
      /* ignore */
    }
  }, [])

  // Aufräumen, wenn die Komponente verschwindet (Call nicht weiterlaufen lassen).
  useEffect(() => {
    return () => {
      try {
        vapiRef.current?.stop()
        vapiRef.current?.removeAllListeners?.()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const starten = useCallback(async () => {
    setFehler(null)
    if (!publicKey) {
      setFehler("Sprach-Assistent ist noch nicht konfiguriert (Public Key fehlt).")
      setStatus("error")
      return
    }
    setStatus("connecting")
    try {
      // Config vom Server holen (personalisiert auf den eingeloggten HW).
      // authFetch hängt den Bearer-Token an — getUserFromRequest braucht ihn
      // (Cookie-only schlägt wegen @supabase/ssr-Race-Bug fehl → 401).
      const res = await authFetch("/api/vapi/web-call-config")
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Konfiguration nicht ladbar (HTTP ${res.status})`)
      }
      const { assistant } = await res.json()

      // SDK nur im Browser laden.
      const VapiCtor = (await import("@vapi-ai/web")).default as unknown as new (key: string) => VapiLike
      const vapi = vapiRef.current ?? new VapiCtor(publicKey)
      vapiRef.current = vapi

      vapi.on("call-start", () => setStatus("active"))
      vapi.on("call-end", () => {
        setStatus("idle")
        setAssistentSpricht(false)
      })
      vapi.on("speech-start", () => setAssistentSpricht(true))
      vapi.on("speech-end", () => setAssistentSpricht(false))
      vapi.on("error", (...args: unknown[]) => {
        console.error("[VoiceButton] Vapi-Fehler:", args)
        setFehler("Verbindung zum Sprach-Assistenten fehlgeschlagen.")
        setStatus("error")
      })

      await vapi.start(assistant)
    } catch (err) {
      console.error("[VoiceButton] start fehlgeschlagen:", err)
      setFehler(err instanceof Error ? err.message : "Unbekannter Fehler.")
      setStatus("error")
    }
  }, [publicKey])

  const aktiv = status === "active"
  const verbindet = status === "connecting"

  // Solange kein Vapi-Public-Key konfiguriert ist (NEXT_PUBLIC_VAPI_PUBLIC_KEY),
  // gar nichts zeigen — kein toter Button für Beta-Tester. Sobald der Key in
  // Netlify gesetzt + neu deployt ist, erscheint der Button automatisch.
  if (!publicKey) return null

  return (
    <div className="mb-6 p-4 rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
            aktiv ? "bg-accent text-white" : "bg-accent/10 text-accent"
          } ${aktiv && assistentSpricht ? "animate-pulse" : ""}`}
          aria-hidden
        >
          <span className="text-xl">{aktiv ? "🎙️" : "🤖"}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink">Sprich mit deinem Reparo-Assistenten</div>
          <div className="text-xs text-ink-secondary mt-0.5">
            {aktiv
              ? assistentSpricht
                ? "Assistent spricht …"
                : "Ich höre zu — frag z. B. „Was sind meine neuen Anfragen?“"
              : verbindet
                ? "Verbinde …"
                : "Per Mikrofon, ohne Anruf. Termine, Anfragen & Empfehlungen abfragen."}
          </div>
          {fehler && <div className="text-xs text-danger mt-1">{fehler}</div>}
        </div>

        {aktiv || verbindet ? (
          <button
            type="button"
            onClick={beenden}
            disabled={verbindet}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-colors disabled:opacity-50"
          >
            {verbindet ? "…" : "Beenden"}
          </button>
        ) : (
          <button
            type="button"
            onClick={starten}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            Sprechen
          </button>
        )}
      </div>
    </div>
  )
}
