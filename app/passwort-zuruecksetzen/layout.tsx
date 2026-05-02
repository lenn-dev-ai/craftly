import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Neues Passwort festlegen",
  description: "Legen Sie ein neues Passwort für Ihr Reparo-Konto fest.",
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
