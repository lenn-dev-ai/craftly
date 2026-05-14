import TicketDetailView from "@/components/ticket/TicketDetailView"

// Wrapper: rendert den Ticket-Detail-View innerhalb des
// /dashboard-verwalter-Layouts (Verwalter-Sidebar + RoleGuard).
export default function VerwalterTicketSeite() {
  return <TicketDetailView />
}
