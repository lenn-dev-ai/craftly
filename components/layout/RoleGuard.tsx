"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { ActiveRoleProvider, type ActiveRolle } from "@/lib/context/ActiveRoleContext"
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
//
// Pflegt zugleich den ActiveRoleProvider — sodass <RollenWechsel/>
// in der Sidebar weiß, ob der User Admin ist und welche Sicht aktuell
// gewählt ist (= das `allowed`-Argument).
export default function RoleGuard({
  allowed,
  children,
}: {
  allowed: Rolle
  children: React.ReactNode
}) {
  const router = useRouter()
  const [istAdmin, setIstAdmin] = useState(false)
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
      if (rolle === "admin") setIstAdmin(true)
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

  // ActiveRoleProvider nur für Verwalter/Handwerker — Mieter und Admin
  // haben keinen Toggle.
  const defaultRolle: ActiveRolle | null =
    allowed === "verwalter" ? "verwaltung" :
    allowed === "handwerker" ? "handwerker" : null

  if (defaultRolle) {
    return (
      <ActiveRoleProvider istAdmin={istAdmin} defaultRolle={defaultRolle}>
        {children}
      </ActiveRoleProvider>
    )
  }
  return <>{children}</>
}
