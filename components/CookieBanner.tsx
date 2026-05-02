"use client"
import { useEffect, useState } from "react"

const STORAGE_KEY = "reparo_cookie_consent"

export default function CookieBanner() {
  const [sichtbar, setSichtbar] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const consent = localStorage.getItem(STORAGE_KEY)
    if (!consent) setSichtbar(true)
  }, [])

  function speichern(wahl: "alle" | "notwendig") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wahl, datum: new Date().toISOString() }))
    setSichtbar(false)
  }

  if (!sichtbar) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none">
      <div className="max-w-3xl mx-auto bg-white border border-[#EDE8E1] rounded-2xl shadow-lg p-5 sm:p-6 pointer-events-auto">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-medium text-[#2D2A26] mb-1">Cookies & Datenschutz</h2>
            <p className="text-sm text-[#6B665E]">
              Wir verwenden notwendige Cookies, damit Reparo funktioniert (z. B. Login-Sitzung).
              Optionale Cookies helfen uns, die Plattform zu verbessern. Du kannst deine Wahl jederzeit ändern.
              Mehr Infos in der{" "}
              <a href="/datenschutz" className="text-[#3D8B7A] hover:underline">Datenschutzerklärung</a>.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              onClick={() => speichern("notwendig")}
              className="text-sm font-medium px-4 py-2.5 rounded-lg border border-[#EDE8E1] text-[#2D2A26] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
            >
              Nur notwendige
            </button>
            <button
              onClick={() => speichern("alle")}
              className="text-sm font-medium px-4 py-2.5 rounded-lg bg-[#3D8B7A] text-white hover:bg-[#2D6B5A] transition-colors cursor-pointer"
            >
              Alle akzeptieren
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
