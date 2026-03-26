import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Craftly â Verwalter, Handwerker & Mieter verbinden",
  description: "Das Doctolib fÃ¼r die Immobilienwirtschaft",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
