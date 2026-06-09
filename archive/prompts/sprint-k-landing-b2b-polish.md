# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint K — Landing-Page B2B-Polish

> Reparo-Landing-Page so polishen dass sie für Cold-Outreach an Hausverwaltungen funktioniert.
> Sales-Material (Deck, One-Pager, Calculator) existiert — Landing muss konsistent sein.
> Aufwand: ~3-5h Claude Code. Eigenständig.

## Ziel

Die aktuelle Landing-Page (`reparo-app.netlify.app` oder dedizierte Marketing-Route, falls noch nicht: anlegen) erzählt eine kohärente Story für Hausverwaltungen, die nach Cold-Mail vorbeischauen.

## Code-Lokationen

- `app/page.tsx` — Root-Landing (oder wo immer die aktuelle Landing lebt)
- `app/marketing/page.tsx` — falls dedizierte Route gewünscht
- `components/marketing/*` — neue Komponenten
- Reuse: Tailwind ist eh im Repo, Farben aus brand-Palette (Reparo-Green #1a7a5a)

## Inhalt-Brief (Story-Arc kompatibel zu Sales-Deck)

### Hero
**Headline:** „Schadensmanagement, neu gedacht."
**Subline:** „Vom Mieter-Anruf bis zur Handwerker-Rechnung — in einem Tool."
**Eyebrow:** „FÜR HAUSVERWALTUNGEN"
**Primary CTA:** „30-Min-Demo buchen" → Calendly (oder Mailto vorerst)
**Secondary CTA:** „One-Pager als PDF" → Download

### Problem-Sektion
3 qualitative Pain-Cards (gleicher Inhalt wie Slide 2 vom Deck):
- Zu viel Zeit (Telefonieren, Koordination, Nachfassen)
- Zu wenig Vergleich (erstbester HW statt bester)
- Zu wenig Übersicht (Excel, E-Mails, Anrufe → Tickets verloren)

### Lösung-Sektion (3-Step mit Number-Circles)
1. Verwalter trägt ein (Wizard + KI)
2. Reparo macht Auktion (Marktplatz, Highlighted)
3. Sie vergeben mit 1 Klick

### USP-Sektion
„Vergessen Sie ‚ich frag mal Harald'." — gleiche 4-Punkte-Liste wie Slide 5

### Pricing
3 Tiers (Starter / Pro / Enterprise) wie Slide 8.
Link/Button: „Pricing-Calculator öffnen" → öffnet `/pricing-calculator` Route oder externer Link zur HTML-Datei

### Sicherheit-Strip
Kompakter 1-Liner-Strip mit 4 Icons:
- EU-Hosting
- DSGVO-konform
- RLS auf DB-Ebene
- TLS 1.3

### Final CTA
Großer Button: „Demo buchen" + Telefon/Mail darunter

## Implementations-Plan

### Phase K1 — Aktuellen Stand prüfen (15 min)
- Was steht aktuell auf `/` ?
- Gibt's schon eine Marketing-Route?
- Welche Komponenten existieren die wiederverwendbar sind?

### Phase K2 — Komponenten bauen (2h)
- `HeroSection.tsx`
- `PainCardsGrid.tsx`
- `SolutionFlow.tsx` (3 Number-Circles)
- `USPSection.tsx`
- `PricingTiers.tsx`
- `SecurityStrip.tsx`
- `FinalCTA.tsx`

Alle responsive, mobile-first.

### Phase K3 — Page-Assembly (1h)
- `app/marketing/page.tsx` (oder direkt `/`) komponiert die Komponenten
- Server-Component wenn möglich (Performance)
- Meta-Tags: Title, Description, OG-Image (kann später)

### Phase K4 — Existierender Login-Flow erhalten (30 min)
- Wenn `/` die Landing wird: bestehender Login-Button im Header bleibt
- „Login"-Link oben rechts → `/login`
- „Demo buchen"-CTA ist der primäre Conversion-Pfad

### Phase K5 — Smoke-Test + Commit (15 min)
- Lokaler Browser-Test mobile + desktop
- Commit: `feat(marketing): B2B-Landing für Hausverwaltungen (Sprint K)`

## Constraints

- Keine externen Marketing-Libs (kein Next-Animation-Heavy)
- Existierende Auth-Routes nicht anfassen
- Pricing-Engine nicht anfassen
- Mobile-First (Cold-Mail-Empfänger öffnet oft mobil)
- Performance: Landing muss <2s laden (kein Bundle-Bloat)

## Bezug zu Sales-Material

Die Landing ist nur die *erste* Berührung. Die echte Conversion läuft via:
1. Cold-Mail (siehe `Reparo-Sales-Playbook.md`)
2. Landing als Vertrauens-Anker
3. Demo-Call (siehe Demo-Skript im Playbook)
4. Trial-Onboarding

Daher: Landing muss nicht alles erzählen — sie muss „seriös genug" wirken damit ein Verwalter den Demo-Button drückt.

## Erfolg

- Verwalter klickt Cold-Mail-Link → landet auf Reparo → versteht in 5 Sekunden was wir machen → klickt „Demo buchen"
- Mobile-Smoke: alle Sektionen lesbar auf 390px
- Lighthouse Score >85 (mobile)

## Erster Schritt

Phase K1: Aktuelle Landing-Page anschauen, dokumentieren was da ist.
