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
            const dashMap: Record<string, string> = {
              admin: "/dashboard-admin",
              verwalter: "/dashboard-verwalter",
              handwerker: "/dashboard-handwerker",
              mieter: "/dashboard-mieter",
            }
            window.location.href = dashMap[rolle] || "/dashboard-mieter"
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

      if (authError || !data.user) {
        setError("E-Mail oder Passwort falsch.")
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("rolle")
        .eq("id", data.user.id)
        .single()

      const rolle = profile?.rolle

      const dashMap: Record<string, string> = {
        admin: "/dashboard-admin",
        verwalter: "/dashboard-verwalter",
        handwerker: "/dashboard-handwerker",
        mieter: "/dashboard-mieter",
      }

      window.location.href = dashMap[rolle as string] || "/dashboard-mieter"
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.")
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="logo text-4xl">
            <span className="text-[#2D2A26]">Repa</span>
            <span className="gradient-text">ro</span>
          </div>
          <div className="w-6 h-6 border-2 border-[#3D8B7A]/40 border-t-[#3D8B7A] rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="logo text-4xl mb-2">
            <span className="text-[#2D2A26]">Repa</span>
            <span className="gradient-text">ro</span>
          </div>
          <p className="text-[#8C857B] text-sm">
            Verwalter, Handwerker & Mieter verbinden
          </p>
        </div>

        {error && (
          <div className="bg-[#FDEEEC] border border-[#C4574B]/20 rounded-lg p-3 mb-4 animate-fade-in">
            <p className="text-[#C4574B] text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#6B655B] mb-1">
              E-Mail
            </label>
            <Input
              type="email"
              placeholder="ihre@email.de"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#6B655B] mb-1">
              Passwort
            </label>
            <Input
              type="password"
              placeholder="Ihr Passwort"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Anmeldung..." : "Anmelden"}
          </Button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-[#8C857B] text-sm">
            Noch kein Konto?{" "}
            <Link
              href="/registrierung"
              className="text-[#3D8B7A] hover:text-[#4A9E8C] font-medium"
            >
              Jetzt registrieren
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
