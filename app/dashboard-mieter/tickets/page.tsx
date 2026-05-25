import { redirect } from "next/navigation"

// Sprint R Phase 11: Mieter-Dashboard und /tickets zeigten die gleichen
// Ticket-Cards — Dashboard übernimmt die komplette Liste (inkl. Hero +
// Vorgang-Cards mit HW+Termin inline aus Sprint E). Diese Route bleibt
// als Redirect erhalten damit Sidebar-Link und alte Bookmarks weiterhin
// landen.
export default function MieterTicketsRedirect() {
  redirect("/dashboard-mieter")
}
