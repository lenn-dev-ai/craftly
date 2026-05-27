"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"

// Google-OAuth-Button für Login + Registrierung.
//
// Provider muss in Supabase Dashboard → Authentication → Providers → Google
// aktiviert sein. redirectTo zeigt zwingend auf /auth/callback (gleicher
// Origin), das die GoogleOAuth-Response in eine Supabase-Session umwandelt.
//
// Hinweise:
//   - Wir nutzen "consent"-Prompt um sicherzustellen dass Google bei jedem
//     Login Account-Picker zeigt — sonst loggt der Browser mit dem zuletzt
//     gewählten Google-Konto ein, was bei mehrkonten-Usern verwirrt.
//   - skipBrowserRedirect=false (Default) ist gewollt: signInWithOAuth
//     navigiert direkt auf accounts.google.com.

const labelMap: Record<"login" | "register", string> = {
  login: "Mit Google anmelden",
  register: "Mit Google registrieren",
}

export function GoogleSignInButton({
  mode = "login",
  className = "",
}: {
  mode?: "login" | "register"
  className?: string
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function handleClick() {
    setError("")
    setPending(true)
    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback`
      // Sprint AE Phase 2: zusätzliche Calendar-Scopes mit anfragen.
      // Bei erfolgreichem Login bekommt Reparo provider_token + refresh
      // (in der Session) — der Callback speichert es in hw_google_oauth.
      // So ist Login + Cal-Verknüpfung ein Ein-Klick-Flow für HW.
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "https://www.googleapis.com/auth/calendar.readonly",
          queryParams: {
            prompt: "consent",
            access_type: "offline",
          },
        },
      })
      if (oauthErr) {
        setError("Google-Anmeldung konnte nicht gestartet werden.")
        setPending(false)
      }
      // Erfolgsfall: Browser wird redirected, kein weiterer Code nötig.
    } catch {
      setError("Unerwarteter Fehler beim Start der Google-Anmeldung.")
      setPending(false)
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-label={labelMap[mode]}
        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-line bg-white text-ink font-medium text-sm transition-colors hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <GoogleLogo />
        {pending ? "Weiterleitung…" : labelMap[mode]}
      </button>
      {error && (
        <p
          role="alert"
          className="mt-2 text-xs text-danger bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg"
        >
          {error}
        </p>
      )}
    </div>
  )
}

export function OrDivider({ label = "oder" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-4" aria-hidden="true">
      <div className="flex-1 h-px bg-line" />
      <span className="text-xs uppercase tracking-wider text-ink-muted">{label}</span>
      <div className="flex-1 h-px bg-line" />
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.255h2.908c1.702-1.567 2.684-3.874 2.684-6.612z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}
