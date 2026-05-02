"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Card } from "@/components/ui"

export default function EmailBestaetigtPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"checking" | "ok" | "fehler">("checking")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) {
        setStatus("fehler")
        return
      }
      setStatus("ok")
      const redirect = setTimeout(async () => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("rolle")
          .eq("id", user.id)
          .single()
        const map: Record<string, string> = {
          admin: "/dashboard-admin",
          verwalter: "/dashboard-verwalter",
          handwerker: "/dashboard-handwerker",
          mieter: "/dashboard-mieter",
        }
        router.push(map[profile?.rolle as string] || "/dashboard-mieter")
      }, 2500)
      return () => clearTimeout(redirect)
    })
  }, [router])

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="p-8 text-center">
          {status === "checking" && (
            <>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#3D8B7A]/30 border-t-[#3D8B7A] rounded-full animate-spin" />
              </div>
              <h1 className="text-xl font-bold text-[#2D2A26] mb-2">E-Mail wird bestätigt…</h1>
              <p className="text-sm text-[#6B665E]">Einen Moment bitte.</p>
            </>
          )}

          {status === "ok" && (
            <>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-[#2D2A26] mb-2">E-Mail bestätigt</h1>
              <p className="text-sm text-[#6B665E]">Sie werden zu Ihrem Dashboard weitergeleitet…</p>
            </>
          )}

          {status === "fehler" && (
            <>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#C4574B]/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C4574B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-[#2D2A26] mb-2">Bestätigung fehlgeschlagen</h1>
              <p className="text-sm text-[#6B665E] mb-6">
                Der Bestätigungslink ist abgelaufen oder ungültig. Bitte registrieren Sie sich erneut oder kontaktieren Sie den Support.
              </p>
              <Link
                href="/login"
                className="inline-block text-sm font-medium px-5 py-2.5 rounded-xl bg-[#3D8B7A] text-white hover:bg-[#2D6B5A] transition-colors"
              >
                Zum Login
              </Link>
            </>
          )}
        </Card>

        <div className="mt-8 flex justify-center gap-6 text-xs text-[#8C857B]">
          <Link href="/impressum" className="hover:text-[#2D2A26] transition-colors py-2 px-3">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-[#2D2A26] transition-colors py-2 px-3">Datenschutz</Link>
        </div>
      </div>
    </div>
  )
}
