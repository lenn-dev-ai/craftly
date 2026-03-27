"use client"
import { useEffect, useState } from "react"
import Sidebar from "@/components/layout/Sidebar"
import { createClient } from "@/lib/supabase"
import { Rolle } from "@/types"

export default function HandwerkerLayout({ children }: { children: React.ReactNode }) {
  const [rolle, setRolle] = useState<Rolle>("handwerker")
  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from("profiles").select("rolle").eq("id", user.id).single()
        if (data?.rolle === "admin") setRolle("admin")
      }
    }
    check()
  }, [])
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar rolle={rolle} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
