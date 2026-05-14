import TicketDetailView from "@/components/ticket/TicketDetailView"

// Wrapper: rendert den Ticket-Detail-View innerhalb des
// /dashboard-handwerker-Layouts (Handwerker-Sidebar + RoleGuard).
export default function HandwerkerTicketSeite() {
  return <TicketDetailView />
}
