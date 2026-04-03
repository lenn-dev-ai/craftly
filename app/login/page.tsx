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

  // Check if user is already logged in and redirect to dashboard
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

      // Fetch user role from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("rolle")
        .eq("id", data.user.id)
        .single()

      const rolle = profile?.rolle

      // Redirect based on role
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="logo text-4xl">
          <span className="text-white">Repa</span>
          <span className="gradient-text">ro</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="logo text-4xl mb-2">
            <span className="text-white">Repa</span>
            <span className="gradient-text">ro</span>
          </div>
          <p className="text-gray-400">Melden Sie sich an</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              E-Mail
            </label>
            <Input
              type="email"
              placeholder="ihre@email.de"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              onFocus={(e: React.FocusEvent<HTMLInputElement>) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Passwort
            </label>
            <Input
              type="password"
              placeholder="Ihr Passwort"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              onFocus={(e: React.FocusEvent<HTMLInputElement>) => setPassword(e.target.value)}
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
          <p className="text-gray-400 text-sm">
            Noch kein Konto?{" "}
            <Link href="/register" className="text-blue-400 hover:text-blue-300">
              Registrieren
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
