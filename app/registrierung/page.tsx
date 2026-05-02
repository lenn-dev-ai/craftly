"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { Button, Input, Select, Card } from "@/components/ui"
import { Rolle } from "@/types"

export default function RegistrierungPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    rolle: "verwalter" as Rolle,
    firma: "",
    gewerk: "",
    plz_bereich: "",
    passwordConfirm: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleRegister() {
    if (!form.name.trim()) {
      setError("Bitte Name eingeben.")
      return
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      setError("Bitte eine gültige E-Mail eingeben.")
      return
    }
    if (form.password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.")
      return
    }
    if (form.password !== form.passwordConfirm) {
      setError("Passwörter stimmen nicht überein.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })

      if (signUpError || !data.user) {
        setError(signUpError?.message || "Fehler bei Registrierung")
        setLoading(false)
        return
      }

      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        email: form.email,
        name: form.name,
        rolle: form.rolle,
        firma: form.firma || null,
        gewerk: form.gewerk || null,
        plz_bereich: form.plz_bereich || null,
      })

      if (profileError) {
        console.error("Profile creation failed:", profileError)
        setError("Profil konnte nicht erstellt werden. Bitte kontaktieren Sie den Support.")
        setLoading(false)
        return
      }

      const dashMap: Record<string, string> = {
        verwalter: "/dashboard-verwalter",
        handwerker: "/dashboard-handwerker",
        mieter: "/dashboard-mieter",
      }

      router.push(dashMap[form.rolle] || "/dashboard-mieter")
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4 overflow-y-auto">
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
          <h1 className="text-2xl font-bold text-[#2D2A26]">Kostenlos registrieren</h1>
          <p className="text-sm text-[#6B665E] mt-1">In 2 Minuten startklar</p>
        </div>

        <Card>
          <div className="flex flex-col gap-4">
            <Select
              label="Ich bin..."
              value={form.rolle}
              onChange={e => set("rolle", e.target.value)}
            >
              <option value="verwalter">Hausverwaltung</option>
              <option value="handwerker">Handwerksbetrieb</option>
              <option value="mieter">Mieter</option>
            </Select>

            <Input
              label="Vollständiger Name"
              placeholder="Max Mustermann"
              value={form.name}
              onChange={e => set("name", e.target.value)}
            />
            <Input
              label="E-Mail"
              type="email"
              placeholder="name@firma.de"
              value={form.email}
              onChange={e => set("email", e.target.value)}
            />
            <Input
              label="Passwort"
              type={showPassword ? "text" : "password"}
              placeholder="Mindestens 8 Zeichen"
              value={form.password}
              onChange={e => set("password", e.target.value)}
            />

            {/* Password Requirements */}
            <div className="text-xs text-[#8C857B] -mt-2 space-y-0.5">
              <p className={form.password.length >= 8 ? "text-[#3D8B7A]" : ""}>
                {form.password.length >= 8 ? "✓" : "○"} Mindestens 8 Zeichen
              </p>
              <p className={/[A-Z]/.test(form.password) ? "text-[#3D8B7A]" : ""}>
                {/[A-Z]/.test(form.password) ? "✓" : "○"} Ein Großbuchstabe
              </p>
              <p className={/[0-9]/.test(form.password) ? "text-[#3D8B7A]" : ""}>
                {/[0-9]/.test(form.password) ? "✓" : "○"} Eine Zahl
              </p>
            </div>
            {/* Password Show/Hide Toggle */}
            <button
              type="button"
              className="text-xs text-[#3D8B7A] hover:text-[#2D6B5A] mt-1 self-start"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Verbergen" : "Anzeigen"}
            </button>

            {/* Password Strength Indicator */}
            {form.password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded ${
                        form.password.length < 8
                          ? i <= 1 ? "bg-[#C4574B]" : "bg-[#EDE8E1]"
                          : form.password.length < 12
                          ? i <= 2 ? "bg-[#C4956A]" : "bg-[#EDE8E1]"
                          : i <= 4 ? "bg-[#3D8B7A]" : "bg-[#EDE8E1]"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs mt-1 text-[#8C857B]">
                  {form.password.length < 8
                    ? "Mindestens 8 Zeichen"
                    : form.password.length < 12
                    ? "Gut"
                    : "Stark"}
                </p>
              </div>
            )}

            <Input
              label="Passwort bestätigen"
              type="password"
              placeholder="Passwort wiederholen"
              value={form.passwordConfirm}
              onChange={e => set("passwordConfirm", e.target.value)}
            />
            {form.passwordConfirm && form.password !== form.passwordConfirm && (
              <p className="text-xs text-[#C4574B] -mt-2">Passwörter stimmen nicht überein</p>
            )}

            {form.rolle === "handwerker" && (
              <>
                <Input
                  label="Firmenname"
                  placeholder="Klimatec GmbH"
                  value={form.firma}
                  onChange={e => set("firma", e.target.value)}
                />
                <Input
                  label="Gewerk / Spezialisierung"
                  placeholder="Heizung, Sanitär"
                  value={form.gewerk}
                  onChange={e => set("gewerk", e.target.value)}
                />
                <Input
                  label="PLZ-Einzugsgebiet"
                  placeholder="60xxx, 65xxx"
                  value={form.plz_bereich}
                  onChange={e => set("plz_bereich", e.target.value)}
                />
              </>
            )}

            {error && (
              <p className="text-xs text-[#C4574B] bg-[#C4574B]/10 border border-[#C4574B]/20 px-4 py-2.5 rounded-xl font-medium">
                {error}
              </p>
            )}

            <Button
              onClick={handleRegister}
              disabled={loading}
              className="w-full justify-center"
            >
              {loading ? "Wird erstellt..." : "Konto erstellen"}
            </Button>

            {/* Trust Signals */}
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-[#8C857B]">
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth="2" />
                </svg>
                SSL-verschlüsselt
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="2" />
                </svg>
                DSGVO-konform
              </div>
            </div>

            <p className="text-xs text-center text-[#8C857B] mt-2">
              Mit der Registrierung akzeptieren Sie unsere{" "}
              <Link href="/datenschutz" className="text-[#3D8B7A] hover:underline">
                Datenschutzbestimmungen
              </Link>
              .
            </p>

            <p className="text-center text-xs text-[#6B665E]">
              Bereits registriert?{" "}
              <Link
                href="/login"
                className="text-[#3D8B7A] hover:text-[#2D6B5A] font-medium transition-colors"
              >
                Einloggen
              </Link>
            </p>
          </div>
        </Card>

        <div className="mt-6 flex justify-center gap-4 text-xs text-[#8C857B]">
          <Link href="/impressum" className="hover:text-[#2D2A26] transition-colors py-2 px-3">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-[#2D2A26] transition-colors py-2 px-3">Datenschutz</Link>
        </div>
      </div>
    </div>
  )
}
