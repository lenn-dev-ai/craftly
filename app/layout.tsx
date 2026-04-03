import type { Metadata, Viewport } from "next"
import "./globals.css"
import AdminButton from "@/components/AdminButton"
import Script from "next/script"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00D4AA",
}

export const metadata: Metadata = {
  title: {
    default: "Reparo — Verwalter, Handwerker & Mieter verbinden",
    template: "%s | Reparo",
  },
  description:
    "Die Plattform für Hausverwaltungen: Tickets erstellen, Handwerker per Auktion beauftragen, Kosten sparen. Das Doctolib für die Immobilienwirtschaft.",
  keywords: [
    "Hausverwaltung",
    "Handwerker",
    "Immobilien",
    "Ticketsystem",
    "Schadensmeldung",
    "Auktion",
  ],
  authors: [{ name: "Reparo" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Reparo",
  },
  openGraph: {
    title: "Reparo — Verwalter, Handwerker & Mieter verbinden",
    description:
      "Die Plattform für Hausverwaltungen: Tickets erstellen, Handwerker per Auktion beauftragen, Kosten sparen.",
    type: "website",
    locale: "de_DE",
    siteName: "Reparo",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
        <AdminButton />
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.register("/sw.js").catch(() => {});
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
