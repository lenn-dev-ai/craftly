"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button, Input, Card } from "@/components/ui"

export default function PasswortZuruecksetzenPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [sessionReady, setSessionReady] = useState<"checking" | "ok" | "missing">("checking")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionReady(session ? "ok" : "missing")
    })
  }, [])

  async function handleSubmit() {
    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.")
      return
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Passwort muss mindestens einen Großbuchstaben und eine Zahl enthalten.")
      return
    }
    if (password !== confirm) {
      setError("Passwörter stimmen nicht überein.")
      return
    }
    setLoading(true)
    setError("")

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError("Passwort konnte nicht aktualisiert werden. Der Link ist möglicherweise abgelaufen.")
        setLoading(false)
        return
      }
      setSuccess(true)
      setTimeout(() => router.push("/login"), 3000)
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-lg bg-[#3D8B7A] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="text-xl font-bold text-[#2D2A26]">Reparo</span>
          </Link>
        </div>

        <Card className="p-8">
          {sessionReady === "checking" && (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#3D8B7A]/30 border-t-[#3D8B7A] rounded-full animate-spin" />
            </div>
          )}

          {sessionReady === "missing" && (
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#C4574B]/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C4574B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-[#2D2A26] mb-2">Link abgelaufen</h1>
              <p className="text-sm text-[#6B665E] mb-6">
                Der Link zum Zurücksetzen ist abgelaufen oder ungültig. Bitte fordern Sie einen neuen an.
              </p>
              <Link
                href="/passwort-vergessen"
                className="inline-block text-sm font-medium px-5 py-2.5 rounded-xl bg-[#3D8B7A] text-white hover:bg-[#2D6B5A] transition-colors"
              >
                Neuen Link anfordern
              </Link>
            </div>
          )}

          {sessionReady === "ok" && success && (
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-[#2D2A26] mb-2">Passwort aktualisiert</h1>
              <p className="text-sm text-[#6B665E]">Sie werden in wenigen Sekunden zum Login weitergeleitet…</p>
            </div>
          )}

          {sessionReady === "ok" && !success && (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-[#2D2A26] mb-2">Neues Passwort festlegen</h1>
                <p className="text-sm text-[#6B665E]">Wählen Sie ein sicheres Passwort für Ihr Konto.</p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-[#C4574B]/10 border border-[#C4574B]/20">
                  <p className="text-sm text-[#C4574B]">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#2D2A26] mb-1.5" htmlFor="password">
                    Neues Passwort
                  </label>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mindestens 8 Zeichen"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <div className="text-xs text-[#8C857B] mt-2 space-y-0.5">
                    <p className={password.length >= 8 ? "text-[#3D8B7A]" : ""}>
                      {password.length >= 8 ? "✓" : "○"} Mindestens 8 Zeichen
                    </p>
                    <p className={/[A-Z]/.test(password) ? "text-[#3D8B7A]" : ""}>
                      {/[A-Z]/.test(password) ? "✓" : "○"} Ein Großbuchstabe
                    </p>
                    <p className={/[0-9]/.test(password) ? "text-[#3D8B7A]" : ""}>
                      {/[0-9]/.test(password) ? "✓" : "○"} Eine Zahl
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-[#3D8B7A] hover:text-[#2D6B5A] mt-2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Verbergen" : "Anzeigen"}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#2D2A26] mb-1.5" htmlFor="confirm">
                    Passwort bestätigen
                  </label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Passwort wiederholen"
                    value={confirm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleSubmit()}
                    autoComplete="new-password"
                  />
                  {confirm && password !== confirm && (
                    <p className="text-xs text-[#C4574B] mt-1">Passwörter stimmen nicht überein</p>
                  )}
                </div>
              </div>

              <Button onClick={handleSubmit} disabled={loading} className="w-full mt-6">
                {loading ? "Wird gespeichert..." : "Passwort speichern"}
              </Button>
            </>
          )}
        </Card>

        <div className="mt-6 flex justify-center gap-4 text-xs text-[#8C857B]">
          <Link href="/impressum" className="hover:text-[#2D2A26] transition-colors py-2 px-3">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-[#2D2A26] transition-colors py-2 px-3">Datenschutz</Link>
        </div>
      </div>
    </div>
  )
}
