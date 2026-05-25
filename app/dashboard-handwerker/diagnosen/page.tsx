import { redirect } from "next/navigation"

// Feedback 9337c802 + 1c0964f1: Diagnose-Aufträge sind via Sprint C
// in normale Aufträge gemerged (ticket_typ="diagnose" + status="auktion",
// erscheinen als normale Ausschreibungen im HW-Dashboard). Separate
// Diagnose-Liste ist obsolet — Redirect zum Dashboard.
export default function ObsoleteDiagnosenRedirect() {
  redirect("/dashboard-handwerker")
}
