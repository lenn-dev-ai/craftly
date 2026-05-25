import Sidebar from "@/components/layout/Sidebar"
import BottomNav from "@/components/layout/BottomNav"
import RoleGuard from "@/components/layout/RoleGuard"

export const metadata = {
  robots: { index: false, follow: false },
}

export default function VerwalterLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowed="verwalter">
      <div className="flex min-h-screen bg-surface">
        <Sidebar rolle="verwalter" />
        <main id="main-content" className="flex-1 overflow-auto overflow-x-hidden min-w-0 pb-16 md:pb-0">{children}</main>
        <BottomNav rolle="verwalter" />
      </div>
    </RoleGuard>
  )
}
