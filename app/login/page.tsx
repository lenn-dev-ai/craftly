"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Input, Card } from "@/components/ui"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true); setError("")
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError("E-Mail oder Passwort falsch."); setLoading(false); return }

    const { data: profile } = await supabase
      .from("profiles").select("rolle").eq("id", data.user.id).single()

    const rolle = profile?.rolle
    if (rolle === "admin") router.push("/admin")
    else if (rolle === "verwalter") router.push("/dashboard-verwalter")
    else if (rolle === "handwerker") router.push("/dashboard-handwerker")
    else if (rolle === "mieter") router.push("/dashboard-mieter")
    else router.push("/login")
  }

  return (
    <div className="min-h-screen bg-[var(--surface-2)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-10">
          <div className="logo text-4xl mb-3 tracking-tight">
            Craft<span className="text-[var(--green)]">ly</span>
          </div>
          <p className="text-sm text-[var(--text-muted)]">Einloggen um fortzufahren</p>
        </div>

        <Card className="!p-6">
          <div className="flex flex-col gap-5">
            <Input label="E-Mail" type="email" placeholder="name@firma.de"
              value={email} onChange={e => setEmail(e.target.value)} />
            <Input label="Passwort" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />

            {error && (
              <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 px-4 py-2.5 rounded-xl font-medium animate-scale-in">
                {error}
              </div>
            )}

            <Button onClick={handleLogin} disabled={loading} className="w-full justify-center" size="lg">
              {loading ? "Einloggen..." : "Einloggen"}
            </Button>

            <p className="text-center text-[13px] text-[var(--text-muted)]">
              Noch kein Account?{" "}
              <a href="/registrierung" className="text-[var(--green)] font-semibold hover:underline underline-offset-2">
                Registrieren
              </a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
