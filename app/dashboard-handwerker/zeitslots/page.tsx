import { redirect } from "next/navigation"

// Feedback 9337c802 + 5db8c0e2 + 25592383 (Cowork-Iteration 11/22):
// Sprint B hat Slot + Verfügbarkeit in den Kalender konsolidiert.
// Diese Route ist obsolet. Redirect statt 410 weil Bookmarks /
// alte Links sonst ins Leere laufen.
export default function ObsoleteZeitslotsRedirect() {
  redirect("/dashboard-handwerker/kalender")
}
