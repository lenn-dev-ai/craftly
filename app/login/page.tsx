"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Button, Input, Card } from "@/components/ui"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("profiles")
          .select("rolle")
          .eq("id", user.id)
          .single()
          .then(({ data: profile }) => {
            const rolle = profile?.rolle || "mieter"
            const dashboardMap: Record<string, string> = {
              admin: "/dashboard-admin",
              verwalter: "/dashboard-verwalter",
              handwerker: "/dashboard-handwerker",
              mieter: "/dashboard-mieter",
            }
            window.location.href = dashboardMap[rolle] || "/dashboard-mieter"
          })
      } else {
        setChecking(false)
      }
    })
  }, [])

  async function handleLogin() {
    setLoading(true)
    setError("")

    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError("E-Mail oder Passwort ist falsch. Bitte versuchen Sie es erneut.")
        setLoading(false)
        return
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("rolle")
          .eq("id", data.user.id)
          .single()

        const rolle = profile?.rolle || "mieter"
        const dashboardMap: Record<string, string> = {
          admin: "/dashboard-admin",
          verwalter: "/dashboard-verwalter",
          handwerker: "/dashboard-handwerker",
          mieter: "/dashboard-mieter",
        }
        window.location.href = dashboardMap[rolle] || "/dashboard-mieter"
      }
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es spaeter erneut.")
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3D8B7A] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="w-6 h-6 border-2 border-[#3D8B7A]/40 border-t-[#3D8B7A] rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex">
      {/* Left side - Branding & Trust */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#3D8B7A] text-white flex-col justify-between p-12">
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
            Schadensmeldungen, Auftragsvergabe und Kommunikation - alles an einem Ort. Fuer Verwalter, Mieter und Handwerker.
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
                <p className="text-white/70 text-sm">Mieter melden Schaeden in unter 2 Minuten</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <p className="font-semibold">Transparente Vorgaenge</p>
                <p className="text-white/70 text-sm">Echtzeit-Status fuer alle Beteiligten</p>
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
                <p className="text-white/70 text-sm">Hosting in der EU, verschluesselte Uebertragung</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-white/50 text-sm">
          Bereits ueber 500 verwaltete Einheiten auf der Plattform
        </p>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#3D8B7A] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <span className="text-xl font-bold text-[#2D2A26]">Reparo</span>
            </Link>
          </div>

          <Card className="w-full p-8 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-[#2D2A26] mb-2">Willkommen zurueck</h2>
              <p className="text-[#6B665E]">Melden Sie sich in Ihrem Konto an</p>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-lg bg-[#C4574B]/10 border border-[#C4574B]/20">
                <p className="text-sm text-[#C4574B] flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#2D2A26] mb-1.5" htmlFor="email">
                  E-Mail-Adresse
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@beispiel.de"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleLogin()}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#2D2A26] mb-1.5" htmlFor="password">
                  Passwort
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Ihr Passwort"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleLogin()}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              onClick={handleLogin}
              disabled={loading}
              className="w-full mt-6"
            >
              {loading ? "Anmeldung..." : "Anmelden"}
            </Button>

            <div className="mt-6 text-center">
              <p className="text-sm text-[#6B665E]">
                Noch kein Konto?{" "}
                <Link
                  href="/registrierung"
                  className="text-[#3D8B7A] hover:text-[#2D7A6A] font-medium"
                >
                  Jetzt kostenlos registrieren
                </Link>
              </p>
            </div>
          </Card>

          {/* Trust badges below the card */}
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-[#8C857B]">
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              SSL-verschluesselt
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

          <div className="mt-8 flex justify-center gap-4 text-xs text-[#8C857B]">
            <Link href="/impressum" className="hover:text-[#2D2A26] transition-colors">Impressum</Link>
            <Link href="/datenschutz" className="hover:text-[#2D2A26] transition-colors">Datenschutz</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
