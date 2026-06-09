# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint AB — Verwalter-Bereich beruhigen (Enterprise-Look)

> Designer-Audit-Finding (24.05.2026): Verwalter-Design-Fit nur 5.5/10.
> Verwalter ist die zahlende Buyer-Rolle aber das Design ist für sie am
> wenigsten geeignet. Zu modern, zu verspielt, zu startup-artig.
>
> Aufwand: ~3-4h Claude Code. Eigenständig.

## Designer-Audit-Quote

> „Verwalter brauchen operative Ruhe, Klarheit, Kontrolle, Priorisierung,
> Nachvollziehbarkeit. Aktuell vermittelt Reparo eher ‚innovatives SaaS' als
> ‚stabile Arbeitsplattform'."

## Ziel

Verwalter-Arbeitsbereich (`/dashboard-verwalter/*`) auf Enterprise-Niveau bringen:
- Weniger Farben, weniger Highlights, weniger Bewegung
- Tabellen-Look statt Card-Look bei Listen
- Hierarchie schärfen: ein Hauptaktion pro Screen, Rest visuell ruhig
- Keine Gamification, kein „SaaS cool"

**Wichtig:** Marketing-Landing `/hausverwaltungen` bleibt wie ist (Conversion-orientiert, darf Wow-Faktor haben). NUR Arbeitsbereich beruhigen.

## Code-Lokationen

- `app/dashboard-verwalter/page.tsx` — Dashboard
- `app/dashboard-verwalter/tickets/page.tsx` — Tickets-Liste
- `app/dashboard-verwalter/marktplatz/page.tsx` — Marktplatz
- `app/dashboard-verwalter/handwerker/page.tsx` — Verzeichnis
- `app/dashboard-verwalter/reporting/page.tsx` — Reporting

## Spec

### Phase AB1 — Dashboard beruhigen (~1h)

**Vorher:** 4 KPI-Cards in greller Farbe + Throughput-Chart-Card + „Wartet auf deine Entscheidung"-Card + Action-Buttons → 4-7 konkurrierende Elemente.

**Nachher:**
- Header: nur Begrüßung + 1 Primary-CTA („+ Neues Ticket")
- KPI-Strip: 1 Zeile, klein, gedämpfte Farben (kein Akzent-Gold/Grün)
- Throughput-Chart: einklappbar, default eingeklappt
- „Wartet auf deine Entscheidung": prominent als einzige Hauptaktion mit größerer Card
- Aktuelle Tickets: Tabellen-Look (nicht Card-pro-Zeile)

Designer-Inspiration: Linear, Notion, Pipedrive — nicht Stripe-Dashboard (zu trendy).

### Phase AB2 — Tickets-Liste auf Tabelle umstellen (~1h)

**Vorher:** Card-pro-Ticket mit Padding, Schatten, Farben.

**Nachher:** Dichte Tabelle mit Spalten:
- Status (kleiner farbiger Dot, kein Badge)
- Titel (groß, klickbar)
- Wohnung
- Eingang
- Letzte Aktion (mit „vor 2h"-Format)
- Aktion-Icon-Buttons (Vergeben, Details)

Filter-Chips oben können bleiben aber gedämpfter (kein Highlight-Gold).

### Phase AB3 — Marktplatz-Card-Reduktion (~45 min)

CC's Befund: 503 LOC, mehrere KPI-Kacheln + virtueller-Wochenstruktur-Generator + Gebot-Modals + Filter — zu viel auf einem Screen.

**Nachher:**
- KPI-Kacheln: in eine Zeile schrumpfen oder ganz weg
- Slot-Liste: Tabellen-Look statt Card-pro-Slot
- Wochenstruktur-Generator: in Akkordeon „Wochenstruktur planen" (default zu)
- Filter: oben, dezent

### Phase AB4 — Reporting professionalisieren (~30 min)

**Vorher:** KPIs als bunte Cards, vermutlich mit Smiley-/Trend-Pfeilen.

**Nachher:**
- Saubere Datentabelle
- Zeitraum-Filter (Sprint R Phase 7a)
- Export-Button prominent (PDF/CSV) — auch wenn Funktion noch nicht da, Button vorbereiten
- Keine Charts-Spielerei, max 1 Trend-Chart pro Sektion

### Phase AB5 — Farb-Diät (~30 min)

**Aktuelle Palette (zu viel):**
- Reparo-Green Primary
- Gold-Akzent
- Cream-Background
- mehrere Status-Farben (rot, gelb, grün, blau)

**Designer-Empfehlung:**
- Reparo-Green nur für Primary-Action (1 pro Screen)
- Gold nur für Highlights mit echter Bedeutung (z.B. „BELIEBT"-Tag im Pricing)
- Status-Dots minimal: nur rot/gelb/grün, klein
- Sonst: Graustufen + Reparo-Dark als Text-Farbe

→ CC soll in `tailwind.config.ts` die Akzent-Verwendung dokumentieren und in den Verwalter-Pages reduzieren.

### Phase AB6 — Smoke-Test + Commit

Vergleich: vorher/nachher-Screenshots in `STYLE-AUDIT.md` als Beleg.

Commit: `feat(verwalter): Bereich beruhigt — Enterprise-Look (Sprint AB)`

## Constraints

- Pricing-Engine nicht anfassen
- Funktionalität darf nicht leiden (Verwalter muss alle Tasks weiter erreichen)
- Bestehende E2E-Tests müssen grün bleiben
- Sprint K Landing-Page NICHT anfassen (die ist bewusst conversion-orientiert)
- A11Y (Sprint P) nicht zurückrollen

## Erfolg

- Verwalter sagt nicht mehr „wirkt wie Startup-Tool"
- Designer-Audit-Score Verwalter steigt von 5.5/10 auf ≥7.5/10 (next Audit)
- Tabellen-Look wirkt vertrauter für Wohnungswirtschafts-Anwender

## Erster Schritt

Phase AB1 (Dashboard beruhigen) — sichtbarster Impact für Sales-Demos.
