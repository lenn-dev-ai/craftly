"use client"
import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { Button, Input, Card } from "@/components/ui"

export default function LoginPage() {
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
        if (rolle === "verwalter") window.location.href = "/dashboard-verwalter"
        else if (rolle === "handwerker") window.location.href = "/dashboard-handwerker"
        else if (rolle === "mieter") window.location.href = "/dashboard-mieter"
        else window.location.href = "/dashboard-verwalter"
  }

  return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
              <div className="w-full max-w-sm">
                      <div className="text-center mb-8">
                                <div className="logo text-3xl mb-2">Craft<span className="text-[#1D9E75]">ly</span>span></div>div>
                                <p className="text-sm text-gray-500">Einloggen um fortzufahren</p>p>
                      </div>div>
                      <Card>
                                <div className="flex flex-col gap-4">
                                            <Input label="E-Mail" type="email" placeholder="name@firma.de"
                                                            value={email} onChange={e => setEmail(e.target.value)} />
                                            <Input label="Passwort" type="password" placeholder="••••••••"
                                                            value={password} onChange={e => setPassword(e.target.value)}
                                                            onKeyDown={e => e.key === "Enter" && handleLogin()} />
                                  {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>p>}
                                            <Button onClick={handleLogin} disabled={loading} className="w-full justify-center">
                                              {loading ? "Einloggen..." : "Einloggen"}
                                            </Button>Button>
                                            <p className="text-center text-xs text-gray-500">
                                                          Noch kein Account?{" "}
                                                          <a href="/registrierung" className="text-[#1D9E75] hover:underline">Registrieren</a>a>
                                            </p>p>
                                </div>div>
                      </Card>Card>
              </div>div>
        </div>div>
      )
}
</div>
