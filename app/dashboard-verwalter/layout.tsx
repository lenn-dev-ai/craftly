import Sidebar from "@/components/layout/Sidebar"
import RoleGuard from "@/components/layout/RoleGuard"

export const metadata = {
  robots: { index: false, follow: false },
}

export default function VerwalterLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowed="verwalter">
      <div className="flex min-h-screen bg-[#FAF8F5]">
        <Sidebar rolle="verwalter" />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </RoleGuard>
  )
}
