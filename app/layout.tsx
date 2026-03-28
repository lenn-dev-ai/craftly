import type { Metadata, Viewport } from "next"
import "./globals.css"
import AdminButton from "@/components/AdminButton"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1D9E75",
}

export const metadata: Metadata = {
  title: {
    default: "Craftly — Verwalter, Handwerker & Mieter verbinden",
    template: "%s | Craftly",
  },
  description: "Die Plattform für Hausverwaltungen: Tickets erstellen, Handwerker per Auktion beauftragen, Kosten sparen. Das Doctolib für die Immobilienwirtschaft.",
  keywords: ["Hausverwaltung", "Handwerker", "Immobilien", "Ticketsystem", "Schadensmeldung", "Auktion"],
  authors: [{ name: "Craftly" }],
  openGraph: {
    title: "Craftly — Verwalter, Handwerker & Mieter verbinden",
    description: "Die Plattform für Hausverwaltungen: Tickets erstellen, Handwerker per Auktion beauftragen, Kosten sparen.",
    type: "website",
    locale: "de_DE",
    siteName: "Craftly",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        {children}
        <AdminButton />
      </body>
    </html>
  )
}
