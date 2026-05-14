import TicketDetailView from "@/components/ticket/TicketDetailView"

// Wrapper: rendert den Ticket-Detail-View innerhalb des
// /dashboard-admin-Layouts (Admin-Sidebar + ActiveRoleProvider).
export default function AdminTicketSeite() {
  return <TicketDetailView />
}
