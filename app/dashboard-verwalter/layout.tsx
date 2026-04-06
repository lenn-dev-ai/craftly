import Sidebar from "@/components/layout/Sidebar"

export default function VerwalterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#FAF8F5]">
      <Sidebar rolle="verwalter" />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
