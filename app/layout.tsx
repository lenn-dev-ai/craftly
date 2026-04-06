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
  title: {
    default: 'Reparo - Intelligente Immobilienverwaltung',
    template: '%s | Reparo',
  },
  description:
    'Die intelligente Plattform für Hausverwaltungen, Handwerker und Mieter. Schadensmeldungen, Auftragsvergabe und Kommunikation - alles an einem Ort.',
  keywords: [
    'Hausverwaltung',
    'Schadensmeldung',
    'Immobilienverwaltung',
    'Handwerker',
    'Mieter',
    'Property Management',
    'Facility Management',
    'Reparatur',
    'Wartung',
  ],
  authors: [{ name: 'Reparo' }],
  creator: 'Reparo',
  publisher: 'Reparo',
  metadataBase: new URL('https://reparo.app'),
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Reparo - Intelligente Immobilienverwaltung',
    description:
      'Schadensmeldungen, Auftragsvergabe und Kommunikation - alles an einem Ort. Für Verwalter, Handwerker und Mieter.',
    url: 'https://reparo.app',
    siteName: 'Reparo',
    type: 'website',
    locale: 'de_DE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reparo - Intelligente Immobilienverwaltung',
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Reparo',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Intelligente Plattform für Schadensmeldungen, Auftragsvergabe und Kommunikation in der Immobilienverwaltung.',
  url: 'https://reparo.app',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
  },
  author: {
    '@type': 'Organization',
    name: 'Reparo',
    url: 'https://reparo.app',
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
