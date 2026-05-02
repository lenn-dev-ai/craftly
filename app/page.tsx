import Link from "next/link"
import Faq from "@/components/landing/Faq"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2A26]">
      <Nav />
      <Hero />
      <Auktion4Schritte />
      <MechanikVorteile />
      <HandwerkerSection />
      <VerwalterSection />
      <MieterSection />
      <KIAutomation />
      <BeispielSzenarien />
      <VertrauensSiegel />
      <FaqSection />
      <DualCTA />
      <Footer />
    </div>
  )
}

/* ---------------------------------------------------------------- NAV */

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FAF8F5]/95 backdrop-blur-sm border-b border-[#EDE8E1]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#3D8B7A] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <span className="text-xl font-semibold tracking-tight">Reparo</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm py-3 px-3 text-[#6B665E] hover:text-[#2D2A26] transition-colors">
            Anmelden
          </Link>
          <Link href="/registrierung" className="text-sm px-4 py-3 bg-[#3D8B7A] text-white rounded-lg hover:bg-[#2D6B5A] transition-colors font-medium">
            Kostenlos starten
          </Link>
        </div>
      </div>
    </nav>
  )
}

/* --------------------------------------------------------------- HERO */

function Hero() {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#3D8B7A]/10 text-[#3D8B7A] rounded-full text-sm font-medium mb-8">
          <span className="w-1.5 h-1.5 bg-[#3D8B7A] rounded-full" />
          Die erste Stundenauktion für Immobilien
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
          Mehr verdienen.
          <br />
          <span className="text-[#3D8B7A]">Weniger suchen.</span>
        </h1>

        <p className="text-lg sm:text-xl text-[#6B665E] max-w-2xl mx-auto mb-10 leading-relaxed">
          Reparo füllt deinen Kalender automatisch mit Aufträgen in deiner Nähe — zu fairen Marktpreisen.
          Verwalter bieten auf deine Stunden. Du arbeitest, wir organisieren.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/registrierung" className="w-full sm:w-auto px-8 py-3.5 bg-[#3D8B7A] text-white rounded-xl hover:bg-[#2D6B5A] transition-colors font-semibold text-base shadow-sm">
            Kostenlos als Handwerker starten
          </Link>
          <Link href="/registrierung" className="w-full sm:w-auto px-8 py-3.5 border border-[#EDE8E1] text-[#2D2A26] rounded-xl hover:bg-white transition-colors font-medium text-base">
            Ich bin Verwalter
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-[#8C857B] text-sm mt-10">
          <div className="flex items-center gap-2">
            <Check />
            Keine Einrichtungsgebühr
          </div>
          <div className="flex items-center gap-2">
            <Shield />
            DSGVO-konform
          </div>
          <div className="flex items-center gap-2">
            <Clock />
            In 5 Minuten startklar
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------- 4-SCHRITT AUKTIONS-FLOW */

function Auktion4Schritte() {
  const schritte = [
    {
      nr: 1,
      titel: "Schaden wird gemeldet",
      text: "Mieter fotografiert, KI kategorisiert automatisch (Gewerk, Dringlichkeit, geschätzter Aufwand).",
      icon: <IconAlert />,
      farbe: "#D4A24E",
    },
    {
      nr: 2,
      titel: "Passende Handwerker werden gefunden",
      text: "System filtert nach Gewerk, Nähe und Verfügbarkeit — nur die wirklich passenden Profis sehen den Auftrag.",
      icon: <IconSearch />,
      farbe: "#C4956A",
    },
    {
      nr: 3,
      titel: "Verwalter vergibt per Auktion",
      text: "Stundensatz wird geboten. Der beste Mix aus Preis, Nähe und Bewertung gewinnt — keine Telefon­runde nötig.",
      icon: <IconAuction />,
      farbe: "#3D8B7A",
    },
    {
      nr: 4,
      titel: "Auftrag landet im Kalender",
      text: "Handwerker bekommt den Termin direkt eingetragen, Mieter ein konkretes Zeitfenster, Verwalter behält den Überblick.",
      icon: <IconCalendar />,
      farbe: "#2D6B5A",
    },
  ]

  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">So funktioniert die Stundenauktion</h2>
          <p className="text-[#6B665E] text-lg max-w-2xl mx-auto">
            Vier Schritte vom Schaden zum erledigten Auftrag — automatisch, fair, schnell.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connecting line — nur auf lg */}
          <div className="hidden lg:block absolute top-6 left-[12.5%] right-[12.5%] h-0.5 bg-[#EDE8E1]" />

          {schritte.map(s => (
            <div key={s.nr} className="text-center">
              <div
                className="w-12 h-12 rounded-full text-white flex items-center justify-center mx-auto mb-6 text-lg font-bold relative z-10"
                style={{ background: s.farbe }}
              >
                {s.nr}
              </div>
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ background: `${s.farbe}1A` }}
              >
                <span style={{ color: s.farbe }}>{s.icon}</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{s.titel}</h3>
              <p className="text-sm text-[#6B665E] leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------- MECHANIK-VORTEILE (statt Fake-KPIs) */

function MechanikVorteile() {
  const vorteile = [
    {
      titel: "Keine Leerlaufzeiten",
      text: "Lücken im Kalender werden automatisch mit passenden Aufträgen aus der Nähe gefüllt.",
      icon: <IconCalendar />,
    },
    {
      titel: "Null Akquise-Aufwand",
      text: "Kein Bewerbungs-Schreiben, keine Telefon­runden. Das System bringt den Auftrag zu dir.",
      icon: <IconBolt />,
    },
    {
      titel: "Bewertungssystem in beide Richtungen",
      text: "Schlechte Auftraggeber fallen auf, gute Handwerker steigen im Ranking — fair für alle.",
      icon: <IconStar />,
    },
    {
      titel: "Automatisch vergeben",
      text: "KI-Matching nach Preis, Nähe und Verfügbarkeit. Kein manuelles Sortieren, keine Fehler.",
      icon: <IconShuffle />,
    },
  ]
  return (
    <section className="py-16 px-6 bg-white border-t border-[#EDE8E1]">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {vorteile.map(v => (
            <div key={v.titel} className="text-center">
              <div className="w-12 h-12 rounded-xl bg-[#3D8B7A]/10 text-[#3D8B7A] flex items-center justify-center mx-auto mb-4">
                {v.icon}
              </div>
              <h3 className="text-base font-semibold mb-1.5">{v.titel}</h3>
              <p className="text-sm text-[#6B665E] leading-relaxed">{v.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------- HANDWERKER (du-Form) */

function HandwerkerSection() {
  const punkte = [
    {
      titel: "Dein Mindestpreis, deine Regeln",
      text: "Du bestimmst den Stundensatz, unter dem du nicht arbeitest. Aufträge unter deiner Untergrenze siehst du gar nicht erst — kein Preisdumping.",
    },
    {
      titel: "Keine Bewerbungen, keine Angebote schreiben",
      text: "Profil einmal anlegen, Verfügbarkeit pflegen, fertig. Die KI matched automatisch — du wirst ausgewählt, nicht umgekehrt.",
    },
    {
      titel: "Je näher, desto besser",
      text: "Aufträge in deiner Nähe werden bevorzugt. Weniger Fahrzeit = mehr Netto pro Tag. Distanz und Fahrzeit fließen sichtbar ins Matching ein.",
    },
    {
      titel: "Bewertungen, die wirklich zählen",
      text: "Gute Arbeit = höheres Ranking = mehr Aufträge. Schlechte Auftraggeber fallen genauso auf wie schlechte Handwerker — Bewertungen gehen in beide Richtungen.",
    },
  ]
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-block px-3 py-1 bg-[#C4956A]/10 text-[#C4956A] text-sm font-medium rounded-full mb-4">
              Für Handwerker
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              Dein Kalender, immer voll.<br />
              <span className="text-[#3D8B7A]">Deine Preise, immer fair.</span>
            </h2>
            <p className="text-[#6B665E] text-lg leading-relaxed mb-8">
              Schluss mit Akquise, Angebotsschreiben und leeren Tagen. Reparo bringt die Aufträge zu dir —
              automatisch in deinen Kalender, priorisiert nach Nähe. Du konzentrierst dich auf das, was du am besten kannst.
            </p>
            <ul className="space-y-4">
              {punkte.map(p => (
                <li key={p.titel} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <span className="font-semibold text-[#2D2A26]">{p.titel}</span>
                    <p className="text-sm text-[#6B665E] mt-0.5">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Kalender-Mockup */}
          <div className="bg-white rounded-2xl border border-[#EDE8E1] shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Mein Kalender</h3>
              <span className="text-sm text-[#3D8B7A] font-medium">Heute</span>
            </div>
            <div className="space-y-3">
              {[
                { time: "08:00 – 10:00", task: "Wasserschaden Altbau", loc: "Schwabing · 1,2 km", status: "Bestätigt", color: "#3D8B7A" },
                { time: "10:30 – 12:00", task: "Heizungsventil tauschen", loc: "Maxvorstadt · 0,8 km", status: "Bestätigt", color: "#3D8B7A" },
                { time: "13:00 – 14:30", task: "Türschloss defekt", loc: "Schwabing · 0,3 km", status: "Neu via Auktion", color: "#C4956A" },
                { time: "15:00 – 16:30", task: "Balkon-Abdichtung", loc: "Lehel · 2,1 km", status: "Auktion läuft", color: "#8C857B" },
              ].map((slot, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-[#FAF8F5] border border-[#EDE8E1]">
                  <div className="text-xs text-[#8C857B] w-24 flex-shrink-0 font-mono tabular-nums">{slot.time}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2D2A26] truncate">{slot.task}</p>
                    <p className="text-xs text-[#8C857B]">{slot.loc}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: `${slot.color}15`, color: slot.color }}>
                    {slot.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-[#EDE8E1] flex items-center justify-between text-sm">
              <span className="text-[#8C857B]">So sieht ein voller Tag aus</span>
              <span className="text-xs text-[#8C857B] italic">Beispiel-Ansicht</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------- VERWALTER (Sie-Form) */

function VerwalterSection() {
  const punkte = [
    {
      titel: "Marktpreise statt Bauchgefühl",
      text: "Sehen Sie auf einen Blick, was eine Stunde Sanitär in Ihrem PLZ-Gebiet kostet — basierend auf echten Geboten der letzten Tage.",
    },
    {
      titel: "Favoritenliste für Stamm-Handwerker",
      text: "Ihre bewährten Profis erscheinen bei jeder neuen Meldung zuerst. Sie können auch direkt vergeben, ohne den Auktions-Prozess zu durchlaufen.",
    },
    {
      titel: "Express-Modus für Notfälle",
      text: "Wasserschaden Sonntagnacht? Ein Klick — Aufträge mit Priorität „Dringend“ gehen sofort an verfügbare Handwerker im Umkreis, Auktion in Minuten.",
    },
    {
      titel: "Reporting für Eigentümer",
      text: "Kosten pro Objekt, Reaktionszeiten, Mieter-Zufriedenheit. Übersichtliche Berichte für die nächste Eigentümer­versammlung — exportierbar als PDF.",
    },
  ]
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Auktions-Mockup */}
          <div className="bg-[#FAF8F5] rounded-2xl border border-[#EDE8E1] shadow-lg p-6 order-2 md:order-1">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Auftrag vergeben</h3>
              <span className="text-xs px-2 py-1 bg-[#C4956A]/10 text-[#C4956A] rounded-full font-medium">Auktion aktiv</span>
            </div>
            <div className="bg-white rounded-lg p-4 mb-4 border border-[#EDE8E1]">
              <p className="text-sm font-medium mb-1">Wasserhahn tropft — Küche</p>
              <p className="text-xs text-[#8C857B]">Wohnung 3.OG links · gemeldet vor 23 Min.</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs px-2 py-0.5 bg-[#C4956A]/10 text-[#C4956A] rounded">Sanitär</span>
                <span className="text-xs px-2 py-0.5 bg-[#3D8B7A]/10 text-[#3D8B7A] rounded">~1,5 Std.</span>
              </div>
            </div>
            <p className="text-xs text-[#8C857B] font-medium mb-3 uppercase tracking-wider">Verfügbare Handwerker</p>
            <div className="space-y-2">
              {[
                { name: "M. Weber", rating: "4.9", dist: "0,8 km", price: "85", avail: "Heute 14:00", favorit: true },
                { name: "K. Schmidt", rating: "4.7", dist: "2,3 km", price: "92", avail: "Heute 16:00" },
                { name: "R. Fischer", rating: "4.8", dist: "4,1 km", price: "98", avail: "Morgen 09:00" },
              ].map((hw, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${i === 0 ? "border-[#3D8B7A] bg-[#3D8B7A]/5" : "border-[#EDE8E1] bg-white"}`}>
                  <div className="w-8 h-8 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center text-[#3D8B7A] text-xs font-semibold flex-shrink-0">
                    {hw.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{hw.name}</p>
                      <span className="text-xs text-[#C4956A]">★ {hw.rating}</span>
                      {hw.favorit && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#D4A24E]/15 text-[#854F0B] rounded font-medium">Favorit</span>
                      )}
                    </div>
                    <p className="text-xs text-[#8C857B]">{hw.dist} entfernt · {hw.avail}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-[#3D8B7A]">€{hw.price}/h</p>
                    {i === 0 && <p className="text-xs text-[#3D8B7A]">Empfohlen</p>}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#8C857B] mt-4 italic text-center">Beispiel-Ansicht</p>
          </div>

          <div className="order-1 md:order-2">
            <span className="inline-block px-3 py-1 bg-[#3D8B7A]/10 text-[#3D8B7A] text-sm font-medium rounded-full mb-4">
              Für Verwalter
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              Schaden gemeldet.<br />
              <span className="text-[#3D8B7A]">Handwerker beauftragt.</span>
            </h2>
            <p className="text-[#6B665E] text-lg leading-relaxed mb-8">
              Keine Telefonrunden mehr. Die Stundenauktion zeigt Ihnen sofort verfügbare Handwerker mit transparenten
              Preisen, Bewertungen und Entfernung. In Minuten statt Tagen — und Ihre Stamm-Handwerker bleiben zuerst dran.
            </p>
            <ul className="space-y-4">
              {punkte.map(p => (
                <li key={p.titel} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <span className="font-semibold text-[#2D2A26]">{p.titel}</span>
                    <p className="text-sm text-[#6B665E] mt-0.5">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------- MIETER (Sie-Form, Timeline) */

function MieterSection() {
  const phasen = [
    {
      tag: "0:00",
      titel: "Foto, Beschreibung, fertig",
      text: "Schaden fotografieren, kurz beschreiben, absenden — in unter 30 Sekunden. Keine App nötig, alles im Browser.",
      mockup: (
        <div className="bg-white rounded-xl border border-[#EDE8E1] p-4 shadow-sm">
          <div className="aspect-video rounded-lg bg-gradient-to-br from-[#FAF8F5] to-[#EDE8E1] mb-3 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8C857B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <div className="space-y-2">
            <div className="h-2 bg-[#EDE8E1] rounded w-3/4" />
            <div className="h-2 bg-[#EDE8E1] rounded w-1/2" />
          </div>
          <button className="w-full mt-3 py-2 bg-[#3D8B7A] text-white text-xs rounded-lg font-medium">Schaden absenden</button>
        </div>
      ),
    },
    {
      tag: "+ wenige Stunden",
      titel: "Push: Handwerker beauftragt",
      text: "Sie sehen sofort, wer kommt und wann — konkretes Zeitfenster, keine Warteschleife zwischen 8 und 17 Uhr.",
      mockup: (
        <div className="bg-white rounded-xl border border-[#EDE8E1] p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#3D8B7A] flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#2D2A26]">Reparo</span>
                <span className="text-[10px] text-[#8C857B]">jetzt</span>
              </div>
              <p className="text-sm text-[#2D2A26] mt-0.5">
                <strong>Handwerker beauftragt:</strong> M. Weber kommt am Freitag, 14:00–16:00 Uhr.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      tag: "Nach Reparatur",
      titel: "Push: Bitte bewerten",
      text: "Eine kurze Bewertung hilft anderen Mietern und sorgt für Qualität. Keine versteckten Folgekosten, keine offene Frage „Hat es geklappt?“.",
      mockup: (
        <div className="bg-white rounded-xl border border-[#EDE8E1] p-4 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#D4A24E] flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            </div>
            <div className="flex-1">
              <span className="text-xs font-semibold text-[#2D2A26]">Reparatur abgeschlossen</span>
              <p className="text-sm text-[#2D2A26] mt-0.5">Wie zufrieden waren Sie?</p>
            </div>
          </div>
          <div className="flex gap-1 justify-center">
            {[1, 2, 3, 4, 5].map(i => (
              <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill={i <= 4 ? "#D4A24E" : "#EDE8E1"}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ))}
          </div>
        </div>
      ),
    },
  ]

  const vorteile = [
    "Kein Anruf nötig — alles digital",
    "Konkretes Zeitfenster statt „irgendwann zwischen 8 und 17 Uhr“",
    "Live-Status: Sie sehen jederzeit, wo Ihr Vorgang steht",
    "Notfall-Button für Wasserschäden & Co.",
  ]

  return (
    <section className="py-20 px-6 bg-[#FAF8F5]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 bg-[#D4A24E]/15 text-[#854F0B] text-sm font-medium rounded-full mb-4">
            Für Mieter
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Schaden melden.<br />
            <span className="text-[#3D8B7A]">Wissen, was passiert.</span>
          </h2>
          <p className="text-[#6B665E] text-lg max-w-2xl mx-auto">
            Kein Anruf, keine E-Mail, kein „wir melden uns“. Sie sehen in Echtzeit, wann der Handwerker kommt und was er macht.
          </p>
        </div>

        {/* Vertikale Timeline */}
        <div className="relative max-w-3xl mx-auto">
          {/* Connecting line */}
          <div className="absolute left-6 sm:left-1/2 sm:-ml-px top-12 bottom-12 w-0.5 bg-[#EDE8E1]" />

          {phasen.map((p, i) => (
            <div key={i} className="relative grid sm:grid-cols-2 gap-6 sm:gap-12 mb-12 last:mb-0">
              {/* Punkt */}
              <div className="absolute left-6 sm:left-1/2 sm:-ml-3 top-1 w-6 h-6 rounded-full bg-white border-4 border-[#3D8B7A] z-10" />

              {/* Content */}
              <div className={`pl-16 sm:pl-0 ${i % 2 === 0 ? "sm:pr-12 sm:text-right" : "sm:order-2 sm:pl-12"}`}>
                <span className="text-xs font-semibold text-[#3D8B7A] uppercase tracking-wider">{p.tag}</span>
                <h3 className="text-lg font-semibold mt-1 mb-2">{p.titel}</h3>
                <p className="text-sm text-[#6B665E] leading-relaxed">{p.text}</p>
              </div>

              {/* Mockup */}
              <div className={`pl-16 sm:pl-0 ${i % 2 === 0 ? "sm:pl-12" : "sm:order-1 sm:pr-12"}`}>
                {p.mockup}
              </div>
            </div>
          ))}
        </div>

        {/* Vorteile-Liste */}
        <div className="mt-16 bg-white rounded-2xl border border-[#EDE8E1] p-6 max-w-2xl mx-auto">
          <h3 className="font-semibold text-base mb-4 text-center">Was Sie konkret davon haben</h3>
          <ul className="grid sm:grid-cols-2 gap-3">
            {vorteile.map(v => (
              <li key={v} className="flex items-start gap-2 text-sm text-[#6B665E]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5" className="flex-shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
                {v}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------- KI AUTOMATION */

function KIAutomation() {
  const cards = [
    {
      titel: "KI-Triage",
      text: "Eingehende Schadenmeldungen werden automatisch nach Dringlichkeit, Gewerk und Aufwand sortiert.",
      icon: <IconBolt />,
      farbe: "#3D8B7A",
    },
    {
      titel: "Smart-Auktionen",
      text: "Matching nach Preis, Nähe, Verfügbarkeit und Bewertung — der beste Mix gewinnt, nicht nur der billigste.",
      icon: <IconAuction />,
      farbe: "#C4956A",
    },
    {
      titel: "Kalender-KI",
      text: "Erkennt Lücken im Handwerker-Kalender und füllt sie mit passenden Aufträgen aus der Nähe.",
      icon: <IconCalendar />,
      farbe: "#D4A24E",
    },
    {
      titel: "Routenoptimierung",
      text: "KI plant den optimalen Tagesablauf — minimale Fahrtwege, maximale Aufträge.",
      icon: <IconPin />,
      farbe: "#3D8B7A",
      kuenftig: true,
    },
  ]

  return (
    <section className="py-20 bg-gradient-to-b from-[#FAF8F5] to-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 bg-[#3D8B7A]/10 text-[#3D8B7A] text-sm font-medium rounded-full mb-4">
            KI-gestützt
          </span>
          <h2 className="text-3xl font-bold mb-4">Intelligente Automatisierung</h2>
          <p className="text-[#6B665E] max-w-2xl mx-auto">
            Die KI arbeitet im Hintergrund, damit alle Beteiligten weniger Zeit mit Organisation und mehr mit dem eigentlichen Job verbringen.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map(c => (
            <div key={c.titel} className="bg-white rounded-xl p-6 border border-[#EDE8E1] shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              {c.kuenftig && (
                <div className="absolute top-3 right-3 text-[10px] px-2 py-0.5 bg-[#3D8B7A]/10 text-[#3D8B7A] rounded-full font-medium uppercase tracking-wide">
                  Coming soon
                </div>
              )}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{ background: `${c.farbe}1A`, color: c.farbe }}
              >
                {c.icon}
              </div>
              <h3 className="font-semibold text-base mb-2">{c.titel}</h3>
              <p className="text-[#6B665E] text-sm">{c.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------- BEISPIEL-SZENARIEN (statt Fake-Testimonials) */

function BeispielSzenarien() {
  const szenarien = [
    {
      kontext: "Beispiel-Tag",
      rolle: "Sanitär-Handwerker",
      zitat:
        "Statt morgens drei Anrufe abzuhören und Termine zu sortieren: Kalender öffnen, vier Aufträge in 5 km Umkreis abarbeiten, abends in der Werkstatt fertig.",
      farbe: "#C4956A",
    },
    {
      kontext: "Beispiel-Vorgang",
      rolle: "Hausverwaltung",
      zitat:
        "Wasserhahn-Meldung um 9:42, Auktion bis 10:00, Stamm-Handwerker zum besten Preis vergeben, Mieter informiert — alles vor der Mittagspause.",
      farbe: "#3D8B7A",
    },
    {
      kontext: "Beispiel-Ablauf",
      rolle: "Mieterin",
      zitat:
        "Foto am Montagabend, Push am Dienstag früh: „Mittwoch 14–16 Uhr“. Handwerker da, repariert, Bewertung abgegeben — fertig.",
      farbe: "#D4A24E",
    },
  ]

  return (
    <section className="py-20 px-6 bg-[#FAF8F5]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">So sieht ein Tag mit Reparo aus</h2>
          <p className="text-[#6B665E] text-lg max-w-2xl mx-auto">
            Konkrete Abläufe für die drei Rollen — illustrative Beispiele, basierend auf den realen Plattform-Mechaniken.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {szenarien.map((s, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-[#EDE8E1] shadow-sm">
              <span
                className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded mb-3"
                style={{ color: s.farbe, background: `${s.farbe}15` }}
              >
                {s.kontext}
              </span>
              <p className="text-[#2D2A26] text-sm leading-relaxed mb-4">„{s.zitat}“</p>
              <p className="text-xs text-[#8C857B] font-medium">— {s.rolle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------- VERTRAUENS-SIEGEL */

function VertrauensSiegel() {
  return (
    <section className="py-12 px-6 bg-white border-y border-[#EDE8E1]">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          <div className="flex items-center gap-2 text-[#6B665E]">
            <Lock />
            <span className="text-sm font-medium">SSL-verschlüsselt</span>
          </div>
          <div className="flex items-center gap-2 text-[#6B665E]">
            <Shield />
            <span className="text-sm font-medium">DSGVO-konform</span>
          </div>
          <div className="flex items-center gap-2 text-[#6B665E]">
            <Globe />
            <span className="text-sm font-medium">Hosting in Deutschland</span>
          </div>
          <div className="flex items-center gap-2 text-[#6B665E]">
            <Check />
            <span className="text-sm font-medium">Made in Germany</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- FAQ */

function FaqSection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Häufige Fragen</h2>
          <p className="text-[#6B665E] text-lg">
            Alles, was du wissen solltest, bevor du startest.
          </p>
        </div>
        <Faq />
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- DUAL CTA */

function DualCTA() {
  return (
    <section className="py-20 px-6 bg-[#FAF8F5]">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-10 rounded-2xl bg-[#3D8B7A] text-white text-center">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Handwerker?</h2>
            <p className="text-white/85 mb-6">
              Lass deinen Kalender für dich arbeiten. Mehr Aufträge, bessere Preise, null Akquise.
            </p>
            <Link href="/registrierung" className="inline-block px-8 py-3.5 bg-white text-[#3D8B7A] rounded-xl hover:bg-[#FAF8F5] transition-colors font-semibold text-base">
              Jetzt kostenlos starten
            </Link>
          </div>

          <div className="p-10 rounded-2xl bg-[#2D2A26] text-white text-center">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Verwalter?</h2>
            <p className="text-white/75 mb-6">
              Transparente Preise, schnelle Vergabe, zufriedene Mieter. Testen Sie die Stundenauktion.
            </p>
            <Link href="/registrierung" className="inline-block px-8 py-3.5 bg-white text-[#2D2A26] rounded-xl hover:bg-[#FAF8F5] transition-colors font-semibold text-base">
              Kostenlos registrieren
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- FOOTER */

function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-[#EDE8E1] bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#3D8B7A] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="font-semibold">Reparo</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#6B665E]">
            <Link href="/impressum" className="hover:text-[#2D2A26] transition-colors py-3 px-3 inline-block">Impressum</Link>
            <Link href="/datenschutz" className="hover:text-[#2D2A26] transition-colors py-3 px-3 inline-block">Datenschutz</Link>
          </div>
          <p className="text-sm text-[#8C857B]">
            © 2026 Reparo. Alle Rechte vorbehalten.
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ----------------------------------------------------------- ICONS */

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
function Shield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
function Clock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
function Lock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
function Globe() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}
function IconAlert() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
function IconSearch() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function IconAuction() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  )
}
function IconBolt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
function IconStar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
function IconShuffle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  )
}
function IconPin() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
    </svg>
  )
}
