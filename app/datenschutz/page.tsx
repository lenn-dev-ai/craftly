import Link from "next/link"

export const metadata = {
  title: "Datenschutz - Reparo",
}

const BETREIBER_NAME = process.env.NEXT_PUBLIC_REPARO_BETREIBER_NAME || "Lennart [DEIN-NACHNAME]"
const BETREIBER_STRASSE = process.env.NEXT_PUBLIC_REPARO_BETREIBER_STRASSE || "[DEINE-STRASSE-UND-NR]"
const BETREIBER_PLZORT = process.env.NEXT_PUBLIC_REPARO_BETREIBER_PLZORT || "[DEINE-PLZ] [DEINE-STADT]"
const KONTAKT_EMAIL = process.env.NEXT_PUBLIC_REPARO_KONTAKT_EMAIL || "[DEINE-EMAIL]"
const LIVE = process.env.NEXT_PUBLIC_REPARO_LIVE_DATA === "true"

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

        {!LIVE && (
          <div className="mb-8 p-4 rounded-xl border-2 border-[#C4956A] bg-[#FAF1DE] text-[#854F0B] text-sm">
            <strong className="block mb-1">Platzhalter-Daten</strong>
            Verantwortliche Stelle und Kontaktdaten enthalten noch eckige Klammern. Vor dem öffentlichen Launch über die Umgebungsvariablen mit echten Daten füllen (DSGVO Art. 13).
          </div>
        )}

        <div className="space-y-8 text-[#6B665E] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">1. Verantwortlicher</h2>
            <p>
              Verantwortlich für die Datenverarbeitung auf dieser Plattform ist:<br />
              {BETREIBER_NAME}<br />
              {BETREIBER_STRASSE}<br />
              {BETREIBER_PLZORT}<br />
              E-Mail: <a href={`mailto:${KONTAKT_EMAIL}`} className="text-[#3D8B7A] hover:underline">{KONTAKT_EMAIL}</a>
            </p>
            <p className="mt-3 text-sm text-[#8C857B]">
              Reparo wird als Einzelperson betrieben. Ein Datenschutzbeauftragter ist gesetzlich nicht erforderlich (Art. 37 DSGVO i.V.m. § 38 BDSG). Anfragen zum Datenschutz richten Sie bitte an die oben genannte E-Mail-Adresse.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">2. Erhebung und Speicherung personenbezogener Daten</h2>
            <p>
              Bei der Nutzung dieser Plattform werden folgende personenbezogene Daten verarbeitet: Name, E-Mail-Adresse, gesetztes Passwort (ausschließlich als Hash), Rolle (Verwalter, Mieter oder Handwerker), bei Verwaltern und Handwerkern zusätzlich die Geschäftsadresse sowie alle im Rahmen der Nutzung eingegebenen Inhalte (Schadensmeldungen, Nachrichten, Foto-Uploads, Angebote, Bewertungen). Diese Daten werden ausschließlich zur Erbringung der Plattform-Dienstleistung verwendet.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">3. Rechtsgrundlage</h2>
            <p>
              Die Verarbeitung personenbezogener Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung bzw. vorvertragliche Maßnahmen) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Bereitstellung, Sicherheit und Verbesserung der Plattform).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">4. Authentifizierung und Datenbank (Supabase)</h2>
            <p>
              Login, Registrierung und alle Anwendungsdaten werden über <strong className="text-[#2D2A26]">Supabase</strong> verarbeitet (Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992; Datenbank-Region EU/Frankfurt). Supabase liefert die E-Mail/Passwort-Authentifizierung, das Versenden der Bestätigungs- und Passwort-Reset-Mails sowie die PostgreSQL-Datenbank, in der alle Anwendungsinhalte gespeichert sind. Es besteht ein Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO.
            </p>
            <p className="mt-3">
              Bei der Anmeldung wird ein verschlüsselter Session-Cookie (HTTP-only) gesetzt, um eingeloggt zu bleiben. Dieser Cookie ist technisch erforderlich und wird beim Abmelden gelöscht.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">5. Hosting (Netlify)</h2>
            <p>
              Diese Plattform wird über <strong className="text-[#2D2A26]">Netlify</strong> ausgeliefert (Netlify, Inc., 44 Montgomery Street, Suite 300, San Francisco, CA 94104, USA). Netlify übernimmt das Hosting der Webseite sowie das globale Content-Delivery (CDN). Beim Aufruf werden technische Verbindungsdaten (IP-Adresse, Zeitpunkt, abgerufene URL, Browser-Typ, Betriebssystem) verarbeitet, die ausschließlich der sicheren Auslieferung und Angriffserkennung dienen. Es besteht ein AVV gemäß Art. 28 DSGVO.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">6. Adress-Autocomplete (Photon)</h2>
            <p>
              Bei der Eingabe einer Adresse während der Registrierung oder beim Anlegen eines Tickets wird die Eingabe an <strong className="text-[#2D2A26]">Photon</strong> übermittelt, einen Open-Source-Geocoding-Dienst der Komoot GmbH (München, Deutschland), um Adressvorschläge zu liefern. Es werden keine Cookies gesetzt und keine Nutzerprofile gebildet.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">7. Übermittlung in Drittländer</h2>
            <p>
              Da Supabase und Netlify Konzerngesellschaften außerhalb der EU haben (USA, Singapur), kann eine Übermittlung personenbezogener Daten in ein Drittland erfolgen. Die Übermittlung wird auf EU-Standardvertragsklauseln gemäß Art. 46 Abs. 2 lit. c DSGVO sowie auf das EU-US Data Privacy Framework gestützt, sofern der jeweilige Anbieter zertifiziert ist.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">8. Cookies (§ 25 TTDSG)</h2>
            <p>
              <strong className="text-[#2D2A26]">Notwendige Cookies:</strong> Diese Plattform verwendet ausschließlich technisch notwendige Cookies für Login-Sitzungen (Supabase Auth) und das Speichern der Cookie-Banner-Einwilligung. Diese sind gemäß § 25 Abs. 2 Nr. 2 TTDSG nicht einwilligungspflichtig.
            </p>
            <p className="mt-3">
              <strong className="text-[#2D2A26]">Optionale Cookies:</strong> Optionale Cookies (z.B. Reichweitenmessung) werden nur nach ausdrücklicher Einwilligung über den Cookie-Banner gesetzt. Die Einwilligung kann jederzeit widerrufen werden, indem die Cookie-Auswahl zurückgesetzt oder die gespeicherten Cookies im Browser gelöscht werden.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">9. Server-Log-Dateien</h2>
            <p>
              Beim Aufruf der Plattform werden technische Daten in den Logs des Hosters (Netlify) erfasst (IP-Adresse, Zeitpunkt, abgerufene URL, Browser-Typ, Betriebssystem). Diese Daten dienen ausschließlich der Sicherheit und Stabilität der Plattform und werden vom Hoster nach kurzer Frist automatisch gelöscht oder anonymisiert. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">10. Speicherdauer</h2>
            <p>
              Personenbezogene Daten werden nur so lange gespeichert, wie es für den jeweiligen Verarbeitungszweck erforderlich ist oder gesetzliche Aufbewahrungsfristen (z.B. § 257 HGB, § 147 AO) dies vorschreiben. Bei Kontolöschung werden Stammdaten innerhalb von 30 Tagen entfernt, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Provisions- und Abrechnungsdaten werden zur Erfüllung steuerlicher Pflichten bis zu 10 Jahre aufbewahrt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">11. Ihre Rechte</h2>
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
              Zur Ausübung Ihrer Rechte wenden Sie sich bitte an{" "}
              <a href={`mailto:${KONTAKT_EMAIL}`} className="text-[#3D8B7A] hover:underline">{KONTAKT_EMAIL}</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">12. Datensicherheit</h2>
            <p>
              Es werden technische und organisatorische Sicherheitsmaßnahmen eingesetzt, um Ihre Daten gegen Manipulation, Verlust oder unberechtigten Zugriff zu schützen. Die Übertragung erfolgt ausschließlich verschlüsselt über HTTPS (TLS 1.2+). Passwörter werden ausschließlich als Hash (bcrypt) bei Supabase gespeichert, sind also auch dem Plattform-Betreiber nicht im Klartext bekannt. Der Datenbankzugriff ist über Row-Level-Security pro Nutzer und Rolle abgesichert.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">13. Beschwerderecht</h2>
            <p>
              Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung Ihrer personenbezogenen Daten zu beschweren. Eine Liste der Aufsichtsbehörden finden Sie unter:{" "}
              <a href="https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html" target="_blank" rel="noopener noreferrer" className="text-[#3D8B7A] hover:underline">
                bfdi.bund.de
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">14. Änderungen dieser Datenschutzerklärung</h2>
            <p>
              Diese Datenschutzerklärung kann an geänderte Rechtsvorgaben oder Funktionsänderungen der Plattform angepasst werden. Es gilt jeweils die hier veröffentlichte aktuelle Fassung.
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
