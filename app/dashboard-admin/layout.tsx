"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"

const NAV_ITEMS = [
  { label: "Uebersicht", href: "/dashboard-admin", icon: "chart" },
  { label: "Nutzer", href: "/dashboard-admin/nutzer", icon: "users" },
  { label: "Aktivitaet", href: "/dashboard-admin/aktivitaet", icon: "trending" },
  { label: "System", href: "/dashboard-admin/system", icon: "settings" },
  ]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const [authorized, setAuthorized] = useState(false)
    const [currentPath, setCurrentPath] = useState("")

  useEffect(() => {
        async function check() {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) { router.push("/login"); return }
                const { data: profile } = await supabase.from("profiles").select("rolle").eq("id", user.id).single()
                if (profile?.rolle !== "admin") { router.push("/login"); return }
                setAuthorized(true)
                setCurrentPath(window.location.pathname)
        }
        check()
  }, [router])

  if (!authorized) return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#00D4AA]/20 border-t-[#00D4AA] rounded-full animate-spin" />
        </div>div>
      )
    
      return (
            <div className="flex min-h-screen bg-[#0a0a0f]">
                  <aside className="w-56 bg-[#12121a] border-r border-white/[0.06] flex flex-col">
                          <div className="p-5 border-b border-white/[0.06]">
                                    <div className="logo text-xl tracking-tight text-white">Craft<span className="text-[#00D4AA]">ly</span>span></div>div>
                                    <div className="text-[10px] font-bold text-[#00D4AA] uppercase tracking-widest mt-1">Admin Panel</div>div>
                          </div>div>
                          <nav className="flex-1 p-3 space-y-1">
                            {NAV_ITEMS.map(item => (
                          <button key={item.href} onClick={() => { router.push(item.href); setCurrentPath(item.href) }}
                                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                                            currentPath === item.href
                                                              ? "bg-[#00D4AA]/10 text-[#00D4AA] border border-[#00D4AA]/20"
                                                              : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                                          }`}>
                                        <span className="text-base">{item.icon === "chart" ? "O" : item.icon === "users" ? "U" : item.icon === "trending" ? "A" : "S"}</span>span>
                            {item.label}
                          </button>button>
                        ))}
                          </nav>nav>
                          <div className="p-3 border-t border-white/[0.06]">
                                    <button onClick={async () => { const s = createClient(); await s.auth.signOut(); router.push("/login") }}
                                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-red-400 transition-colors">
                                                Abmelden
                                    </button>button>
                          </div>div>
                  </aside>aside>
                  <main className="flex-1 overflow-auto">{children}</main>main>
            </div>div>
          )
}</div>
