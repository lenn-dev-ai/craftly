import Sidebar from "@/components/layout/Sidebar"
import BottomNav from "@/components/layout/BottomNav"
import RoleGuard from "@/components/layout/RoleGuard"

export const metadata = {
  robots: { index: false, follow: false },
}

export default function MieterLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowed="mieter">
      <div className="flex min-h-screen bg-surface">
        <Sidebar rolle="mieter" />
        {/* pb-16 md:pb-0: Platz für die mobile BottomNav (h~56px) */}
        <main id="main-content" className="flex-1 overflow-auto overflow-x-hidden min-w-0 pb-16 md:pb-0">{children}</main>
        <BottomNav rolle="mieter" />
      </div>
    </RoleGuard>
  )
}
