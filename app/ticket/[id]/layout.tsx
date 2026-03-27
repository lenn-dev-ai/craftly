"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import Sidebar from "@/components/layout/Sidebar"
import { Rolle } from "@/types"

export default function TicketLayout({ children }: { children: React.ReactNode }) {
  const [rolle, setRolle] = useState<Rolle>("verwalter")
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from("profiles").select("rolle").eq("id", user.id).single()
      if (data?.rolle) setRolle(data.rolle as Rolle)
    })
  }, [])
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar rolle={rolle} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
