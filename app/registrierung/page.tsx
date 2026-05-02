"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase"
import { Button, Input, Select, Card } from "@/components/ui"
import { registrierungSchema, type RegistrierungInput } from "@/lib/schemas"

const dashMap: Record<string, string> = {
  verwalter: "/dashboard-verwalter",
  handwerker: "/dashboard-handwerker",
  mieter: "/dashboard-mieter",
}

export default function RegistrierungPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegistrierungInput>({
    resolver: zodResolver(registrierungSchema),
    defaultValues: {
      rolle: "verwalter",
      name: "",
      email: "",
      password: "",
      passwordConfirm: "",
      firma: "",
      gewerk: "",
      plz_bereich: "",
    },
  })

  const rolle = watch("rolle")
  const password = watch("password") || ""

  async function onSubmit(values: RegistrierungInput) {
    setServerError("")
    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      })
      if (signUpError || !data.user) {
        setServerError(signUpError?.message || "Fehler bei Registrierung")
        return
      }

      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        email: values.email,
        name: values.name,
        rolle: values.rolle,
        firma: values.firma || null,
        gewerk: values.gewerk || null,
        plz_bereich: values.plz_bereich || null,
      })

      if (profileError) {
        console.error("Profile creation failed:", profileError)
        setServerError("Profil konnte nicht erstellt werden. Bitte kontaktieren Sie den Support.")
        return
      }

      router.push(dashMap[values.rolle] || "/dashboard-mieter")
    } catch {
      setServerError("Ein unerwarteter Fehler ist aufgetreten.")
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
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-4">
              <div>
                <Select label="Ich bin..." aria-invalid={!!errors.rolle} {...register("rolle")}>
                  <option value="verwalter">Hausverwaltung</option>
                  <option value="handwerker">Handwerksbetrieb</option>
                  <option value="mieter">Mieter</option>
                </Select>
                {errors.rolle && <FieldError message={errors.rolle.message} />}
              </div>

              <div>
                <Input
                  label="Vollständiger Name"
                  placeholder="Vor- und Nachname"
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  {...register("name")}
                />
                {errors.name && <FieldError message={errors.name.message} />}
              </div>

              <div>
                <Input
                  label="E-Mail"
                  type="email"
                  placeholder="name@firma.de"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
                {errors.email && <FieldError message={errors.email.message} />}
              </div>

              <div>
                <Input
                  label="Passwort"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mindestens 8 Zeichen"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                {errors.password && <FieldError message={errors.password.message} />}
                <PasswortRegeln passwort={password} />
                <button
                  type="button"
                  className="text-xs text-[#3D8B7A] hover:text-[#2D6B5A] mt-2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Verbergen" : "Anzeigen"}
                </button>
                {password.length > 0 && <PasswortStaerke passwort={password} />}
              </div>

              <div>
                <Input
                  label="Passwort bestätigen"
                  type="password"
                  placeholder="Passwort wiederholen"
                  autoComplete="new-password"
                  aria-invalid={!!errors.passwordConfirm}
                  {...register("passwordConfirm")}
                />
                {errors.passwordConfirm && <FieldError message={errors.passwordConfirm.message} />}
              </div>

              {rolle === "handwerker" && (
                <>
                  <div>
                    <Input
                      label="Firmenname"
                      placeholder="Klimatec GmbH"
                      autoComplete="organization"
                      aria-invalid={!!errors.firma}
                      {...register("firma")}
                    />
                    {errors.firma && <FieldError message={errors.firma.message} />}
                  </div>
                  <div>
                    <Input
                      label="Gewerk / Spezialisierung"
                      placeholder="Heizung, Sanitär"
                      aria-invalid={!!errors.gewerk}
                      {...register("gewerk")}
                    />
                    {errors.gewerk && <FieldError message={errors.gewerk.message} />}
                  </div>
                  <Input
                    label="PLZ-Einzugsgebiet (optional)"
                    placeholder="60xxx, 65xxx"
                    {...register("plz_bereich")}
                  />
                </>
              )}

              {serverError && (
                <p
                  role="alert"
                  className="text-xs text-[#C4574B] bg-[#C4574B]/10 border border-[#C4574B]/20 px-4 py-2.5 rounded-xl font-medium"
                >
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full justify-center"
              >
                {isSubmitting ? "Wird erstellt…" : "Konto erstellen"}
              </Button>

              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-[#8C857B]">
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth="2" />
                  </svg>
                  SSL-verschlüsselt
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
          </form>
        </Card>

        <div className="mt-6 flex justify-center gap-4 text-xs text-[#8C857B]">
          <Link href="/impressum" className="hover:text-[#2D2A26] transition-colors py-2 px-3">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-[#2D2A26] transition-colors py-2 px-3">Datenschutz</Link>
        </div>
      </div>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-[#C4574B] mt-1.5" role="alert">{message}</p>
}

function PasswortRegeln({ passwort }: { passwort: string }) {
  const lang = passwort.length >= 8
  const gross = /[A-Z]/.test(passwort)
  const zahl = /[0-9]/.test(passwort)
  if (!passwort) return null
  return (
    <div className="text-xs text-[#8C857B] mt-2 space-y-0.5" aria-live="polite">
      <p className={lang ? "text-[#3D8B7A]" : ""}>{lang ? "✓" : "○"} Mindestens 8 Zeichen</p>
      <p className={gross ? "text-[#3D8B7A]" : ""}>{gross ? "✓" : "○"} Ein Großbuchstabe</p>
      <p className={zahl ? "text-[#3D8B7A]" : ""}>{zahl ? "✓" : "○"} Eine Zahl</p>
    </div>
  )
}

function PasswortStaerke({ passwort }: { passwort: string }) {
  const stufe = passwort.length < 8 ? 1 : passwort.length < 12 ? 2 : 4
  const farbe = passwort.length < 8 ? "bg-[#C4574B]" : passwort.length < 12 ? "bg-[#C4956A]" : "bg-[#3D8B7A]"
  const label = passwort.length < 8 ? "Mindestens 8 Zeichen" : passwort.length < 12 ? "Gut" : "Stark"
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded ${i <= stufe ? farbe : "bg-[#EDE8E1]"}`} />
        ))}
      </div>
      <p className="text-xs mt-1 text-[#8C857B]">{label}</p>
    </div>
  )
}
