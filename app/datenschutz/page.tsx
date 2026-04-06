import Link from "next/link"

export const metadata = {
  title: "Datenschutz - Reparo",
}

export default function Datenschutz() {
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
        <h1 className="text-3xl font-bold mb-8">Datenschutzerklärung</h1>

        <div className="space-y-8 text-[#6B665E] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">1. Verantwortlicher</h2>
            <p>
              Verantwortlich für die Datenverarbeitung auf dieser Website ist:<br />
              Reparo GmbH (Platzhalter)<br />
              Musterstrasse 1, 10115 Berlin<br />
              E-Mail: datenschutz@reparo-app.de
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">2. Erhebung und Speicherung personenbezogener Daten</h2>
            <p>
              Bei der Nutzung unserer Plattform erheben wir folgende personenbezogene Daten: Name, E-Mail-Adresse, Rolle (Verwalter, Mieter oder Handwerker) sowie die im Rahmen der Nutzung eingegebenen Inhalte wie Schadensmeldungen und Nachrichten. Diese Daten werden ausschliesslich zur Erbringung unserer Dienstleistung verwendet.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">3. Rechtsgrundlage</h2>
            <p>
              Die Verarbeitung personenbezogener Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Bereitstellung und Verbesserung unserer Dienste).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">4. Datenweitergabe</h2>
            <p>
              Wir geben Ihre Daten nur weiter, soweit dies zur Vertragserfüllung erforderlich ist. Unsere Infrastruktur wird von Supabase (Datenbank) und Netlify (Hosting) bereitgestellt. Eine darüber hinausgehende Weitergabe an Dritte findet nicht statt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">5. Cookies</h2>
            <p>
              Wir verwenden ausschliesslich technisch notwendige Cookies für die Authentifizierung und Sitzungsverwaltung. Tracking-Cookies oder Analyse-Tools von Drittanbietern werden nicht eingesetzt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">6. Ihre Rechte</h2>
            <p>
              Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung Ihrer Daten. Zudem können Sie der Verarbeitung widersprechen und haben ein Recht auf Datenübertragbarkeit. Zur Ausübung Ihrer Rechte wenden Sie sich bitte an datenschutz@reparo-app.de.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">7. Datensicherheit</h2>
            <p>
              Wir setzen technische und organisatorische Sicherheitsmassnahmen ein, um Ihre Daten gegen Manipulation, Verlust oder unberechtigten Zugriff zu schützen. Die Übertragung erfolgt verschlüsselt über HTTPS.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">8. Beschwerderecht</h2>
            <p>
              Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung Ihrer personenbezogenen Daten zu beschweren.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#EDE8E1] flex gap-6 text-sm text-[#8C857B]">
          <Link href="/" className="hover:text-[#2D2A26] transition-colors">Startseite</Link>
          <Link href="/impressum" className="hover:text-[#2D2A26] transition-colors">Impressum</Link>
        </div>
      </main>
    </div>
  )
}
