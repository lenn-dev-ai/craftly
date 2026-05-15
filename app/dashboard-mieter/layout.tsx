import Sidebar from "@/components/layout/Sidebar"
import RoleGuard from "@/components/layout/RoleGuard"

export const metadata = {
  robots: { index: false, follow: false },
}

export default function MieterLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowed="mieter">
      <div className="flex min-h-screen bg-surface">
        <Sidebar rolle="mieter" />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </RoleGuard>
  )
}
