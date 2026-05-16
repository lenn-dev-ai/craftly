"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Card, Button } from "@/components/ui"
import { Banknote, CheckCircle2, AlertCircle } from "lucide-react"

// Stripe-Connect-Onboarding-UI für HW.
//
// States:
//   loading       — initial Profil-Load
//   not_connected — kein stripe_account_id → Button "Verbinden"
//   incomplete    — account_id existiert, charges nicht enabled →
//                   Button "Onboarding fortsetzen" (rufruft den
//                   gleichen Endpoint wie initial → Stripe liefert
//                   neuen AccountLink für den bestehenden Account)
//   connected     — charges_enabled=true → Confirmation
//
// Bei Stripe nicht konfiguriert serverseitig: 503 vom onboard-Endpoint
// → friendly "Auszahlung über Reparo ist noch nicht aktiviert"-Text.

type Status = "loading" | "not_connected" | "incomplete" | "connected" | "unavailable"

const queryMessages: Record<string, { label: string; tone: "ok" | "warn" | "err" }> = {
  onboarded: { label: "Stripe-Onboarding abgeschlossen — Auszahlungen sind jetzt aktiv.", tone: "ok" },
  incomplete: { label: "Onboarding noch nicht abgeschlossen. Du kannst jederzeit fortsetzen.", tone: "warn" },
  account_mismatch: { label: "Account-Mismatch beim Stripe-Rückruf. Bitte erneut starten.", tone: "err" },
  retrieve_failed: { label: "Stripe-Status konnte nicht geladen werden. Bitte erneut versuchen.", tone: "err" },
  not_configured: { label: "Stripe ist auf dieser Instanz nicht konfiguriert.", tone: "warn" },
  missing_account: { label: "Account-ID fehlt im Rückruf — bitte Onboarding neu starten.", tone: "err" },
}

export function StripeConnectCard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status>("loading")
  const [err, setErr] = useState("")
  const [pending, setPending] = useState(false)
  const queryHint = searchParams.get("stripe")

  useEffect(() => {
    let aktiv = true
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !aktiv) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_account_id, stripe_charges_enabled")
        .eq("id", user.id)
        .maybeSingle<{ stripe_account_id: string | null; stripe_charges_enabled: boolean }>()
      if (!aktiv) return
      if (!profile?.stripe_account_id) setStatus("not_connected")
      else if (profile.stripe_charges_enabled) setStatus("connected")
      else setStatus("incomplete")
    })()
    return () => { aktiv = false }
  }, [])

  async function startOnboarding() {
    setErr("")
    setPending(true)
    try {
      const res = await fetch("/api/stripe/connect/onboard", { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (res.status === 503) {
        setStatus("unavailable")
        setErr(body.error || "Stripe ist nicht konfiguriert.")
        setPending(false)
        return
      }
      if (!res.ok || !body.url) {
        setErr(body.error || "Onboarding konnte nicht gestartet werden.")
        setPending(false)
        return
      }
      window.location.href = body.url
    } catch {
      setErr("Netzwerk-Fehler beim Start des Onboardings.")
      setPending(false)
    }
  }

  if (status === "loading") {
    return (
      <Card className="bg-white border border-line">
        <div className="flex items-center gap-3">
          <Banknote size={18} className="text-ink-muted" />
          <div className="text-sm text-ink-muted">Stripe-Status wird geladen…</div>
        </div>
      </Card>
    )
  }

  const hint = queryHint && queryMessages[queryHint]

  return (
    <Card className="bg-white border border-line">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Banknote size={20} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-ink">Auszahlungen über Stripe</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Verbinde dein Bankkonto, damit Reparo Auszahlungen abwickeln und
              eventuelle Frist-Penalties direkt verrechnen kann.
            </p>
          </div>
        </div>

        {hint && (
          <div
            role={hint.tone === "err" ? "alert" : undefined}
            className={
              "text-xs px-3 py-2 rounded-lg border " +
              (hint.tone === "ok"
                ? "bg-accent/10 border-accent/20 text-accent"
                : hint.tone === "warn"
                ? "bg-warm-light border-warm/30 text-warm-dark"
                : "bg-danger/10 border-danger/20 text-danger")
            }
          >
            {hint.label}
          </div>
        )}

        {status === "connected" && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
            <CheckCircle2 size={16} className="text-accent" />
            <span className="text-sm font-medium text-accent">
              Bankkonto verbunden — Auszahlungen aktiv
            </span>
          </div>
        )}

        {status === "incomplete" && (
          <>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warm-light border border-warm/30">
              <AlertCircle size={16} className="text-warm-dark" />
              <span className="text-sm font-medium text-warm-dark">
                Onboarding noch offen
              </span>
            </div>
            <Button onClick={startOnboarding} disabled={pending} className="w-full sm:w-auto">
              {pending ? "Weiterleitung…" : "Onboarding fortsetzen"}
            </Button>
          </>
        )}

        {status === "not_connected" && (
          <Button onClick={startOnboarding} disabled={pending} className="w-full sm:w-auto">
            {pending ? "Weiterleitung…" : "Mit Stripe verbinden"}
          </Button>
        )}

        {status === "unavailable" && (
          <div className="text-xs text-ink-muted px-3 py-2 rounded-lg bg-surface-alt border border-line">
            Auszahlungen über Reparo werden vorbereitet — du wirst informiert,
            sobald die Funktion verfügbar ist.
          </div>
        )}

        {err && status !== "unavailable" && (
          <p role="alert" className="text-xs text-danger bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg">
            {err}
          </p>
        )}
      </div>
    </Card>
  )
}
