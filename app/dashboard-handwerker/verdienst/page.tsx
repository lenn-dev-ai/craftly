import { redirect } from "next/navigation"

// Nav-Konsolidierung (Audit 11.07.): Der statische Verdienst-Rechner ist
// gestrichen; das Stripe-Onboarding (StripeConnectCard) wohnt jetzt auf
// /einnahmen. Route bleibt für alte Bookmarks als Redirect.
export default function VerdienstRedirect() {
  redirect("/dashboard-handwerker/einnahmen")
}
