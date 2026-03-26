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
    else router.push("/dashboard-verwalter")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="logo text-3xl mb-2">Craft<span className="text-[#1D9E75]">ly</span></div>
          <p className="text-sm text-gray-500">Einloggen um fortzufahren</p>
        </div>
        <Card>
          <div className="flex flex-col gap-4">
            <Input label="E-Mail" type="email" placeholder="name@firma.de"
              value={email} onChange={e => setEmail(e.target.value)} />
            <Input label="Passwort" type="password" placeholder="â¢â¢â¢â¢â¢â¢â¢â¢"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <Button onClick={handleLogin} disabled={loading} className="w-full justify-center">
              {loading ? "Einloggen..." : "Einloggen"}
            </Button>
            <p className="text-center text-xs text-gray-500">
              Noch kein Account?{" "}
              <a href="/registrierung" className="text-[#1D9E75] hover:underline">Registrieren</a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
