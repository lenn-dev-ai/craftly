// /dashboard-admin/mission-control wurde zur Default-Admin-Page (siehe
// app/dashboard-admin/page.tsx). Diese alte Sub-Route redirected darauf,
// damit alte Bookmarks weiter funktionieren.

import { redirect } from "next/navigation"

export default function MissionControlRedirect() {
  redirect("/dashboard-admin")
}
