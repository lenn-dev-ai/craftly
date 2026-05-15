"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import type { Rolle } from "@/types"

// Legacy-Route: /ticket/[id] wurde durch rolle-spezifische Routen
// abgelöst (/dashboard-{rolle}/ticket/[id]). Beim Aufruf wird die
// DB-Rolle des Users gelesen und auf die passende Variante weiter-
// geleitet. Damit funktionieren alte Bookmarks und Mail-Links weiter.

const dashboardZuTicket: Record<Rolle, string> = {
  admin: "/dashboard-admin/ticket/",
  verwalter: "/dashboard-verwalter/ticket/",
  handwerker: "/dashboard-handwerker/ticket/",
  mieter: "/dashboard-mieter/ticket/",
}

export default function TicketLegacyRedirect() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  useEffect(() => {
    let aktiv = true
    async function gehe() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (aktiv) router.replace(`/login?redirectTo=/ticket/${encodeURIComponent(id)}`)
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("rolle")
        .eq("id", user.id)
        .single()
      const rolle = (profile?.rolle as Rolle | undefined) ?? "mieter"
      const ziel = `${dashboardZuTicket[rolle]}${id}`
      if (aktiv) router.replace(ziel)
    }
    gehe()
    return () => { aktiv = false }
  }, [id, router])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent/20 border-t-[#3D8B7A] rounded-full animate-spin" />
    </div>
  )
}
