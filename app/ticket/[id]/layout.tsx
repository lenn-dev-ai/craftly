import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Ticket",
  robots: { index: false, follow: false },
}

// Legacy-Route, leitet auf /dashboard-{rolle}/ticket/[id] um.
// Kein eigenes Layout/Sidebar — die Redirect-Page rendert nur einen Spinner.
export default function TicketLegacyLayout({ children }: { children: React.ReactNode }) {
  return children
}
