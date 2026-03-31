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
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#00D4AA]/[0.07] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#00B4D8]/[0.05] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-[#7B61FF]/[0.04] rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <div className="logo text-4xl mb-3">
            <span className="text-white">Craft</span>
            <span className="gradient-text">ly</span>
          </div>
          <p className="text-sm text-gray-500">Property Management, neu gedacht.</p>
        </div>
        <Card>
          <div className="flex flex-col gap-5">
            <Input label="E-Mail" type="email" placeholder="name@firma.de"
              value={email} onChange={e => setEmail(e.target.value)} />
            <Input label="Passwort" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
            {error && (
              <p className="text-xs text-[#FF6363] bg-[#FF6363]/10 border border-[#FF6363]/20 px-4 py-2.5 rounded-xl font-medium">
                {error}
              </p>
            )}
            <Button onClick={handleLogin} disabled={loading} className="w-full justify-center">
              {loading ? "Einloggen..." : "Einloggen →"}
            </Button>
            <p className="text-center text-xs text-gray-600">
              Noch kein Account?{" "}
              <a href="/registrierung" className="text-[#00D4AA] hover:text-[#00B4D8] font-medium transition-colors">
                Registrieren
              </a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
