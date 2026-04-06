import Link from "next/link"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2D2A26]">
      {/* Navigation */}
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
            <Link href="/registrierung" className="text-sm px-4 py-3 bg-[#3D8B7A] text-white rounded-lg hover:bg-[#347A6A] transition-colors font-medium">
              Kostenlos starten
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — USP-driven */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#3D8B7A]/10 text-[#3D8B7A] rounded-full text-sm font-medium mb-8">
            <span className="w-1.5 h-1.5 bg-[#3D8B7A] rounded-full" />
            Die erste Stundenauktion f&uuml;r Immobilien
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
            Mehr verdienen.
            <br />
            <span className="text-[#3D8B7A]">Weniger suchen.</span>
          </h1>

          <p className="text-lg sm:text-xl text-[#6B665E] max-w-2xl mx-auto mb-10 leading-relaxed">
            Reparo f&uuml;llt deinen Kalender automatisch mit Auftr&auml;gen in deiner N&auml;he &mdash; zu fairen Marktpreisen.
            Verwalter bieten auf deine Stunden. Du arbeitest, wir organisieren.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/registrierung" className="w-full sm:w-auto px-8 py-3.5 bg-[#3D8B7A] text-white rounded-xl hover:bg-[#347A6A] transition-colors font-semibold text-base shadow-sm">
              Kostenlos als Handwerker starten
            </Link>
            <Link href="/registrierung" className="w-full sm:w-auto px-8 py-3.5 border border-[#EDE8E1] text-[#2D2A26] rounded-xl hover:bg-white transition-colors font-medium text-base">
              Ich bin Verwalter
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-[#8C857B] text-sm mt-10">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Keine Einrichtungsgeb&uuml;hr
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              DSGVO-konform
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              In 5 Minuten startklar
            </div>
          </div>
        </div>
      </section>

      {/* So funktioniert die Stundenauktion */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">So funktioniert die Stundenauktion</h2>
            <p className="text-[#6B665E] text-lg max-w-xl mx-auto">
              Drei Schritte vom Schaden zum erledigten Auftrag &mdash; automatisch, fair, schnell.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-16 left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] h-0.5 bg-[#EDE8E1]" />

            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#3D8B7A] text-white flex items-center justify-center mx-auto mb-6 text-lg font-bold relative z-10">1</div>
              <div className="w-14 h-14 rounded-xl bg-[#C4956A]/10 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Schaden wird gemeldet</h3>
              <p className="text-sm text-[#6B665E] leading-relaxed">
                Mieter meldet per App. KI kategorisiert, priorisiert und sch&auml;tzt den Aufwand automatisch.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#3D8B7A] text-white flex items-center justify-center mx-auto mb-6 text-lg font-bold relative z-10">2</div>
              <div className="w-14 h-14 rounded-xl bg-[#3D8B7A]/10 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                  <polyline points="17 6 23 6 23 12"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Verwalter bieten auf Stunden</h3>
              <p className="text-sm text-[#6B665E] leading-relaxed">
                Verf&uuml;gbare Zeitslots werden sichtbar. Verwalter bieten auf Handwerker-Stunden &mdash; faire Preise durch Marktmechanik.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#3D8B7A] text-white flex items-center justify-center mx-auto mb-6 text-lg font-bold relative z-10">3</div>
              <div className="w-14 h-14 rounded-xl bg-[#4A9E8C]/10 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4A9E8C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  <path d="M9 16l2 2 4-4"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Kalender f&uuml;llt sich automatisch</h3>
              <p className="text-sm text-[#6B665E] leading-relaxed">
                Der Auftrag landet direkt im Handwerker-Kalender. N&auml;he wird belohnt &mdash; kurze Wege, keine Leerlaufzeiten.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Zahlen & Fakten */}
      <section className="py-16 px-6 bg-white border-t border-[#EDE8E1]">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-[#3D8B7A]">+35%</div>
              <p className="text-sm text-[#6B665E] mt-1">Mehr Einnahmen f&uuml;r Handwerker</p>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-[#3D8B7A]">-70%</div>
              <p className="text-sm text-[#6B665E] mt-1">Weniger Akquise-Aufwand</p>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-[#3D8B7A]">98%</div>
              <p className="text-sm text-[#6B665E] mt-1">Zufriedenheitsrate</p>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-[#3D8B7A]">&lt;2h</div>
              <p className="text-sm text-[#6B665E] mt-1">Vom Schaden zum Auftrag</p>
            </div>
          </div>
        </div>
      </section>

      {/* Handwerker Benefits — Primary Target */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block px-3 py-1 bg-[#4A9E8C]/10 text-[#4A9E8C] text-sm font-medium rounded-full mb-4">
                F&uuml;r Handwerker
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Dein Kalender, immer voll.<br />
                <span className="text-[#3D8B7A]">Deine Preise, immer fair.</span>
              </h2>
              <p className="text-[#6B665E] text-lg leading-relaxed mb-8">
                Schluss mit Akquise, Angebotsschreiben und leeren Tagen. Reparo bringt die Auftr&auml;ge zu dir &mdash;
                automatisch in deinen Kalender, priorisiert nach N&auml;he. Du konzentrierst dich auf das, was du am besten kannst: Arbeiten.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <span className="font-semibold text-[#2D2A26]">Automatische Kalenderf&uuml;llung</span>
                    <p className="text-sm text-[#6B665E] mt-0.5">KI erkennt L&uuml;cken und f&uuml;llt sie mit passenden Auftr&auml;gen.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <span className="font-semibold text-[#2D2A26]">N&auml;he wird belohnt</span>
                    <p className="text-sm text-[#6B665E] mt-0.5">Kein Fahrzeit-Aufschlag f&uuml;r Handwerker in der N&auml;he &mdash; du gewinnst Auktionen nat&uuml;rlich h&auml;ufiger.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <span className="font-semibold text-[#2D2A26]">Faire Marktpreise</span>
                    <p className="text-sm text-[#6B665E] mt-0.5">Stundenauktion statt Preisdumping. Der Markt bestimmt deinen Wert, nicht ein Vermittler.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <span className="font-semibold text-[#2D2A26]">Bald: Routenoptimierung</span>
                    <p className="text-sm text-[#6B665E] mt-0.5">KI plant deinen Tag so, dass Fahrtwege minimal sind &mdash; mehr Auftr&auml;ge, weniger Kilometer.</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Visual: Kalender-Mockup */}
            <div className="bg-white rounded-2xl border border-[#EDE8E1] shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-lg">Mein Kalender</h3>
                <span className="text-sm text-[#3D8B7A] font-medium">April 2026</span>
              </div>
              <div className="space-y-3">
                {[
                  { time: "08:00 - 10:00", task: "Wasserschaden Altbau", loc: "Schwabing, 1.2 km", status: "Bestätigt", color: "#3D8B7A" },
                  { time: "10:30 - 12:00", task: "Heizungsventil tauschen", loc: "Maxvorstadt, 0.8 km", status: "Bestätigt", color: "#3D8B7A" },
                  { time: "13:00 - 14:30", task: "Türschloss defekt", loc: "Schwabing, 0.3 km", status: "Neu via Auktion", color: "#C4956A" },
                  { time: "15:00 - 16:30", task: "Balkon-Abdichtung", loc: "Lehel, 2.1 km", status: "Auktion läuft", color: "#8C857B" },
                ].map((slot, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-[#FAF8F5] border border-[#EDE8E1]">
                    <div className="text-xs text-[#8C857B] w-24 flex-shrink-0 font-mono">{slot.time}</div>
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
                <span className="text-[#6B665E]">Tageseinnahmen (gesch&auml;tzt)</span>
                <span className="font-bold text-[#3D8B7A] text-lg">&euro;680</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Verwalter Benefits */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Visual: Auktions-Interface */}
            <div className="bg-[#FAF8F5] rounded-2xl border border-[#EDE8E1] shadow-lg p-6 order-2 md:order-1">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-lg">Auftrag vergeben</h3>
                <span className="text-xs px-2 py-1 bg-[#C4956A]/10 text-[#C4956A] rounded-full font-medium">Auktion aktiv</span>
              </div>
              <div className="bg-white rounded-lg p-4 mb-4 border border-[#EDE8E1]">
                <p className="text-sm font-medium mb-1">Wasserhahn tropft &mdash; K&uuml;che</p>
                <p className="text-xs text-[#8C857B]">Wohnung 3.OG links &bull; Gemeldet vor 23 Min.</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 bg-[#C4956A]/10 text-[#C4956A] rounded">Sanit&auml;r</span>
                  <span className="text-xs px-2 py-0.5 bg-[#3D8B7A]/10 text-[#3D8B7A] rounded">~1.5 Std.</span>
                </div>
              </div>
              <p className="text-xs text-[#8C857B] font-medium mb-3 uppercase tracking-wider">Verf&uuml;gbare Handwerker</p>
              <div className="space-y-2">
                {[
                  { name: "M. Weber", rating: "4.9", dist: "0.8 km", price: "85", avail: "Heute 14:00" },
                  { name: "K. Schmidt", rating: "4.7", dist: "2.3 km", price: "92", avail: "Heute 16:00" },
                  { name: "R. Fischer", rating: "4.8", dist: "4.1 km", price: "98", avail: "Morgen 09:00" },
                ].map((hw, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${i === 0 ? 'border-[#3D8B7A] bg-[#3D8B7A]/5' : 'border-[#EDE8E1] bg-white'}`}>
                    <div className="w-8 h-8 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center text-[#3D8B7A] text-xs font-semibold flex-shrink-0">
                      {hw.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{hw.name}</p>
                        <span className="text-xs text-[#C4956A]">&#9733; {hw.rating}</span>
                      </div>
                      <p className="text-xs text-[#8C857B]">{hw.dist} entfernt &bull; {hw.avail}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[#3D8B7A]">&euro;{hw.price}/h</p>
                      {i === 0 && <p className="text-xs text-[#3D8B7A]">Empfohlen</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 md:order-2">
              <span className="inline-block px-3 py-1 bg-[#3D8B7A]/10 text-[#3D8B7A] text-sm font-medium rounded-full mb-4">
                F&uuml;r Verwalter
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Schaden gemeldet.<br />
                <span className="text-[#3D8B7A]">Handwerker beauftragt.</span>
              </h2>
              <p className="text-[#6B665E] text-lg leading-relaxed mb-8">
                Keine Telefonrunden mehr. Die Stundenauktion zeigt Ihnen sofort verf&uuml;gbare Handwerker mit transparenten
                Preisen, Bewertungen und Entfernung. In Minuten statt Tagen.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <span className="font-semibold text-[#2D2A26]">Transparente Marktpreise</span>
                    <p className="text-sm text-[#6B665E] mt-0.5">Sehen Sie sofort, was eine Stunde kostet &mdash; basierend auf Angebot und Nachfrage.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <span className="font-semibold text-[#2D2A26]">N&auml;he spart Geld</span>
                    <p className="text-sm text-[#6B665E] mt-0.5">Handwerker um die Ecke haben keinen Fahrzeit-Aufschlag &mdash; gut f&uuml;r Sie und den Handwerker.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <span className="font-semibold text-[#2D2A26]">KI-Priorisierung</span>
                    <p className="text-sm text-[#6B665E] mt-0.5">Eingehende Meldungen werden automatisch nach Dringlichkeit sortiert.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Mieter Benefits */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-3 py-1 bg-[#C4956A]/10 text-[#C4956A] text-sm font-medium rounded-full mb-4">
            F&uuml;r Mieter
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Schaden melden. Zur&uuml;cklehnen.
          </h2>
          <p className="text-[#6B665E] text-lg max-w-2xl mx-auto mb-12">
            Kein Anruf, keine E-Mail, kein Warten im Dunkeln. Melden Sie Sch&auml;den in Sekunden und verfolgen Sie in Echtzeit, wann der Handwerker kommt.
          </p>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-[#EDE8E1] bg-white">
              <div className="w-10 h-10 rounded-lg bg-[#C4956A]/10 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Foto, Text, fertig</h3>
              <p className="text-sm text-[#6B665E]">Schaden fotografieren, kurz beschreiben, absenden. In unter 60 Sekunden.</p>
            </div>
            <div className="p-6 rounded-xl border border-[#EDE8E1] bg-white">
              <div className="w-10 h-10 rounded-lg bg-[#C4956A]/10 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Live-Status</h3>
              <p className="text-sm text-[#6B665E]">Sehen Sie in Echtzeit: Wer kommt? Wann? Was ist der aktuelle Stand?</p>
            </div>
            <div className="p-6 rounded-xl border border-[#EDE8E1] bg-white">
              <div className="w-10 h-10 rounded-lg bg-[#C4956A]/10 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Schneller repariert</h3>
              <p className="text-sm text-[#6B665E]">Durch die Auktion sind Handwerker in Stunden statt Tagen beauftragt.</p>
            </div>
          </div>
        </div>
      </section>

      {/* KI & Zukunft */}
      <section className="py-20 bg-gradient-to-b from-[#FAF8F5] to-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 bg-[#3D8B7A]/10 text-[#3D8B7A] text-sm font-medium rounded-full mb-4">
              KI-gest&uuml;tzt
            </span>
            <h2 className="text-3xl font-bold mb-4">
              Intelligente Automatisierung
            </h2>
            <p className="text-[#6B665E] max-w-2xl mx-auto">
              Unsere KI arbeitet im Hintergrund, damit du dich auf dein Handwerk konzentrieren kannst.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 border border-[#EDE8E1] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-[#3D8B7A]/10 rounded-lg flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <h3 className="font-semibold text-base mb-2">KI-Triage</h3>
              <p className="text-[#6B665E] text-sm">
                Automatische Priorisierung nach Dringlichkeit und Kategorie.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-[#EDE8E1] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-[#C4956A]/10 rounded-lg flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                  <polyline points="17 6 23 6 23 12"/>
                </svg>
              </div>
              <h3 className="font-semibold text-base mb-2">Smart-Auktionen</h3>
              <p className="text-[#6B665E] text-sm">
                Intelligentes Matching nach Preis, N&auml;he, Verf&uuml;gbarkeit und Bewertung.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-[#EDE8E1] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-[#4A9E8C]/10 rounded-lg flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A9E8C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <h3 className="font-semibold text-base mb-2">Kalender-KI</h3>
              <p className="text-[#6B665E] text-sm">
                Erkennt L&uuml;cken im Kalender und f&uuml;llt sie mit passenden Auftr&auml;gen.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-[#EDE8E1] shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute top-3 right-3 text-xs px-2 py-0.5 bg-[#3D8B7A]/10 text-[#3D8B7A] rounded-full font-medium">Coming soon</div>
              <div className="w-10 h-10 bg-[#3D8B7A]/10 rounded-lg flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/>
                </svg>
              </div>
              <h3 className="font-semibold text-base mb-2">Routenoptimierung</h3>
              <p className="text-[#6B665E] text-sm">
                KI plant den optimalen Tagesablauf &mdash; minimale Fahrtwege, maximale Auftr&auml;ge.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Kundenstimmen — Updated mit Auktions-Bezug */}
      <section className="py-20 px-6 bg-[#FAF8F5]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Das sagen unsere Nutzer</h2>
            <p className="text-[#6B665E] text-lg max-w-xl mx-auto">
              Echte Erfahrungen von Handwerkern, Verwaltern und Mietern.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl border border-[#EDE8E1] shadow-sm">
              <div className="flex items-center gap-1 mb-3 text-[#C4956A]">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                ))}
              </div>
              <p className="text-[#2D2A26] text-sm leading-relaxed mb-4">
                &ldquo;Seit ich bei Reparo bin, ist mein Kalender jeden Tag voll. Die Auftr&auml;ge sind alle in meiner N&auml;he &mdash; ich fahre kaum noch quer durch die Stadt. Mein Umsatz ist sp&uuml;rbar gestiegen.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#4A9E8C]/10 flex items-center justify-center text-[#4A9E8C] font-semibold text-sm">TW</div>
                <div>
                  <p className="text-sm font-medium text-[#2D2A26]">Thomas W.</p>
                  <p className="text-xs text-[#8C857B]">Sanit&auml;r-Handwerker, Hamburg</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-[#EDE8E1] shadow-sm">
              <div className="flex items-center gap-1 mb-3 text-[#C4956A]">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                ))}
              </div>
              <p className="text-[#2D2A26] text-sm leading-relaxed mb-4">
                &ldquo;Die Stundenauktion hat unsere Kosten transparent gemacht. Wir sehen sofort, wer verf&uuml;gbar ist und was es kostet. Fr&uuml;her haben wir Tage mit Telefonrunden verloren.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center text-[#3D8B7A] font-semibold text-sm">MK</div>
                <div>
                  <p className="text-sm font-medium text-[#2D2A26]">Michael K.</p>
                  <p className="text-xs text-[#8C857B]">Hausverwaltung, M&uuml;nchen</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-[#EDE8E1] shadow-sm">
              <div className="flex items-center gap-1 mb-3 text-[#C4956A]">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                ))}
              </div>
              <p className="text-[#2D2A26] text-sm leading-relaxed mb-4">
                &ldquo;Ich habe den Schaden am Montag gemeldet, am Dienstag war der Handwerker da. Bei meiner alten Wohnung hat das Wochen gedauert. Endlich wei&szlig; man, was passiert.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C4956A]/10 flex items-center justify-center text-[#C4956A] font-semibold text-sm">SB</div>
                <div>
                  <p className="text-sm font-medium text-[#2D2A26]">Sandra B.</p>
                  <p className="text-xs text-[#8C857B]">Mieterin, Berlin</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vertrauens-Siegel */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            <div className="flex items-center gap-2 text-[#6B665E]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span className="text-sm font-medium">SSL-verschl&uuml;sselt</span>
            </div>
            <div className="flex items-center gap-2 text-[#6B665E]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span className="text-sm font-medium">DSGVO-konform</span>
            </div>
            <div className="flex items-center gap-2 text-[#6B665E]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span className="text-sm font-medium">Hosting in Deutschland</span>
            </div>
            <div className="flex items-center gap-2 text-[#6B665E]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span className="text-sm font-medium">Made in Germany</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA — Dual */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Handwerker CTA */}
            <div className="p-10 rounded-2xl bg-[#3D8B7A] text-white text-center">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Handwerker?</h2>
              <p className="text-white/80 mb-6">
                Lass deinen Kalender f&uuml;r dich arbeiten. Mehr Auftr&auml;ge, bessere Preise, null Akquise.
              </p>
              <Link href="/registrierung" className="inline-block px-8 py-3.5 bg-white text-[#3D8B7A] rounded-xl hover:bg-[#FAF8F5] transition-colors font-semibold text-base">
                Jetzt kostenlos starten
              </Link>
            </div>

            {/* Verwalter CTA */}
            <div className="p-10 rounded-2xl bg-[#2D2A26] text-white text-center">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Verwalter?</h2>
              <p className="text-white/70 mb-6">
                Transparente Preise, schnelle Vergabe, zufriedene Mieter. Testen Sie die Stundenauktion.
              </p>
              <Link href="/registrierung" className="inline-block px-8 py-3.5 bg-white text-[#2D2A26] rounded-xl hover:bg-[#FAF8F5] transition-colors font-semibold text-base">
                Kostenlos registrieren
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#EDE8E1]">
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
              &copy; 2026 Reparo. Alle Rechte vorbehalten.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
