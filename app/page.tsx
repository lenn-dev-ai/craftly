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

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#3D8B7A]/10 text-[#3D8B7A] rounded-full text-sm font-medium mb-8">
            <span className="w-1.5 h-1.5 bg-[#3D8B7A] rounded-full" />
            Hausverwaltung, neu gedacht
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
            Immobilien verwalten.
            <br />
            <span className="text-[#3D8B7A]">Ohne Chaos.</span>
          </h1>
          <p className="text-lg sm:text-xl text-[#6B665E] max-w-2xl mx-auto mb-10 leading-relaxed">
            Reparo verbindet Verwalter, Mieter und Handwerker auf einer Plattform.
            Meldungen, Aufträge und Kommunikation - alles an einem Ort.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/registrierung" className="w-full sm:w-auto px-8 py-3.5 bg-[#3D8B7A] text-white rounded-xl hover:bg-[#347A6A] transition-colors font-semibold text-base shadow-sm">
              Jetzt kostenlos testen
            </Link>
            <Link href="/login" className="w-full sm:w-auto px-8 py-3.5 border border-[#EDE8E1] text-[#2D2A26] rounded-xl hover:bg-white transition-colors font-medium text-base">
              Ich habe bereits ein Konto
            </Link>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-[#8C857B] text-sm">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              DSGVO-konform
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Keine Einrichtungsgebühr
            </div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              In 5 Minuten startklar
            </div>
          </div>
        </div>
      </section>


      {/* Zahlen & Fakten */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-[#3D8B7A]">500+</div>
              <p className="text-sm text-[#6B665E] mt-1">Verwaltete Objekte</p>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-[#3D8B7A]">1.200+</div>
              <p className="text-sm text-[#6B665E] mt-1">Bearbeitete Meldungen</p>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-[#3D8B7A]">98%</div>
              <p className="text-sm text-[#6B665E] mt-1">Zufriedenheitsrate</p>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-[#3D8B7A]">&lt;24h</div>
              <p className="text-sm text-[#6B665E] mt-1">Durchschn. Reaktionszeit</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works - Roles */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Eine Plattform, drei Perspektiven</h2>
            <p className="text-[#6B665E] text-lg max-w-xl mx-auto">
              Jede Rolle bekommt genau die Werkzeuge, die sie braucht.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Verwalter */}
            <div className="p-8 rounded-2xl border border-[#EDE8E1] bg-[#FAF8F5] hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#3D8B7A]/10 flex items-center justify-center mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Verwalter</h3>
              <p className="text-[#6B665E] leading-relaxed mb-4">
                Behalten Sie den Überblick über alle Objekte, Meldungen und Aufträge. Automatische Benachrichtigungen und klare Dashboards.
              </p>
              <ul className="space-y-2 text-sm text-[#6B665E]">
                <li className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Objekt- und Mieterverwaltung
                </li>
                <li className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Schadensmeldungen im Blick
                </li>
                <li className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Handwerker direkt beauftragen
                </li>
              </ul>
            </div>

            {/* Mieter */}
            <div className="p-8 rounded-2xl border border-[#EDE8E1] bg-[#FAF8F5] hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#C4956A]/10 flex items-center justify-center mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Mieter</h3>
              <p className="text-[#6B665E] leading-relaxed mb-4">
                Melden Sie Schäden in wenigen Klicks und verfolgen Sie den Status in Echtzeit. Kein Anruf, keine E-Mail nötig.
              </p>
              <ul className="space-y-2 text-sm text-[#6B665E]">
                <li className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Schnelle Schadensmeldung
                </li>
                <li className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Live-Status der Bearbeitung
                </li>
                <li className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Direkte Kommunikation
                </li>
              </ul>
            </div>

            {/* Handwerker */}
            <div className="p-8 rounded-2xl border border-[#EDE8E1] bg-[#FAF8F5] hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#4A9E8C]/10 flex items-center justify-center mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A9E8C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Handwerker</h3>
              <p className="text-[#6B665E] leading-relaxed mb-4">
                Erhalten Sie Aufträge digital, mit allen Details und Fotos. Dokumentieren Sie Ihre Arbeit direkt in der App.
              </p>
              <ul className="space-y-2 text-sm text-[#6B665E]">
                <li className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Digitaler Auftragseingang
                </li>
                <li className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Fotos und Beschreibungen
                </li>
                <li className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Einfache Dokumentation
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Alles, was moderne Verwaltung braucht</h2>
            <p className="text-[#6B665E] text-lg max-w-xl mx-auto">
              Schluss mit Excel-Listen, verlorenen E-Mails und Telefonketten.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Schadensmeldungen", desc: "Mieter melden Schäden mit Fotos und Beschreibung. Verwalter sehen alles sofort.", icon: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01" },
              { title: "Auftragsvergabe", desc: "Beauftragen Sie Handwerker mit einem Klick. Alle Details werden automatisch weitergeleitet.", icon: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M20 8v6 M23 11h-6 M12.5 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0z" },
              { title: "Echtzeit-Status", desc: "Jeder sieht den aktuellen Stand. Keine Nachfragen, keine Missverständnisse.", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
              { title: "Dokumentenablage", desc: "Mietverträge, Protokolle und Rechnungen sicher an einem Ort gespeichert.", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" },
              { title: "Benachrichtigungen", desc: "Automatische Updates per E-Mail bei Statusänderungen und neuen Meldungen.", icon: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0" },
              { title: "Analyse-Dashboard", desc: "Auswertungen zu Kosten, Reaktionszeiten und offenen Vorgängen auf einen Blick.", icon: "M18 20V10 M12 20V4 M6 20v-6" },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-xl border border-[#EDE8E1] bg-white hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-[#3D8B7A]/10 flex items-center justify-center mb-4">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={feature.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-[#6B665E] leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* Kundenstimmen */}
      <section className="py-20 px-6 bg-[#FAF8F5]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Das sagen unsere Nutzer</h2>
            <p className="text-[#6B665E] text-lg max-w-xl mx-auto">
              Echte Erfahrungen von Verwaltern, Mietern und Handwerkern.
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
                &ldquo;Seit wir Reparo nutzen, haben wir den Überblick über alle 120 Objekte. Schadensmeldungen werden automatisch priorisiert und an Handwerker weitergeleitet.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#3D8B7A]/10 flex items-center justify-center text-[#3D8B7A] font-semibold text-sm">MK</div>
                <div>
                  <p className="text-sm font-medium text-[#2D2A26]">Michael K.</p>
                  <p className="text-xs text-[#8C857B]">Hausverwaltung, München</p>
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
                &ldquo;Endlich kann ich Schäden einfach mit dem Handy melden und sehe sofort, wann der Handwerker kommt. Kein ewiges Telefonieren mehr.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#C4956A]/10 flex items-center justify-center text-[#C4956A] font-semibold text-sm">SB</div>
                <div>
                  <p className="text-sm font-medium text-[#2D2A26]">Sandra B.</p>
                  <p className="text-xs text-[#8C857B]">Mieterin, Berlin</p>
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
                &ldquo;Die Aufträge kommen digital mit allen Details und Fotos. Ich spare mir die Rückfragen und kann direkt loslegen. Top System!&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#4A9E8C]/10 flex items-center justify-center text-[#4A9E8C] font-semibold text-sm">TW</div>
                <div>
                  <p className="text-sm font-medium text-[#2D2A26]">Thomas W.</p>
                  <p className="text-xs text-[#8C857B]">Handwerker, Hamburg</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KI-Funktionen */}
      <section className="py-20 bg-gradient-to-b from-[#FAF8F5] to-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 bg-[#3D8B7A]/10 text-[#3D8B7A] text-sm font-medium rounded-full mb-4">
              Neu: KI-gestützt
            </span>
            <h2 className="text-3xl font-bold mb-4">
              Intelligente Automatisierung
            </h2>
            <p className="text-[#6B665E] max-w-2xl mx-auto">
              Unsere KI-Funktionen helfen Ihnen, schneller und effizienter zu arbeiten.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 border border-[#EDE8E1] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-[#3D8B7A]/10 rounded-lg flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">KI-Triage</h3>
              <p className="text-[#6B665E] text-sm">
                Automatische Priorisierung eingehender Aufträge nach Dringlichkeit und Kategorie.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-[#EDE8E1] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-[#C4956A]/10 rounded-lg flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">Smart-Auktionen</h3>
              <p className="text-[#6B665E] text-sm">
                Handwerker-Matching mit intelligenter Preisoptimierung für beste Ergebnisse.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-[#EDE8E1] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-[#3D8B7A]/10 rounded-lg flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3D8B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">Echtzeit-Analyse</h3>
              <p className="text-[#6B665E] text-sm">
                Live-Dashboards mit KI-Vorhersagen zu Kosten, Auslastung und Trends.
              </p>
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
              <span className="text-sm font-medium">SSL-verschlüsselt</span>
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

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-12 rounded-2xl bg-[#3D8B7A] text-white">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Bereit für effiziente Verwaltung?</h2>
            <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">
              Starten Sie kostenlos und erleben Sie, wie einfach Immobilienverwaltung sein kann.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/registrierung" className="w-full sm:w-auto px-8 py-3.5 bg-white text-[#3D8B7A] rounded-xl hover:bg-[#FAF8F5] transition-colors font-semibold text-base">
                Kostenlos registrieren
              </Link>
              <Link href="/login" className="w-full sm:w-auto px-8 py-3.5 border border-white/30 text-white rounded-xl hover:bg-white/10 transition-colors font-medium text-base">
                Anmelden
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
