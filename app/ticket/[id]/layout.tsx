import Sidebar from "@/components/layout/Sidebar"

export default function TicketLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar rolle="verwalter" />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
