import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Passwort zurücksetzen",
  description: "Passwort für Ihr Reparo-Konto zurücksetzen. Wir senden Ihnen einen sicheren Link per E-Mail.",
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
