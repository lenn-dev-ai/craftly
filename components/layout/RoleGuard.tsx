"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import type { Rolle } from "@/types"

const dashboardMap: Record<Rolle, string> = {
  admin: "/dashboard-admin",
  verwalter: "/dashboard-verwalter",
  handwerker: "/dashboard-handwerker",
  mieter: "/dashboard-mieter",
}

// Lädt die Rolle des Current-Users und leitet weiter wenn sie nicht
// erlaubt ist. Admins dürfen jedes Dashboard sehen — nützlich um in
// Verwalter/Handwerker/Mieter-Sicht zu wechseln (siehe /admin Panel).
export default function RoleGuard({
  allowed,
  children,
}: {
  allowed: Rolle
  children: React.ReactNode
}) {
  const router = useRouter()
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let aktiv = true
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (aktiv) router.replace("/login")
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("rolle")
        .eq("id", user.id)
        .single()
      const rolle = (profile?.rolle as Rolle | undefined) ?? null
      if (!aktiv) return
      if (rolle === allowed || rolle === "admin") {
        setOk(true)
        return
      }
      router.replace(rolle ? dashboardMap[rolle] : "/login")
    }
    check()
    return () => { aktiv = false }
  }, [allowed, router])

  if (!ok) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#3D8B7A]/20 border-t-[#3D8B7A] rounded-full animate-spin" />
      </div>
    )
  }
  return <>{children}</>
}
