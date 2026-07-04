import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Anmelden",
  description: "Melden Sie sich bei Reparo an, um Schadensmeldungen zu erstellen, Aufträge zu vergeben oder den Status Ihrer Tickets zu verfolgen.",
  // Login-Seiten gehören nicht in den Suchindex (kein SEO-Wert, dünner Inhalt).
  robots: { index: false, follow: true },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
