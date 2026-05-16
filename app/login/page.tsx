"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase"
import { Button, Input, Card } from "@/components/ui"
import { GoogleSignInButton, OrDivider } from "@/components/GoogleSignInButton"
import { loginSchema, type LoginInput } from "@/lib/schemas"

const dashboardMap: Record<string, string> = {
  admin: "/dashboard-admin",
  verwalter: "/dashboard-verwalter",
  handwerker: "/dashboard-handwerker",
  mieter: "/dashboard-mieter",
}

// Honoriert ?redirectTo aus der Middleware nur wenn das Ziel zur Rolle passt
// (z.B. Mieter darf nicht auf /dashboard-handwerker landen).
function zielFuerRolle(rolle: string, redirectTo: string | null): string {
  const fallback = dashboardMap[rolle] || "/dashboard-mieter"
  if (!redirectTo || !redirectTo.startsWith("/")) return fallback
  if (redirectTo.startsWith(fallback)) return redirectTo
  if (rolle === "admin") return redirectTo
  return fallback
}

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState("")
  const [checking, setChecking] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  useEffect(() => {
    // OAuth-Fehler aus Callback-Route durchreichen (z.B. Consent abgelehnt).
    const oauthErr = new URLSearchParams(window.location.search).get("oauth_error")
    if (oauthErr) setServerError(oauthErr)

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("profiles")
          .select("rolle")
          .eq("id", user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            const rolle = profile?.rolle
            if (!rolle) {
              window.location.href = "/onboarding"
              return
            }
            const redirectTo = new URLSearchParams(window.location.search).get("redirectTo")
            window.location.href = zielFuerRolle(rolle, redirectTo)
          })
      } else {
        setChecking(false)
      }
    })
  }, [])

  async function onSubmit(values: LoginInput) {
    setServerError("")
    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })
      if (authError) {
        setServerError("E-Mail oder Passwort ist falsch. Bitte versuchen Sie es erneut.")
        return
      }
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("rolle")
          .eq("id", data.user.id)
          .maybeSingle()
        const rolle = profile?.rolle
        const redirectTo = new URLSearchParams(window.location.search).get("redirectTo")
        const ziel = rolle ? zielFuerRolle(rolle, redirectTo) : "/onboarding"

        // Cookie-Race-Mitigation: window.location.href triggert eine Hard-
        // Navigation, bei der die Middleware den frischen sb-*-auth-Cookie
        // unter Umständen noch nicht sieht (Browser hat ihn lokal gesetzt,
        // aber nicht alle chunked-cookie-Teile sind im Request-Header) →
        // Login-Loop. router.refresh() invalidiert serverseitig die Caches,
        // dann router.push() bleibt in SPA-Mode und nutzt die ohnehin
        // vorhandene client-Session. Erst danach reload für saubere Server-
        // Components mit den jetzt sichtbaren Cookies.
        await waitForSession(supabase, 2000)
        router.refresh()
        router.push(ziel)
      }
    } catch {
      setServerError("Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.")
    }
  }

  // Polled-Wait bis supabase-js die Auth-Cookies persistent hat.
  // Returnt true wenn user da, false bei Timeout. Maximale Verzögerung
  // wird auch durch 1 frame ergänzt (microtask flush für Cookie-Persist).
  async function waitForSession(
    supabase: ReturnType<typeof createClient>,
    maxMs: number,
  ): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < maxMs) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        // Extra microtask-frame, damit document.cookie writes komplett sind
        await new Promise(r => setTimeout(r, 100))
        return true
      }
      await new Promise(r => setTimeout(r, 50))
    }
    return false
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="w-6 h-6 border-2 border-accent/40 border-t-[#3D8B7A] rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Left side - Branding & Trust */}
      <div className="hidden lg:flex lg:w-1/2 bg-accent text-white flex-col justify-between p-12">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="text-xl font-bold">Reparo</span>
          </Link>
        </div>

        <div className="space-y-8">
          <h1 className="text-3xl font-bold leading-tight">
            Immobilienverwaltung,<br />die einfach funktioniert.
          </h1>
          <p className="text-white/80 text-lg leading-relaxed max-w-md">
            Schadensmeldungen, Auftragsvergabe und Kommunikation - alles an einem Ort. Für Verwalter, Mieter und Handwerker.
          </p>

          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold">Schnelle Schadensmeldung</p>
                <p className="text-white/70 text-sm">Mieter melden Schäden in unter 2 Minuten</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold">Transparente Vorgänge</p>
                <p className="text-white/70 text-sm">Echtzeit-Status für alle Beteiligten</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold">DSGVO-konform</p>
                <p className="text-white/70 text-sm">Hosting in der EU, verschlüsselte Übertragung</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-white/50 text-sm">
          Bereits über 500 verwaltete Einheiten auf der Plattform
        </p>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <span className="text-xl font-bold text-ink">Reparo</span>
            </Link>
          </div>
          {/* Mobile trust indicators */}
          <div className="lg:hidden mb-6 text-center">
            <p className="text-sm text-ink-secondary mb-3">Immobilienverwaltung, die einfach funktioniert.</p>
            <div className="flex flex-wrap justify-center gap-3 text-xs text-ink-muted">
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Schnelle Meldung
              </span>
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Echtzeit-Status
              </span>
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                DSGVO-konform
              </span>
            </div>
          </div>

          <Card className="w-full p-8 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-ink mb-2">Willkommen zurück</h2>
              <p className="text-ink-secondary">Melden Sie sich in Ihrem Konto an</p>
            </div>

            {serverError && (
              <div className="mb-6 p-3 rounded-lg bg-danger/10 border border-danger/20" role="alert">
                <p className="text-sm text-danger flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {serverError}
                </p>
              </div>
            )}

            <GoogleSignInButton mode="login" />
            <OrDivider />

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5" htmlFor="email">
                    E-Mail-Adresse
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@beispiel.de"
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-danger mt-1.5" role="alert">{errors.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5" htmlFor="password">
                    Passwort
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Ihr Passwort"
                    autoComplete="current-password"
                    aria-invalid={!!errors.password}
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-xs text-danger mt-1.5" role="alert">{errors.password.message}</p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-6"
              >
                {isSubmitting ? "Anmeldung…" : "Anmelden"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/passwort-vergessen"
                className="text-sm text-ink-secondary hover:text-accent transition-colors"
              >
                Passwort vergessen?
              </Link>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-ink-secondary">
                Noch kein Konto?{" "}
                <Link
                  href="/registrierung"
                  className="text-accent hover:text-[#2D7A6A] font-medium"
                >
                  Jetzt kostenlos registrieren
                </Link>
              </p>
            </div>
          </Card>

          {/* Trust badges below the card */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-ink-muted">
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              SSL-verschlüsselt
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              DSGVO-konform
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              EU-Hosting
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-4 text-xs text-ink-muted">
            <Link href="/impressum" className="hover:text-ink transition-colors py-2 px-3">Impressum</Link>
            <Link href="/agb" className="hover:text-ink transition-colors py-2 px-3">AGB</Link>
            <Link href="/datenschutz" className="hover:text-ink transition-colors py-2 px-3">Datenschutz</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
