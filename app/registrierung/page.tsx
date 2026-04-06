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
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

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
      setError("Passwörter stimmen nicht überein")
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
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#00D4AA]/[0.07] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#00B4D8]/[0.05] rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="logo text-3xl mb-2">
            <span className="text-white">Repa</span>
            <span className="gradient-text">ro</span>
          </div>
          <p className="text-sm text-gray-500">Konto erstellen</p>
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

            {/* Password Show/Hide Toggle */}
            <button
              type="button"
              className="text-sm text-[#6B665E] hover:text-[#2D2A26] -mt-2 mb-2 text-right"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
            </button>

            {/* Password Strength Indicator */}
            {form.password && (
              <div className="-mt-2 mb-3">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((level) => (

            {/* Trust Signals */}
            <div className="flex items-center justify-center gap-4 text-xs text-[#6B665E] mt-4 mb-2">
              <div className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                SSL-verschlüsselt
              </div>
              <div className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                DSGVO-konform
              </div>
            </div>

            <p className="text-xs text-center text-[#6B665E] mb-4">
              Mit der Registrierung stimmen Sie unseren{" "}
              <Link href="/datenschutz" className="text-[#3D8B7A] hover:underline">
                Datenschutzbestimmungen
              </Link>{" "}
              zu.
            </p>

                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full ${
                        form.password.length >= level * 3
                          ? form.password.length >= 12
                            ? "bg-green-500"
                            : form.password.length >= 8
                            ? "bg-[#C4956A]"
                            : "bg-[#C4574B]"
                          : "bg-[#EDE8E1]"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-[#6B665E]">
                  {form.password.length < 8
                    ? "Mindestens 8 Zeichen erforderlich"
                    : form.password.length < 12
                    ? "Gutes Passwort"
                    : "Starkes Passwort"}
                </p>
              </div>
            )}

            <Input
              label="Passwort bestätigen"
              type={showPassword ? "text" : "password"}
              placeholder="Passwort wiederholen"
              value={form.passwordConfirm}
              onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
              required
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
              <p className="text-xs text-[#FF6363] bg-[#FF6363]/10 border border-[#FF6363]/20 px-4 py-2.5 rounded-xl font-medium">
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

            <p className="text-center text-xs text-gray-600">
              Bereits registriert?{" "}
              <Link
                href="/login"
                className="text-[#00D4AA] hover:text-[#00B4D8] font-medium transition-colors"
              >
                Einloggen
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
