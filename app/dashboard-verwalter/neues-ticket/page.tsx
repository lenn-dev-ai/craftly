"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Diese Seite wird nicht mehr gebraucht.
// Tickets werden jetzt von Mietern gemeldet, nicht vom Verwalter erstellt.
// Redirect zum Marktplatz, wo Handwerker-Stunden gebucht werden.
export default function NeuesTicketRedirect() {
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
