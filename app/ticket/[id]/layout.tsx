import type { Metadata } from "next"
import TicketShell from "@/components/layout/TicketShell"

export const metadata: Metadata = {
  title: "Ticket",
  robots: { index: false, follow: false },
}

export default function TicketLayout({ children }: { children: React.ReactNode }) {
  return <TicketShell>{children}</TicketShell>
}
