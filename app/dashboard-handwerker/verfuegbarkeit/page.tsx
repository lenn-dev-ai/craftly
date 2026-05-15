import { redirect } from "next/navigation"

// Legacy-Route. Die granulare Stunden-Verfügbarkeit wurde durch das
// vereinfachte Slot-Picker-UI unter /kalender abgelöst (Morgens/Nachmittags/
// Abends pro Wochentag). Beide schrieben in dieselbe `verfuegbarkeiten`-Tabelle —
// parallele Pflege würde Inkonsistenzen erzeugen. Hier nur noch ein Redirect,
// damit alte Bookmarks und externe Links weiterhin landen.
export default function LegacyVerfuegbarkeitRedirect() {
  redirect("/dashboard-handwerker/kalender")
}
