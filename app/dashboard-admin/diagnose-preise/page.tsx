import { redirect } from "next/navigation"

// Sprint R Phase 22: Diagnose-Preise-Page ist obsolet — Diagnose-
// Aufträge sind aus dem Beta-Scope raus (Feedback 07c7a7af bestätigt
// von Lennart: "Brauchen wir das überhaupt noch?"). Sidebar-Item
// entfernt; Route redirected zum Admin-Dashboard für alte Bookmarks.
//
// Die DB-Tabelle public.diagnose_preise bleibt erhalten — wenn das
// Diagnose-Feature später wieder kommt, kann die Page reaktiviert
// werden. Bis dahin liest lib/diagnose/preise.ts die Werte als
// Fallback für die Vergabe-Logik bei Diagnose-Tickets.
export default function ObsoleteDiagnosePreiseRedirect() {
  redirect("/dashboard-admin")
}
