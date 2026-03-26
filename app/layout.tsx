import type { Metadata } from "next"
import "./globals.css"
import AdminButton from "@/components/AdminButton"

export const metadata: Metadata = {
  title: "Craftly â Verwalter, Handwerker & Mieter verbinden",
  description: "Das Doctolib fÃ¼r die Immobilienwirtschaft",
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
