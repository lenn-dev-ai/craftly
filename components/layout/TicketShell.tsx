"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import Sidebar from "@/components/layout/Sidebar"
import type { Rolle } from "@/types"

// Rolle live laden, damit das Ticket-Detail mit der zur Rolle passenden
// Sidebar erscheint (Verwalter sieht Verwalter-Nav, Handwerker Handwerker-Nav).
// Vorher war die Rolle hart auf "mieter" verdrahtet.
export default function TicketShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [rolle, setRolle] = useState<Rolle | null>(null)

  useEffect(() => {
    let aktiv = true
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace("/login"); return }
      const { data: profile } = await supabase
        .from("profiles")
        .select("rolle")
        .eq("id", user.id)
        .single()
      if (aktiv) setRolle((profile?.rolle as Rolle | undefined) ?? "mieter")
    }
    load()
    return () => { aktiv = false }
  }, [router])

  if (!rolle) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#3D8B7A]/20 border-t-[#3D8B7A] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#FAF8F5]">
      <Sidebar rolle={rolle} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
