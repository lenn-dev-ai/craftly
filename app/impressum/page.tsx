import Link from "next/link"

export const metadata = {
  title: "Impressum - Reparo",
}

export default function Impressum() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2A26]">
      <nav className="border-b border-[#EDE8E1] bg-white">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2 text-[#2D2A26] hover:text-[#3D8B7A] transition-colors">
            <div className="w-7 h-7 rounded-md bg-[#3D8B7A] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="font-semibold">Reparo</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-8">Impressum</h1>

        {process.env.NEXT_PUBLIC_REPARO_LIVE_DATA !== "true" && (
          <div className="mb-8 p-4 rounded-xl border-2 border-[#C4956A] bg-[#FAF1DE] text-[#854F0B] text-sm">
            <strong className="block mb-1">⚠️ Platzhalter-Daten</strong>
            Diese Seite enthält noch Beispieldaten. Vor dem öffentlichen Launch müssen alle mit „Muster“ gekennzeichneten Angaben durch echte Firmendaten ersetzt werden (§ 5 TMG).
          </div>
        )}

        <div className="space-y-6 text-[#6B665E] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Angaben gemäß § 5 TMG</h2>
            <p>
              Reparo GmbH<br />
              Musterstraße 1<br />
              10115 Berlin
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Kontakt</h2>
            <p>
              E-Mail: info@reparo-app.de<br />
              Telefon: +49 (0) 30 123456789
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Vertretungsberechtigte Person</h2>
            <p>Max Mustermann, Geschäftsführer</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Registereintrag</h2>
            <p>
              Handelsregister: Amtsgericht Berlin-Charlottenburg<br />
              Registernummer: HRB 12345 B
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Umsatzsteuer-ID</h2>
            <p>
              Umsatzsteuer-Identifikationsnummer gemäß 27a UStG:<br />
              DE123456789
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Verantwortlich für den Inhalt</h2>
            <p>
              Max Mustermann<br />
              Musterstraße 1<br />
              10115 Berlin
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Haftungsausschluss</h2>
            <p>
              Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Streitschlichtung</h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
              <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-[#3D8B7A] hover:underline">
                ec.europa.eu/consumers/odr
              </a>
              . Unsere E-Mail-Adresse finden Sie oben.
            </p>
            <p className="mt-3">
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 Abs. 1 Nr. 1 VSBG).
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#EDE8E1] flex gap-6 text-sm text-[#8C857B]">
          <Link href="/" className="hover:text-[#2D2A26] transition-colors">Startseite</Link>
          <Link href="/datenschutz" className="hover:text-[#2D2A26] transition-colors">Datenschutz</Link>
        </div>
      </main>
    </div>
  )
}
