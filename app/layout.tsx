import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import AdminButton from '@/components/AdminButton'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Reparo — Verwalter, Handwerker & Mieter verbinden',
  description:
    'Die intelligente Plattform für Hausverwaltungen, Handwerker und Mieter. Verwalten Sie Arbeitsaufträge effizient, kommunizieren Sie nahtlos und erhöhen Sie die Kundenzufriedenheit.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Reparo — Verwalter, Handwerker & Mieter verbinden',
    description:
      'Die intelligente Plattform für Hausverwaltungen, Handwerker und Mieter.',
    url: 'https://reparo.app',
    siteName: 'Reparo',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reparo',
    description:
      'Die intelligente Plattform für Hausverwaltungen, Handwerker und Mieter.',
  },
  icons: {
    icon: '/icons/favicon.ico',
    apple: '/icons/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Reparo',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#3D8B7A',
  colorScheme: 'light dark',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="de"
      className={`${inter.variable} ${displayFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Reparo" />
      </head>
      <body className={`${inter.className} antialiased bg-[#FAF8F5] text-[#2D2A26]`}>
        <AdminButton />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}`,
          }}
        />
      </body>
    </html>
  )
}
