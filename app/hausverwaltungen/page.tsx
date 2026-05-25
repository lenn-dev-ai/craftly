import Link from "next/link"
import type { Metadata } from "next"
import {
  Phone, Clock, FileX, ArrowRight,
  Check, Shield, Lock, Server, Database,
  PhoneCall, Sparkles, MousePointerClick,
} from "lucide-react"

// Sprint K — B2B-Landing für Hausverwaltungen.
// Story-Arc kompatibel zu Sales-Deck (Reparo-Sales-Deck-Hausverwaltungen.pptx).
// Server-Komponente: keine "use client"-Direktive, kein JS-Hydration nötig
// für die statischen Sektionen — beste Lighthouse-Performance.

export const metadata: Metadata = {
  title: "Reparo · Schadensmanagement für Hausverwaltungen",
  description: "Vom Mieter-Anruf bis zur Handwerker-Rechnung in einem Tool. Weniger Telefonate, mehr Übersicht, faire Marktpreise.",
  openGraph: {
    title: "Reparo · Schadensmanagement für Hausverwaltungen",
    description: "Vom Mieter-Anruf bis zur Handwerker-Rechnung in einem Tool.",
    type: "website",
  },
}

const DEMO_MAIL = "mailto:lenn-dev@proton.me?subject=Reparo-Demo"

export default function HausverwaltungenLanding() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <Nav />
      <Hero />
      <ProblemCards />
      <SolutionFlow />
      <USP />
      <Pricing />
      <SecurityStrip />
      <FinalCTA />
      <Footer />
    </div>
  )
}

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-line">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <span className="text-xl font-semibold tracking-tight">Reparo</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-ink-secondary hover:text-ink transition-colors">
            Anmelden
          </Link>
          <a href={DEMO_MAIL} className="text-sm px-4 py-2.5 bg-rolle-verwalter text-white rounded-lg hover:opacity-90 transition-opacity font-medium">
            Demo buchen
          </a>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="pt-32 pb-16 md:pt-36 md:pb-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rolle-verwalter/10 text-rolle-verwalter rounded-full text-xs font-bold uppercase tracking-wider mb-6">
          <span className="w-1.5 h-1.5 bg-rolle-verwalter rounded-full" />
          Für Hausverwaltungen
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
          Schadensmanagement,
          <br />
          <span className="text-rolle-verwalter">neu gedacht.</span>
        </h1>
        <p className="text-lg sm:text-xl text-ink-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
          Vom Mieter-Anruf bis zur Handwerker-Rechnung — in einem Tool.
          Weniger Telefonate, weniger Excel, mehr Übersicht.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href={DEMO_MAIL} className="w-full sm:w-auto px-8 py-3.5 bg-rolle-verwalter text-white rounded-xl hover:opacity-90 transition-opacity font-semibold text-base shadow-sm inline-flex items-center justify-center gap-2">
            30-Min-Demo buchen <ArrowRight className="w-4 h-4" />
          </a>
          <Link href="/login" className="w-full sm:w-auto px-8 py-3.5 border border-line text-ink rounded-xl hover:bg-white transition-colors font-medium text-base">
            Schon ein Test-Account? Anmelden
          </Link>
        </div>
      </div>
    </section>
  )
}

function ProblemCards() {
  const items = [
    {
      icon: <Phone className="w-6 h-6" />,
      titel: "Zu viel Zeit",
      text: "Pro Schaden 3–5 Anrufe, Nachfassen bei Handwerkern, Termin-Pingpong mit Mietern. Stundenweise pro Vorgang.",
    },
    {
      icon: <Clock className="w-6 h-6" />,
      titel: "Zu wenig Vergleich",
      text: "Wer als Erstes ans Telefon geht, kriegt den Auftrag — egal ob fair bepreist oder mit Wartezeit von 14 Tagen.",
    },
    {
      icon: <FileX className="w-6 h-6" />,
      titel: "Zu wenig Übersicht",
      text: "Tickets in Excel, E-Mails, WhatsApp. Wer hat was zugesagt? Was ist offen? Was wurde abgerechnet?",
    },
  ]
  return (
    <section className="py-16 md:py-24 px-6 bg-white border-y border-line">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-ink mb-3">Das kennen Sie.</h2>
          <p className="text-ink-secondary">Schadensbearbeitung kostet Hausverwaltungen täglich Stunden.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {items.map(item => (
            <div key={item.titel} className="bg-surface rounded-2xl p-6 border border-line">
              <div className="w-12 h-12 rounded-xl bg-danger/10 text-danger flex items-center justify-center mb-4">
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold text-ink mb-2">{item.titel}</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SolutionFlow() {
  // Sprint R14 — Mieter-First-Konzept-Update (25.05.). Vorher war
  // Step 1 "Verwalter trägt ein" (Telefonat-Pfad). Neuer Workflow:
  // Mieter meldet selbst über die App, KI-Voice klärt Lücken,
  // Verwalter vergibt nur mit 1 Klick.
  const steps = [
    {
      icon: <PhoneCall className="w-5 h-5" />,
      nr: "1",
      titel: "Mieter meldet selbst",
      text: "Über App oder direkt per Foto. Die KI klassifiziert Gewerk und Dringlichkeit automatisch — ohne dass jemand telefonieren muss.",
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      nr: "2",
      titel: "KI klärt offene Lücken",
      text: "Fehlen Infos (Wann zu Hause? Schlüssel vorhanden?), ruft die Reparo-KI den Mieter zurück und klärt das in 90 Sekunden. Sie sehen nur das fertige Ticket.",
      highlight: true,
    },
    {
      icon: <MousePointerClick className="w-5 h-5" />,
      nr: "3",
      titel: "Sie vergeben mit 1 Klick",
      text: "Beste Annahme nach Preis, Bewertung, Verfügbarkeit. Termin wird automatisch mit dem Mieter abgestimmt — Sie machen nur noch das letzte 1%.",
    },
  ]
  return (
    <section className="py-16 md:py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-ink mb-3">So einfach geht es mit Reparo.</h2>
          <p className="text-ink-secondary">Drei Schritte — Sie sehen nur das fertige Ticket.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map(step => (
            <div
              key={step.nr}
              className={`rounded-2xl p-6 border ${
                step.highlight
                  ? "bg-rolle-verwalter/5 border-rolle-verwalter/30 shadow-sm"
                  : "bg-white border-line"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-rolle-verwalter text-white flex items-center justify-center font-bold text-lg">
                  {step.nr}
                </div>
                <div className="text-rolle-verwalter">{step.icon}</div>
              </div>
              <h3 className="text-lg font-semibold text-ink mb-2">{step.titel}</h3>
              <p className="text-sm text-ink-secondary leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function USP() {
  const punkte = [
    {
      headline: "Vergessen Sie das „ich frag mal Harald“.",
      sub: "Statt einem Stamm-Handwerker bekommen Sie pro Schaden 3-5 qualifizierte Annahmen — und Reparo schlägt automatisch die beste vor.",
    },
    {
      headline: "Festpreise statt Endlos-Verhandlung.",
      sub: "Das System kalkuliert für jeden Schaden einen marktgerechten Preis. Handwerker akzeptieren oder lehnen ab — keine Pauschal-Ratereien mehr.",
    },
    {
      headline: "Mieter und Handwerker stimmen sich selbst ab.",
      sub: "Doodle-Style: HW schlägt 2-3 Termine vor, Mieter wählt einen. Sie sehen den bestätigten Termin in der Übersicht.",
    },
    {
      headline: "Alles in einem Dashboard.",
      sub: "KPIs, Throughput-Trend, offene Vorgänge, abgeschlossene Rechnungen. Excel und WhatsApp sind dann wirklich überflüssig.",
    },
  ]
  return (
    <section className="py-16 md:py-24 px-6 bg-white border-y border-line">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-ink mb-3">Was Reparo anders macht.</h2>
        </div>
        <div className="space-y-6">
          {punkte.map(p => (
            <div key={p.headline} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center flex-shrink-0 mt-1">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-ink mb-1">{p.headline}</h3>
                <p className="text-ink-secondary leading-relaxed">{p.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  const tiers = [
    {
      name: "Starter",
      preis: "49",
      einheit: "/ Monat",
      ziel: "Bis 50 Wohneinheiten",
      features: ["Schadens-Wizard", "Auto-Vergabe", "1 Verwalter-Account", "Standard-Support"],
      cta: "30 Tage testen",
    },
    {
      name: "Pro",
      preis: "149",
      einheit: "/ Monat",
      ziel: "50–300 Wohneinheiten",
      features: ["Alles aus Starter", "Bulk-Import", "Throughput-Analytics", "5 Verwalter-Accounts", "Priorisierter Support"],
      cta: "Demo buchen",
      highlight: true,
    },
    {
      name: "Enterprise",
      preis: "individuell",
      einheit: "",
      ziel: "300+ Wohneinheiten",
      features: ["Alles aus Pro", "SSO/SAML", "Custom-SLA", "API-Zugang", "Dedicated Success Manager"],
      cta: "Sprechen wir",
    },
  ]
  return (
    <section className="py-16 md:py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-ink mb-3">Faires Preismodell.</h2>
          <p className="text-ink-secondary mb-3">Pro Verwaltung, pro Monat — alle Preise netto. Kein Lock-in.</p>
          <a
            href="/Reparo-Pricing-Calculator.html"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-rolle-verwalter hover:underline"
          >
            ROI-Calculator öffnen <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {tiers.map(t => (
            <div
              key={t.name}
              className={`rounded-2xl p-6 border ${
                t.highlight
                  ? "bg-rolle-verwalter/5 border-rolle-verwalter ring-2 ring-rolle-verwalter/20"
                  : "bg-white border-line"
              }`}
            >
              {t.highlight && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-rolle-verwalter mb-2">
                  Beliebteste Wahl
                </div>
              )}
              <h3 className="text-xl font-bold text-ink mb-1">{t.name}</h3>
              <p className="text-xs text-ink-muted mb-4">{t.ziel}</p>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-bold text-ink">{t.preis === "individuell" ? "Auf Anfrage" : `${t.preis} €`}</span>
                {t.einheit && <span className="text-sm text-ink-muted">{t.einheit}</span>}
              </div>
              <ul className="space-y-2 mb-6">
                {t.features.map(f => (
                  <li key={f} className="text-sm text-ink-secondary flex items-start gap-2">
                    <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={DEMO_MAIL}
                className={`block text-center w-full py-2.5 rounded-lg font-medium text-sm transition-opacity ${
                  t.highlight
                    ? "bg-rolle-verwalter text-white hover:opacity-90"
                    : "border border-line text-ink hover:bg-surface"
                }`}
              >
                {t.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SecurityStrip() {
  const sigel = [
    { icon: <Server className="w-5 h-5" />, label: "EU-Hosting", sub: "Supabase Frankfurt" },
    { icon: <Shield className="w-5 h-5" />, label: "DSGVO-konform", sub: "AV-Vertrag inklusive" },
    { icon: <Database className="w-5 h-5" />, label: "RLS auf DB-Ebene", sub: "Row-Level-Security" },
    { icon: <Lock className="w-5 h-5" />, label: "TLS 1.3", sub: "Ende-zu-Ende verschlüsselt" },
  ]
  return (
    <section className="py-10 px-6 bg-white border-y border-line">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          {sigel.map(s => (
            <div key={s.label} className="flex items-start gap-2 text-ink-secondary">
              <div className="text-accent mt-0.5">{s.icon}</div>
              <div>
                <div className="text-sm font-semibold text-ink">{s.label}</div>
                <div className="text-xs text-ink-muted">{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="py-16 md:py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-ink mb-4">
          Schauen Sie sich Reparo in 30 Minuten an.
        </h2>
        <p className="text-lg text-ink-secondary mb-8 leading-relaxed">
          Live-Demo mit Ihren typischen Workflows. Wenn es passt, bekommen Sie einen Test-Account und können
          14 Tage mit Ihrem Bestand testen — keine Kreditkartendaten.
        </p>
        <a
          href={DEMO_MAIL}
          className="inline-flex items-center gap-2 px-8 py-4 bg-rolle-verwalter text-white rounded-xl hover:opacity-90 transition-opacity font-semibold text-base shadow-sm"
        >
          Demo buchen <ArrowRight className="w-4 h-4" />
        </a>
        <div className="mt-6 text-sm text-ink-muted">
          Oder direkt: <a href="mailto:lenn-dev@proton.me" className="text-rolle-verwalter underline">lenn-dev@proton.me</a>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line bg-surface py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-ink-muted">
        <div>© {new Date().getFullYear()} Reparo — Schadensmanagement für Hausverwaltungen</div>
        <div className="flex items-center gap-6">
          <Link href="/" className="hover:text-ink">Für Handwerker</Link>
          <Link href="/login" className="hover:text-ink">Anmelden</Link>
        </div>
      </div>
    </footer>
  )
}
