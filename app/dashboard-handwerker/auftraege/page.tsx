import { redirect } from "next/navigation"

// Nav-Konsolidierung (Audit 11.07.): "Meine Aufträge" war eine redundante
// Listen-Sicht — Termine + laufende Aufträge leben im Kalender (Layer) und
// auf dem Dashboard. Route bleibt für alte Bookmarks als Redirect.
export default function AuftraegeRedirect() {
  redirect("/dashboard-handwerker/kalender")
}
