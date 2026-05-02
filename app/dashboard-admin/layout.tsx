"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"

const NAV_ITEMS = [
  { label: "Übersicht", href: "/dashboard-admin", icon: "D" },
  { label: "Nutzer", href: "/dashboard-admin/nutzer", icon: "N" },
  { label: "Aktivität", href: "/dashboard-admin/aktivitaet", icon: "A" },
  { label: "System", href: "/dashboard-admin/system", icon: "S" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const { data: profile } = await supabase.from("profiles").select("rolle").eq("id", user.id).single()
      if (profile?.rolle !== "admin") { router.push("/login"); return }
      setAuthorized(true)
    }
    check()
  }, [router])

  if (!authorized) return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#3D8B7A]/20 border-t-[#3D8B7A] rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#FAF8F5]">
      <aside className="w-56 bg-white border-r border-[#EDE8E1] flex flex-col">
        <div className="p-5 border-b border-[#EDE8E1]">
          <div className="text-xl tracking-tight text-[#2D2A26]">Repa<span className="text-[#3D8B7A]">ro</span></div>
          <div className="text-[10px] font-bold text-[#3D8B7A] uppercase tracking-widest mt-1">Admin Panel</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname === item.href
                  ? "bg-[#3D8B7A]/10 text-[#3D8B7A] border border-[#3D8B7A]/20"
                  : "text-[#6B665E] hover:text-[#2D2A26] hover:bg-[#F5F0EB]"
              }`}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-[#EDE8E1]">
          <button
            onClick={async () => { const s = createClient(); await s.auth.signOut(); router.push("/login") }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#8C857B] hover:text-[#C4574B] transition-colors">
            <span>&#8592;</span>
            Abmelden
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
