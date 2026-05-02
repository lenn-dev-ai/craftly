import Link from "next/link"

export const metadata = {
  title: "Impressum - Reparo",
}

const BETREIBER_NAME = process.env.NEXT_PUBLIC_REPARO_BETREIBER_NAME || "Lennart [DEIN-NACHNAME]"
const BETREIBER_STRASSE = process.env.NEXT_PUBLIC_REPARO_BETREIBER_STRASSE || "[DEINE-STRASSE-UND-NR]"
const BETREIBER_PLZORT = process.env.NEXT_PUBLIC_REPARO_BETREIBER_PLZORT || "[DEINE-PLZ] [DEINE-STADT]"
const KONTAKT_EMAIL = process.env.NEXT_PUBLIC_REPARO_KONTAKT_EMAIL || "[DEINE-EMAIL]"
const KONTAKT_TELEFON = process.env.NEXT_PUBLIC_REPARO_KONTAKT_TELEFON || ""
const LIVE = process.env.NEXT_PUBLIC_REPARO_LIVE_DATA === "true"

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

        {!LIVE && (
          <div className="mb-8 p-4 rounded-xl border-2 border-[#C4956A] bg-[#FAF1DE] text-[#854F0B] text-sm">
            <strong className="block mb-1">Platzhalter-Daten</strong>
            Diese Seite zeigt noch eckige Klammer-Platzhalter. Vor dem öffentlichen Launch müssen Name, Anschrift und E-Mail über die Umgebungsvariablen <code>NEXT_PUBLIC_REPARO_BETREIBER_NAME</code>, <code>_STRASSE</code>, <code>_PLZORT</code> und <code>NEXT_PUBLIC_REPARO_KONTAKT_EMAIL</code> mit den echten Daten gefüllt werden (§ 5 TMG). Anschließend <code>NEXT_PUBLIC_REPARO_LIVE_DATA=true</code> setzen, um diesen Hinweis auszublenden.
          </div>
        )}

        <div className="space-y-6 text-[#6B665E] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Angaben gemäß § 5 TMG</h2>
            <p>
              {BETREIBER_NAME}<br />
              {BETREIBER_STRASSE}<br />
              {BETREIBER_PLZORT}<br />
              Deutschland
            </p>
            <p className="mt-3 text-sm text-[#8C857B]">
              Reparo wird derzeit als Einzelperson betrieben (kein eingetragenes Unternehmen). Daher entfallen Angaben zu Handelsregister, Umsatzsteuer-Identifikationsnummer und Vertretungsberechtigten.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Kontakt</h2>
            <p>
              E-Mail: <a href={`mailto:${KONTAKT_EMAIL}`} className="text-[#3D8B7A] hover:underline">{KONTAKT_EMAIL}</a>
              {KONTAKT_TELEFON && (
                <>
                  <br />
                  Telefon: {KONTAKT_TELEFON}
                </>
              )}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <p>
              {BETREIBER_NAME}<br />
              {BETREIBER_STRASSE}<br />
              {BETREIBER_PLZORT}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Haftung für Inhalte</h2>
            <p>
              Die Inhalte dieser Plattform werden mit größtmöglicher Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden. Als Diensteanbieter bin ich gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG bin ich als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Haftung für Links</h2>
            <p>
              Diese Plattform enthält ggf. Links zu externen Websites Dritter, auf deren Inhalte ich keinen Einfluss habe. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Bei Bekanntwerden von Rechtsverstößen werden derartige Links umgehend entfernt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Urheberrecht</h2>
            <p>
              Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des Verfassers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">Streitschlichtung</h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
              <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-[#3D8B7A] hover:underline">
                ec.europa.eu/consumers/odr
              </a>
              . Meine E-Mail-Adresse finden Sie oben.
            </p>
            <p className="mt-3">
              Ich bin nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 Abs. 1 Nr. 1 VSBG).
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
