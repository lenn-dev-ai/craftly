import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "E-Mail bestätigt",
  description: "Ihre E-Mail-Adresse wurde erfolgreich bestätigt.",
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
