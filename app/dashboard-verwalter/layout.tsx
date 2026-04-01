"use client"
import Sidebar from "@/components/layout/Sidebar"
import AdminButton from "@/components/ui/AdminButton"

export default function VerwalterLayout({ children }: { children: React.ReactNode }) {
    return (
          <div className="flex min-h-screen bg-[#0a0a0f]">
                <Sidebar rolle="verwalter" />
                <main className="flex-1 overflow-auto">{children}</main>main>
                <AdminButton />
          </div>div>
        )
}</div>
