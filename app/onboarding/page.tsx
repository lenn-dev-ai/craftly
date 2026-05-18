"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/lib/supabase"
import { Button, Input, Select, Card } from "@/components/ui"
import { onboardingSchema, type OnboardingInput } from "@/lib/schemas"
import { authFetch } from "@/lib/auth/clientFetch"

// Profil-Lückenfüller für OAuth-Erst-Logins.
//
// Wird vom /auth/callback aufgerufen wenn ein authentifizierter User noch
// keine profiles-Zeile hat. Erfragt nur was nicht aus OAuth-Daten ableitbar
// ist: Rolle, evtl. Firma/Gewerk für Handwerker. Name kommt aus dem Google-
// Profil (full_name oder name) vorbefüllt — User kann ändern.
//
// Wenn User direkt /onboarding aufruft ohne Session: Redirect auf /login.
// Wenn User schon ein Profil hat: Redirect aufs Rollen-Dashboard.

const dashMap: Record<string, string> = {
  admin: "/dashboard-admin",
  verwalter: "/dashboard-verwalter",
  handwerker: "/dashboard-handwerker",
  mieter: "/dashboard-mieter",
}

export default function OnboardingPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState("")
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState("")
  const [userId, setUserId] = useState("")

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      rolle: "verwalter",
      name: "",
      telefon: "",
      firma: "",
      gewerk: "",
      plz_bereich: "",
    },
  })

  const rolle = watch("rolle")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace("/login")
        return
      }
      // Profil schon da? Dann hier kein Loop, direkt zum Dashboard.
      const { data: profile } = await supabase
        .from("profiles")
        .select("rolle")
        .eq("id", user.id)
        .maybeSingle()
      if (profile?.rolle) {
        router.replace(dashMap[profile.rolle] || "/dashboard-mieter")
        return
      }
      setEmail(user.email || "")
      setUserId(user.id)
      const meta = user.user_metadata || {}
      const vorname =
        meta.full_name || meta.name || meta.given_name || ""
      if (vorname) setValue("name", String(vorname))
      setChecking(false)
    })
  }, [router, setValue])

  async function onSubmit(values: OnboardingInput) {
    setServerError("")
    try {
      const supabase = createClient()
      // upsert statt insert: wenn der Login-Redirect uns hierher schickt
      // weil rolle=null aber Zeile schon existiert (z. B. halbangelegt
      // bei früherem Versuch), würde insert mit duplicate-key crashen.
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        email,
        name: values.name,
        rolle: values.rolle,
        telefon: values.telefon || null,
        firma: values.firma || null,
        gewerk: values.gewerk || null,
        plz_bereich: values.plz_bereich || null,
      }, { onConflict: "id" })
      if (error) {
        // echte Fehlermeldung zeigen — sonst rät der User
        console.error("[onboarding] upsert failed:", error)
        setServerError("Profil konnte nicht erstellt werden: " + error.message)
        return
      }
      void authFetch("/api/welcome-mail", { method: "POST" })
      router.push(dashMap[values.rolle] || "/dashboard-mieter")
    } catch (err) {
      console.error("[onboarding] exception:", err)
      const msg = err instanceof Error ? err.message : "Unbekannt"
      setServerError("Unerwarteter Fehler: " + msg)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent/40 border-t-[#3D8B7A] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="text-xl font-bold text-ink">Reparo</span>
          </Link>
          <h1 className="text-2xl font-bold text-ink">Profil vervollständigen</h1>
          <p className="text-sm text-ink-secondary mt-1">
            Angemeldet als <span className="font-medium text-ink">{email}</span>
          </p>
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
                  label="Telefon (optional)"
                  type="tel"
                  placeholder="+49 …"
                  autoComplete="tel"
                  {...register("telefon")}
                />
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
                  className="text-xs text-danger bg-danger/10 border border-danger/20 px-4 py-2.5 rounded-xl font-medium"
                >
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full justify-center"
              >
                {isSubmitting ? "Wird erstellt…" : "Profil speichern"}
              </Button>

              <p className="text-xs text-center text-ink-muted mt-2">
                Mit dem Speichern akzeptieren Sie unsere{" "}
                <Link href="/datenschutz" className="text-accent hover:underline">
                  Datenschutzbestimmungen
                </Link>
                .
              </p>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-danger mt-1.5" role="alert">{message}</p>
}
