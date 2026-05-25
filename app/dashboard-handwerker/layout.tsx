import Sidebar from "@/components/layout/Sidebar"
import BottomNav from "@/components/layout/BottomNav"
import RoleGuard from "@/components/layout/RoleGuard"

export const metadata = {
  robots: { index: false, follow: false },
}

export default function HandwerkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowed="handwerker">
      <div className="flex min-h-screen bg-surface">
        <Sidebar rolle="handwerker" />
        <main id="main-content" className="flex-1 overflow-auto overflow-x-hidden min-w-0 pb-16 md:pb-0">{children}</main>
        <BottomNav rolle="handwerker" />
      </div>
    </RoleGuard>
  )
}
