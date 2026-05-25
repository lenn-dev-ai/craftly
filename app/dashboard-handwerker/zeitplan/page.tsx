import { redirect } from "next/navigation"

// Legacy-Route. Audit-C2: zeitplan war ein Wrapper um TimetableView,
// /kalender (677 LOC) ist die heutige Kalender-Sicht — keine Dupe-
// Pflege mehr. Redirect erhält alte Bookmarks.
export default function LegacyZeitplanRedirect() {
  redirect("/dashboard-handwerker/kalender")
}
