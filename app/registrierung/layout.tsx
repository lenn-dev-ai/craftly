import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Kostenlos registrieren",
  description: "Erstellen Sie kostenlos ein Reparo-Konto als Hausverwaltung, Handwerker oder Mieter. Keine Kreditkarte, keine Mindestlaufzeit, in 2 Minuten startklar.",
  robots: { index: true, follow: true },
}

export default function RegistrierungLayout({ children }: { children: React.ReactNode }) {
  return children
}
