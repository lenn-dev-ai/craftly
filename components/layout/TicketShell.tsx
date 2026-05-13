"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import Sidebar from "@/components/layout/Sidebar"
import type { Rolle } from "@/types"

// Ticket-Detail wird von allen vier Rollen besucht. Damit die Sidebar
// zur jeweiligen Sicht passt (Verwalter-Toggle ist nicht 'rein Admin'),
// ermittelt der Shell die anzuzeigende Sidebar-Rolle in drei Stufen:
//
//   1) Query-Param ?as=…                — explizit gesetzt vom Caller
//      (z.B. Admin-Toggle: aktive Sicht wird in den Link gepackt)
//   2) document.referrer Same-Origin    — implizit aus dem vorherigen
//      Dashboard-Pfad (Klick aus /dashboard-verwalter → 'verwalter')
//   3) DB-Rolle des Users               — Fallback bei Direkt-Link
//
// Berechtigung: Admin darf jede Sicht wählen, alle anderen nur ihre
// eigene DB-Rolle (sonst Fallback).

const GUELTIG: Rolle[] = ["admin", "verwalter", "handwerker", "mieter"]

function rolleAusPath(path: string): Rolle | null {
  if (path.startsWith("/dashboard-admin")) return "admin"
  if (path.startsWith("/dashboard-verwalter")) return "verwalter"
  if (path.startsWith("/dashboard-handwerker")) return "handwerker"
  if (path.startsWith("/dashboard-mieter")) return "mieter"
  return null
}

function leseSichtAusReferrer(): Rolle | null {
  if (typeof document === "undefined") return null
  const ref = document.referrer
  if (!ref) return null
  try {
    const url = new URL(ref)
    if (url.origin !== window.location.origin) return null
    return rolleAusPath(url.pathname)
  } catch {
    return null
  }
}

export default function TicketShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const params = useSearchParams()
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
      const dbRolle = (profile?.rolle as Rolle | undefined) ?? "mieter"

      // 1) Query-Param ?as=
      const asParam = params.get("as") as Rolle | null
      if (asParam && GUELTIG.includes(asParam)) {
        if (dbRolle === "admin" || dbRolle === asParam) {
          if (aktiv) setRolle(asParam)
          return
        }
      }

      // 2) Referrer-Inferenz
      const ausReferrer = leseSichtAusReferrer()
      if (ausReferrer) {
        if (dbRolle === "admin" || dbRolle === ausReferrer) {
          if (aktiv) setRolle(ausReferrer)
          return
        }
      }

      // 3) Fallback: DB-Rolle
      if (aktiv) setRolle(dbRolle)
    }
    load()
    return () => { aktiv = false }
  }, [router, params])

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
