import { redirect } from "next/navigation"

// Redirect-Route: /dashboard-verwalter/tickets/[id] (Plural) existierte nie
// als Seite, wurde aber von Marktplatz + E-Mail-Templates verlinkt → 404
// ("Die Seite geht nicht", Beta-Feedback 2026-06-25). Die Links sind auf
// /dashboard-verwalter/ticket/[id] (Singular) korrigiert; dieser Redirect
// fängt bereits verschickte alte E-Mail-Links dauerhaft ab.

export default function TicketsPluralRedirect({ params }: { params: { id: string } }) {
  redirect(`/dashboard-verwalter/ticket/${params.id}`)
}
