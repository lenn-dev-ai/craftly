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

        {process.env.NEXT_PUBLIC_REPARO_LIVE_DATA !== "true" && (
          <div className="mb-8 p-4 rounded-xl border-2 border-[#C4956A] bg-[#FAF1DE] text-[#854F0B] text-sm">
            <strong className="block mb-1">⚠️ Platzhalter-Daten</strong>
            Verantwortliche Stelle und Kontaktdaten sind noch Beispiele. Vor dem öffentlichen Launch müssen sie durch echte Angaben ersetzt werden (DSGVO Art. 13).
          </div>
        )}

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
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">4. Auftragsverarbeitung und externe Dienste</h2>
            <p>
              Zur Bereitstellung unserer Plattform setzen wir folgende Dienstleister ein, mit denen jeweils ein Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO besteht:
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1.5">
              <li>
                <strong className="text-[#2D2A26]">Supabase Inc.</strong> (Datenbank &amp; Authentifizierung) - betrieben in den USA. Server-Region für unsere Daten: EU (Frankfurt).
              </li>
              <li>
                <strong className="text-[#2D2A26]">Netlify Inc.</strong> (Hosting &amp; Content-Delivery) - betrieben in den USA mit globalem CDN.
              </li>
              <li>
                <strong className="text-[#2D2A26]">Mapbox Inc.</strong> (Karten- und Geocoding-Dienste, sofern verwendet) - betrieben in den USA. Bei der Nutzung der Adress-Suche wird Ihre Eingabe an Mapbox übermittelt.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">5. Übermittlung in Drittländer</h2>
            <p>
              Da unsere Dienstleister teilweise in den USA sitzen, kann eine Übermittlung personenbezogener Daten in ein Drittland erfolgen. Wir stützen uns dabei auf EU-Standardvertragsklauseln gemäß Art. 46 Abs. 2 lit. c DSGVO sowie auf das EU-US Data Privacy Framework, sofern der jeweilige Anbieter zertifiziert ist. Eine Datenübermittlung erfolgt nur in dem Umfang, der zur Erbringung unserer Dienste erforderlich ist.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">6. Cookies (§ 25 TTDSG)</h2>
            <p>
              <strong className="text-[#2D2A26]">Notwendige Cookies:</strong> Wir verwenden technisch notwendige Cookies für Login-Sitzungen und Sicherheitsfunktionen. Diese sind gemäß § 25 Abs. 2 Nr. 2 TTDSG nicht einwilligungspflichtig.
            </p>
            <p className="mt-3">
              <strong className="text-[#2D2A26]">Optionale Cookies:</strong> Wir setzen optionale Cookies (z.B. zur Reichweitenmessung) nur nach ausdrücklicher Einwilligung über unseren Cookie-Banner. Die Einwilligung kann jederzeit widerrufen werden, indem Sie Ihre Cookie-Auswahl zurücksetzen oder die gespeicherten Cookies in Ihrem Browser löschen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">7. Server-Log-Dateien</h2>
            <p>
              Beim Aufruf unserer Website werden technische Daten in Server-Logs erfasst (IP-Adresse, Zeitpunkt, abgerufene URL, Browser-Typ, Betriebssystem). Diese Daten dienen ausschließlich der Sicherheit und Stabilität unserer Plattform und werden spätestens nach 30 Tagen automatisch gelöscht oder anonymisiert. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">8. Speicherdauer</h2>
            <p>
              Wir speichern personenbezogene Daten nur so lange, wie es für den jeweiligen Verarbeitungszweck erforderlich ist oder gesetzliche Aufbewahrungsfristen (z.B. § 257 HGB, § 147 AO - bis zu 10 Jahre für steuerlich relevante Daten) dies vorschreiben. Nach Wegfall des Zwecks werden die Daten gelöscht oder pseudonymisiert. Bei Kontolöschung werden Stammdaten innerhalb von 30 Tagen entfernt, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">9. Ihre Rechte</h2>
            <p>Als betroffene Person stehen Ihnen folgende Rechte zu:</p>
            <ul className="list-disc pl-5 mt-3 space-y-1">
              <li>Auskunft über Ihre gespeicherten Daten (Art. 15 DSGVO)</li>
              <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
              <li>Löschung Ihrer Daten (Art. 17 DSGVO)</li>
              <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
              <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
              <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
              <li>Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)</li>
              <li>Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
            </ul>
            <p className="mt-3">
              Zur Ausübung Ihrer Rechte wenden Sie sich bitte an datenschutz@reparo-app.de.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">10. Datensicherheit</h2>
            <p>
              Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre Daten gegen Manipulation, Verlust oder unberechtigten Zugriff zu schützen. Die Übertragung erfolgt ausschließlich verschlüsselt über HTTPS (TLS 1.2+). Passwörter werden ausschließlich als Hash gespeichert.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">11. Beschwerderecht</h2>
            <p>
              Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung Ihrer personenbezogenen Daten zu beschweren. Eine Liste der Aufsichtsbehörden finden Sie unter:{" "}
              <a href="https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html" target="_blank" rel="noopener noreferrer" className="text-[#3D8B7A] hover:underline">
                bfdi.bund.de
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">12. Änderungen dieser Datenschutzerklärung</h2>
            <p>
              Wir behalten uns vor, diese Datenschutzerklärung an geänderte Rechtsvorgaben oder Funktionsänderungen unserer Plattform anzupassen. Es gilt jeweils die hier veröffentlichte aktuelle Fassung.
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
