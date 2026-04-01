import Sidebar from "@/components/layout/Sidebar"

export default function HandwerkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar rolle="handwerker" />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
