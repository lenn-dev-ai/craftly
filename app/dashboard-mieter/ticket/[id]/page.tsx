import TicketDetailView from "@/components/ticket/TicketDetailView"

// Wrapper: rendert den Ticket-Detail-View innerhalb des
// /dashboard-mieter-Layouts (Mieter-Sidebar + RoleGuard).
export default function MieterTicketSeite() {
  return <TicketDetailView />
}
