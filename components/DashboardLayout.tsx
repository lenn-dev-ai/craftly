import Navigation from "./Navigation"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-[#0a0a0f] pb-20 md:pb-0">
        {children}
      </main>
    </>
  )
}
