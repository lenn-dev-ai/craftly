import { redirect } from "next/navigation"

// Feedback 9337c802 + f88ec0c7: separate Termine-Liste ist mit dem
// Kalender redundant (gleiche Daten, andere Sicht). Sprint B hat die
// Konsolidierung gemacht. Diese Route ist obsolet — Redirect zum
// Kalender erhält Bookmarks.
export default function ObsoleteTermineRedirect() {
  redirect("/dashboard-handwerker/kalender")
}
