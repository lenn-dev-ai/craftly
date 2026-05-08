import Link from "next/link"

export const metadata = {
  title: "Allgemeine Geschäftsbedingungen - Reparo",
  description:
    "Allgemeine Geschäftsbedingungen für die Nutzung der Reparo-Plattform durch Hausverwaltungen, Handwerksbetriebe und Mieter.",
}

const BETREIBER_NAME = process.env.NEXT_PUBLIC_REPARO_BETREIBER_NAME || "Lennart [DEIN-NACHNAME]"
const BETREIBER_STRASSE = process.env.NEXT_PUBLIC_REPARO_BETREIBER_STRASSE || "[DEINE-STRASSE-UND-NR]"
const BETREIBER_PLZORT = process.env.NEXT_PUBLIC_REPARO_BETREIBER_PLZORT || "[DEINE-PLZ] [DEINE-STADT]"
const KONTAKT_EMAIL = process.env.NEXT_PUBLIC_REPARO_KONTAKT_EMAIL || "[DEINE-EMAIL]"
const LIVE = process.env.NEXT_PUBLIC_REPARO_LIVE_DATA === "true"

const STAND = "Mai 2026"

export default function AGB() {
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
        <h1 className="text-3xl font-bold mb-2">Allgemeine Geschäftsbedingungen</h1>
        <p className="text-sm text-[#8C857B] mb-8">Stand: {STAND}</p>

        {!LIVE && (
          <div className="mb-8 p-4 rounded-xl border-2 border-[#C4956A] bg-[#FAF1DE] text-[#854F0B] text-sm">
            <strong className="block mb-1">Hinweis: Vorlagen-Text</strong>
            Diese AGB sind eine Arbeitsvorlage für eine als Einzelperson betriebene Vermittlungs-Plattform und enthalten teils Platzhalter (Name/Anschrift via Umgebungsvariablen). Vor dem öffentlichen Launch und vor produktivem Vertragsschluss sollten die AGB durch eine Rechtsanwältin oder einen Rechtsanwalt geprüft werden. Bei Aktivierung von <code>NEXT_PUBLIC_REPARO_LIVE_DATA=true</code> verschwindet dieser Hinweis.
          </div>
        )}

        <div className="space-y-8 text-[#6B665E] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">§ 1 Geltungsbereich und Vertragspartner</h2>
            <p>
              (1) Diese Allgemeinen Geschäftsbedingungen (nachfolgend „AGB“) regeln die Nutzung der unter <a href="https://reparo-app.netlify.app" className="text-[#3D8B7A] hover:underline">reparo-app.netlify.app</a> betriebenen Online-Plattform (nachfolgend „Plattform“ oder „Reparo“) durch registrierte Nutzer.
            </p>
            <p className="mt-3">
              (2) Anbieter der Plattform und Vertragspartner ist {BETREIBER_NAME}, {BETREIBER_STRASSE}, {BETREIBER_PLZORT} (nachfolgend „Anbieter“). Kontakt: <a href={`mailto:${KONTAKT_EMAIL}`} className="text-[#3D8B7A] hover:underline">{KONTAKT_EMAIL}</a>.
            </p>
            <p className="mt-3">
              (3) Abweichende, entgegenstehende oder ergänzende Allgemeine Geschäftsbedingungen der Nutzer werden nur dann Vertragsbestandteil, wenn der Anbieter ihrer Geltung ausdrücklich schriftlich zugestimmt hat.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">§ 2 Definitionen</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li><strong className="text-[#2D2A26]">Verwalter:</strong> Hausverwaltung oder Eigentümer, die über die Plattform Aufträge an Handwerksbetriebe vergeben.</li>
              <li><strong className="text-[#2D2A26]">Handwerker:</strong> Selbständige Handwerksbetriebe, die über die Plattform Angebote auf ausgeschriebene Aufträge abgeben.</li>
              <li><strong className="text-[#2D2A26]">Mieter:</strong> Bewohner von Mieteinheiten, die über die Plattform Schadensmeldungen an ihre Hausverwaltung übermitteln.</li>
              <li><strong className="text-[#2D2A26]">Auftrag:</strong> Eine vom Verwalter eingestellte Anfrage zur Ausführung von Handwerksleistungen.</li>
              <li><strong className="text-[#2D2A26]">Auktion:</strong> Ein zeitlich begrenzter Vorgang, bei dem mehrere Handwerker auf einen Auftrag bieten können.</li>
              <li><strong className="text-[#2D2A26]">Werkvertrag:</strong> Der zwischen Verwalter und Handwerker nach Auftragsvergabe entstehende Vertrag.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">§ 3 Leistungen des Anbieters</h2>
            <p>
              (1) Reparo ist eine Vermittlungsplattform. Der Anbieter stellt die technische Infrastruktur zur Verfügung, über die Verwalter Aufträge ausschreiben und Handwerker Angebote abgeben können. Der Anbieter wird selbst nicht Vertragspartner der zwischen Verwalter und Handwerker geschlossenen Werkverträge.
            </p>
            <p className="mt-3">
              (2) Der Anbieter haftet nicht für die ordnungsgemäße Ausführung der vermittelten Leistungen. Streitigkeiten aus dem Werkvertrag sind ausschließlich zwischen Verwalter und Handwerker zu klären.
            </p>
            <p className="mt-3">
              (3) Der Anbieter behält sich vor, Inhalte zu prüfen und bei Verstößen gegen diese AGB oder geltendes Recht zu entfernen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">§ 4 Registrierung und Nutzerkonto</h2>
            <p>
              (1) Die Nutzung der Plattform setzt eine kostenlose Registrierung voraus. Die Angabe wahrheitsgemäßer Daten ist Voraussetzung. Verwalter und Handwerker registrieren sich als Gewerbetreibende bzw. Selbständige.
            </p>
            <p className="mt-3">
              (2) Jeder Nutzer ist verpflichtet, seine Zugangsdaten geheim zu halten und nicht an Dritte weiterzugeben. Bei Verdacht auf Missbrauch ist der Anbieter unverzüglich zu informieren.
            </p>
            <p className="mt-3">
              (3) Der Anbieter kann Nutzerkonten bei wiederholten oder schwerwiegenden Verstößen gegen diese AGB sperren oder löschen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">§ 5 Provisionsregelung</h2>
            <p>
              (1) Bei erfolgreicher Vermittlung eines Auftrags zwischen Verwalter und Handwerker fällt eine Vermittlungsprovision an. Diese wird ausschließlich vom <strong className="text-[#2D2A26]">Verwalter</strong> getragen; für Handwerker und Mieter ist die Nutzung kostenfrei.
            </p>
            <p className="mt-3">
              (2) Die Standard-Provision beträgt <strong className="text-[#2D2A26]">5 % netto auf den Auftragswert</strong>. Sie wird zum Zeitpunkt der Auftragsvergabe rechnerisch ermittelt und in einem Audit-Trail (Provisions-Snapshot) dauerhaft gespeichert.
            </p>
            <p className="mt-3">
              (3) Bei kurzfristigen Aufträgen kann ein Aufschlag („Surge“) auf die Standardprovision anfallen:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong className="text-[#2D2A26]">Notfall</strong> (sofortige Vermittlung): + 20 % auf die Provision (effektiv 6 %)</li>
              <li><strong className="text-[#2D2A26]">Zeitnah</strong> (48-Stunden-Auktion): + 10 % auf die Provision (effektiv 5,5 %)</li>
              <li><strong className="text-[#2D2A26]">Planbar</strong> (Standard-Auktion): kein Aufschlag (5 %)</li>
            </ul>
            <p className="mt-3">
              (4) Verwalter, deren Konto vor dem auf dem Profil hinterlegten Datum „early_adopter_bis“ registriert wurde, zahlen für einen begrenzten Zeitraum von <strong className="text-[#2D2A26]">90 Tagen ab Registrierung</strong> keine Provision (0 %). Der Aufschlag nach Absatz 3 entfällt während dieses Zeitraums.
            </p>
            <p className="mt-3">
              (5) Die Provisions-Höhe wird dem Verwalter in der Plattform vor jeder Auftragsvergabe transparent angezeigt. Mit der Bestätigung der Vergabe akzeptiert der Verwalter die anfallende Provision.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">§ 6 Pflichten der Nutzer</h2>
            <p>(1) Verwalter verpflichten sich, Aufträge wahrheitsgemäß zu beschreiben und die für die Ausführung relevanten Informationen (Adresse, Gewerk, Dringlichkeit) korrekt anzugeben.</p>
            <p className="mt-3">(2) Handwerker verpflichten sich, abgegebene Angebote im Rahmen ihrer tatsächlichen Verfügbarkeit zu kalkulieren und die zugesicherten Termine einzuhalten. Erforderliche behördliche Erlaubnisse (z.B. Handwerksrolle) sind vorzuhalten.</p>
            <p className="mt-3">(3) Mieter verpflichten sich, Schadensmeldungen wahrheitsgemäß zu erstellen. Beleidigende, diskriminierende oder rechtswidrige Inhalte sind untersagt.</p>
            <p className="mt-3">(4) Eine missbräuchliche Nutzung der Plattform — insbesondere die Umgehung der Provision durch Direkt-Kontakt nach Vermittlung — stellt einen Verstoß gegen diese AGB dar und kann Schadensersatzansprüche auslösen.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">§ 7 Bewertungssystem</h2>
            <p>(1) Mieter und Verwalter können Handwerker nach Auftragserledigung mit 1 bis 5 Sternen sowie einem Kommentar bewerten.</p>
            <p className="mt-3">(2) Bewertungen müssen wahrheitsgemäß und sachlich sein. Beleidigende oder unwahre Bewertungen kann der Anbieter nach Prüfung entfernen.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">§ 8 Haftung</h2>
            <p>(1) Der Anbieter haftet unbeschränkt nur bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper und Gesundheit.</p>
            <p className="mt-3">(2) Bei einfacher Fahrlässigkeit haftet der Anbieter nur für die Verletzung wesentlicher Vertragspflichten (Kardinalpflichten); die Haftung ist auf den vorhersehbaren, vertragstypischen Schaden begrenzt.</p>
            <p className="mt-3">(3) Eine Haftung des Anbieters für die Qualität der vermittelten Handwerksleistungen ist ausgeschlossen. Der Werkvertrag besteht ausschließlich zwischen Verwalter und Handwerker.</p>
            <p className="mt-3">(4) Die Plattform wird mit größtmöglicher Sorgfalt betrieben. Der Anbieter übernimmt jedoch keine Gewähr für ununterbrochene Verfügbarkeit; angemessene Wartungsfenster sind zulässig.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">§ 9 Datenschutz</h2>
            <p>
              Der Schutz personenbezogener Daten ist dem Anbieter wichtig. Einzelheiten zur Verarbeitung sind in der{" "}
              <Link href="/datenschutz" className="text-[#3D8B7A] hover:underline">Datenschutzerklärung</Link> geregelt.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">§ 10 Vertragslaufzeit und Kündigung</h2>
            <p>(1) Das Nutzungsverhältnis wird auf unbestimmte Zeit geschlossen und kann von beiden Seiten jederzeit ohne Angabe von Gründen mit einer Frist von 14 Tagen gekündigt werden. Die Kündigung erfolgt durch Löschung des Nutzerkontos oder per E-Mail an die oben genannte Adresse.</p>
            <p className="mt-3">(2) Bereits angefallene Provisionen aus vermittelten Aufträgen bleiben von einer Kündigung unberührt.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">§ 11 Streitbeilegung</h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
              <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-[#3D8B7A] hover:underline">
                ec.europa.eu/consumers/odr
              </a>
              .
            </p>
            <p className="mt-3">
              Der Anbieter ist nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 Abs. 1 Nr. 1 VSBG).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2D2A26] mb-2">§ 12 Schlussbestimmungen</h2>
            <p>(1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.</p>
            <p className="mt-3">(2) Erfüllungsort und ausschließlicher Gerichtsstand für sämtliche Streitigkeiten aus diesem Vertragsverhältnis mit Kaufleuten, juristischen Personen des öffentlichen Rechts oder öffentlich-rechtlichem Sondervermögen ist der Wohnsitz des Anbieters, soweit gesetzlich zulässig.</p>
            <p className="mt-3">(3) Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, so berührt dies nicht die Wirksamkeit der übrigen Bestimmungen. An die Stelle der unwirksamen Bestimmung tritt eine Regelung, die dem wirtschaftlichen Zweck am nächsten kommt.</p>
            <p className="mt-3">(4) Der Anbieter behält sich vor, diese AGB anzupassen. Wesentliche Änderungen werden den Nutzern mit angemessener Frist per E-Mail angekündigt; widerspricht der Nutzer nicht innerhalb von vier Wochen, gelten die geänderten AGB als angenommen.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-[#EDE8E1] flex gap-6 text-sm text-[#8C857B]">
          <Link href="/" className="hover:text-[#2D2A26] transition-colors">Startseite</Link>
          <Link href="/impressum" className="hover:text-[#2D2A26] transition-colors">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-[#2D2A26] transition-colors">Datenschutz</Link>
        </div>
      </main>
    </div>
  )
}
