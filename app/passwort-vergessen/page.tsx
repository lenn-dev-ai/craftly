"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Button, Input, Card } from "@/components/ui"

export default function PasswortVergessenPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit() {
    if (!email.trim() || !email.includes("@")) {
      setError("Bitte eine gültige E-Mail-Adresse eingeben.")
      return
    }
    setLoading(true)
    setError("")

    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/passwort-zuruecksetzen`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

      if (resetError) {
        setError("Versand fehlgeschlagen. Bitte versuchen Sie es erneut.")
        setLoading(false)
        return
      }
      setSuccess(true)
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
          {success ? (
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-[#2D2A26] mb-2">E-Mail unterwegs</h1>
              <p className="text-sm text-[#6B665E] mb-6">
                Wenn ein Konto mit <strong className="text-[#2D2A26]">{email}</strong> existiert,
                erhalten Sie in den nächsten Minuten eine E-Mail mit einem Link zum Zurücksetzen.
                Bitte prüfen Sie auch den Spam-Ordner.
              </p>
              <Link
                href="/login"
                className="inline-block text-sm font-medium text-[#3D8B7A] hover:text-[#2D6B5A]"
              >
                ← Zurück zum Login
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-[#2D2A26] mb-2">Passwort vergessen?</h1>
                <p className="text-sm text-[#6B665E]">
                  Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen sicheren Link zum Zurücksetzen.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-[#C4574B]/10 border border-[#C4574B]/20">
                  <p className="text-sm text-[#C4574B]">{error}</p>
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
                    onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleSubmit()}
                    autoComplete="email"
                  />
                </div>
              </div>

              <Button onClick={handleSubmit} disabled={loading} className="w-full mt-6">
                {loading ? "Wird gesendet..." : "Link senden"}
              </Button>

              <div className="mt-6 text-center text-sm text-[#6B665E]">
                <Link href="/login" className="text-[#3D8B7A] hover:text-[#2D6B5A] font-medium">
                  Zurück zum Login
                </Link>
              </div>
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
