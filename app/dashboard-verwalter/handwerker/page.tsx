"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Handwerker-Verzeichnis wird nicht mehr gebraucht.
// Handwerker werden jetzt ueber den Zeitslot-Marktplatz gefunden und gebucht.
export default function HandwerkerRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/dashboard-verwalter/marktplatz")
  }, [router])

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <p className="text-gray-500 text-sm">Weiterleitung zum Marktplatz...</p>
    </div>
  )
}
