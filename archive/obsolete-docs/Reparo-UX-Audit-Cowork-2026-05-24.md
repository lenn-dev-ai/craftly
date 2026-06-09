# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Reparo UX-Audit — Cowork-Perspektive (24.05.2026)

> Audit aus 4 Rollen-Perspektiven nach 18 Code-Sprints. Bewertung pro Rolle:
> Nutzerfreundlichkeit, Intuitivität, Design.
>
> **Methodik:**
> - **Handwerker-Rolle**: Live-Tour via Chrome (Browser war HW-Session eingeloggt)
> - **Verwalter/Mieter/Admin**: aus Code-Knowledge + UI-Inspektionen aus früheren Sessions
> - **Marketing-Landing**: Live-Tour
>
> Findings ehrlich auch bei eigenen Cowork-Specs. Kritisches in 🚨 markiert.
> Diese Datei ist Cowork-Meinung. CC + ChatGPT machen unabhängige 2./3. Meinung.

---

## TL;DR

**Reparo ist nach 18 Sprints überraschend solide.** Die Story trägt, die Mechanik
funktioniert (Marktplatz, Auktion, Voice-AI-Backend, A11y), die Sprint-K-Landing
sieht aus wie ein 6-stelliger Startup. Drei Themen blockieren aber den Sales-Start:

1. 🚨 **Pricing-Inkonsistenz** zwischen Landing (49/149€) und Sales-Material
   (1,29/0,89 €/Wohnung) — siehe `CRITICAL-Pricing-Konflikt-2026-05-24.md`
2. ⚠️ **Test-Daten überall** statt sauberer Demo-Mocks (z.B. Demo-Tickets von
   Cowork in test.verwalter-Account)
3. ⚠️ **Mehrere kleinere Nomenklatur-Bugs** („Laufende Aufträge" zeigt erledigte)

Alles drei lösbar in ~3-4h Arbeit.

---

## 🛠 Handwerker-Perspektive (Live-getestet)

### Was gut funktioniert ✅

1. **Sichtbarkeits-Stufe Bronze/Silber/Gold mit Multiplikator** — sofort sichtbar
   oben im Dashboard, klare Mechanik („×1.05 Silber, ×1.10 Gold"), motivierender
   Hinweis „Noch 50 Punkte zur Silber-Stufe". Gamification on point.
2. **Empty-State Marktplatz** ist intelligent:
   „Aktuell keine Ausschreibungen ... 1 weitere Auktion(en) passen nicht zu
   deinen Gewerken (Sanitär & Heizung). [Gewerke ändern]"
   → Sprint-N-Lieferung + Sprint-L-Filter zusammen ein WOW-Moment.
3. **Einnahmen-Seite** mit Yield-Management:
   - „Du bekommst den vollen Auftragswert (100%)" — sehr klares Wertversprechen
   - KPI-Strip (Stundensatz, aktive Slots, offene Anfragen, vergeben)
   - AI-Tipp „Noch 2 Slots bis zur optimalen Sichtbarkeit + Zeitslot erstellen-CTA"
   → Beste Page der App, fühlt sich wie professionelles Yield-Tool an.
4. **Profil-Page** mit Multi-Select Gewerke (Max 3) hat sinnvollen Hinweis-Text
   („wir wollen Spezialisten, keine Allrounder"). Counter „1 / 3 ausgewählt" hilfreich.
5. **Sidebar-Layout** klar gegliedert (Dashboard / Kalender / Karte & Route /
   Einnahmen + Sektion „Mein Bereich")

### Was nicht gut ist ⚠️

1. **Profile-Name „Mueller Sanitaer GmbH"** statt „Müller Sanitär GmbH" — Umlaute
   im Test-Account vermurkst. Nicht App-Bug aber wirkt unprofessionell beim Login.
2. **„Meine laufenden Aufträge"** zeigt einen Auftrag mit Status-Badge „Erledigt"
   → Nomenklatur falsch (sollte „Meine Aufträge" oder „Letzte Aufträge" sein).
3. **„Angebotstreue: 100 % · höher = besserer Bonus bei jedem Bid"** — was
   bedeutet „Angebotstreue" genau? Tooltip wäre Pflicht. Sprint-N6 fordert
   Form-Tooltips, aber Sichtbarkeits-Stufen-Box ist eine Info-Box, kein Form-Feld.
4. **„Offenes Potenzial: +0 €" mit „0 offene Slots"** — sagt nichts aus. Bessere
   Variante: „Wenn du 2 Slots öffnest, könntest du ca. X € verdienen".
5. **Profile-Page: keine sichtbare Speichern-Bestätigung beim Scrollen** — ist es
   Auto-Save? Nach jeder Änderung ein Toast wäre besser (Sprint N5 will das,
   möglicherweise schon implementiert für Profil-Save?).
6. **Gewerke-Checkbox-Visual** — selektiertes Gewerk hat einen Grün-Border, aber
   die Checkbox selbst hat orange/braunen Background — Farbinkonsistenz.

### Bewertung Handwerker-Rolle

| Kategorie | Note (1-10) | Begründung |
|---|---|---|
| Nutzerfreundlichkeit | **8** | Klare Pfade, gute CTAs, smarte Empty-States |
| Intuitivität | **7** | Sichtbarkeits-Stufen verständlich, aber „Angebotstreue" unklar |
| Design | **8** | Konsistent grün-cream, gute Hierarchie, Bronze-Box visuell stark |

---

## 🏢 Verwalter-Perspektive (aus Code + früheren Sessions)

### Was gut funktioniert ✅

1. **Sprint H KPI-Karten + Throughput-Chart** im Dashboard — zeigt sofort Wert
2. **Sprint G Verwalter-Wizard** „+ Neues Ticket" für telefonische Eingabe — kritisch
   für den Use-Case
3. **Sprint I Bulk-Wohnungs-Import** Excel/CSV — Onboarding-Beschleuniger
4. **Marktplatz-Filter** funktional (Audit-2 lobt die Filter+Suche)
5. **Sprint K B2B-Landing** unter `/hausverwaltungen` ist sehr cleanes Marketing

### Was nicht gut ist ⚠️

1. 🚨 **Pricing-Inkonsistenz** Landing vs. Sales-Material (siehe separates Memo)
2. **Filter-Persistence noch nicht überall** — Sprint Q1 hat das für Verzeichnis ↔
   Marktplatz gefixt, aber gibt's noch andere Pages mit Filtern?
3. **Reporting-Sektion** (laut Audit-1) hat Provision-Anzeige (5%) — aber wenn
   Reparo per Verwalter-Pauschale bezahlt wird, ist eine Provision-Logik ein
   Widerspruch. Konzept klären.

### Bewertung Verwalter-Rolle

| Kategorie | Note (1-10) | Begründung |
|---|---|---|
| Nutzerfreundlichkeit | **7** | Workflow klar, aber Pricing-Konflikt blockiert |
| Intuitivität | **8** | Wizard + KPIs + Marktplatz sind logisch verbunden |
| Design | **8** | Konsistent, Landing-Page besonders stark |

---

## 🏠 Mieter-Perspektive (aus Code + Audit-1/2)

### Was gut funktioniert ✅

1. **Mieter-Wizard 6 Steps** (foto → analyse → details → ort → zusammenfassung →
   gesendet) durchgängig implementiert
2. **KI-Analyse beim Foto-Upload** erkennt Gewerk + Dringlichkeit
3. **Sprint F Profil-Wohnung** als Default-Adresse im Wizard
4. **Fortschritts-Bar** im Wizard (1/5, 2/5, ...) gibt Orientierung
5. **Vorgang-Card inline** (Sprint E) statt separate Sicht

### Was nicht gut ist ⚠️

1. **Code-Smell**: `wizardSteps`-Array hat toten Eintrag `"dringlichkeit"` ohne
   eigenen UI-Block (Sprint M Phase M5 sollte das fixen — geprüft ob durch?)
2. **Mieter sieht Auktions-Status** (Feedback `a2f592dc`): „braucht der Mieter
   die Info dass eine Auktion läuft?" — Konzept-Frage offen.
3. **KI-Schnellauswahl-Sinnhaftigkeit** (Feedback `fbbf6c70`): „Hilft uns die
   Schnellauswahl wirklich?" — Konzept-Frage offen.

### Bewertung Mieter-Rolle

| Kategorie | Note (1-10) | Begründung |
|---|---|---|
| Nutzerfreundlichkeit | **8** | Wizard ist klar, Foto-Upload smooth |
| Intuitivität | **7** | KI-Analyse hilft, aber Auktions-Sicht verwirrt evtl. |
| Design | **8** | Step-Indicator gut, Karten-Layout sauber |

---

## 🛡 Admin-Perspektive (aus Code + Audit-1)

### Was gut funktioniert ✅

1. **Auto-Feedback-Loop** stündlich → Admin-Dashboard
2. **KI-Anomalie-Erkennung + Empfehlungen** (laut Audit-1) — ungewöhnliche
   Ticket-Mengen erkannt
3. **Activity-Page** mit 7-Tages-Trend + Peak-Detection
4. **System-Metrics** mit segmentierter Balken-Health-Bar
5. **Diagnose-Preise** als Admin-Tool — falls Diagnose-Aufträge bleiben

### Was nicht gut ist ⚠️

1. **Wenn Sprint C (Diagnose+Auftrag-Merge) durch ist**, dann ist `Diagnose-Preise`
   Admin-Tool obsolete — sollte versteckt oder umgewidmet werden.
2. **Informationsdichte** im Admin-Dashboard hoch (Audit-2) — Sprint Q2 soll das
   per Akkordeon entspannen. Wurde es?
3. **Rollen-Switcher** (Sprint O) — Admin sollte einfach in alle Rollen wechseln können.

### Bewertung Admin-Rolle

| Kategorie | Note (1-10) | Begründung |
|---|---|---|
| Nutzerfreundlichkeit | **7** | Viel Power, aber Informationsdichte hoch |
| Intuitivität | **6** | Nicht alle KPIs selbsterklärend, Tooltips fehlen |
| Design | **7** | Funktional, weniger schön als Verwalter-Landing |

---

## 🎯 Marketing-Landing-Perspektive (Live-getestet)

### Was gut funktioniert ✅

1. **Hero** „Schadensmanagement, neu gedacht" mit Subline „Vom Mieter-Anruf bis
   zur Handwerker-Rechnung" — Sales-Deck-konsistent, klares Wertversprechen
2. **3-Step-Story** (Verwalter trägt ein → Marktplatz → 1-Klick-Vergabe) mit
   Number-Circles — visuell stark, mittlere Box highlighted
3. **„So einfach geht es"** sehr klare Reihenfolge
4. **„Doodle-Style" Termin-Koordination** als Feature-Tag — interessanter Hook
5. **Sicherheits-Strip** (EU-Hosting, DSGVO, RLS, TLS 1.3) — Compliance prominent
6. **CTA „Demo buchen"** überall, plus Direkt-E-Mail-Link `lenn-dev@proton.me` —
   senkt Hemmschwelle für direkte Antwort
7. **Footer mit „© 2026 Reparo"** und Anmelden + Für Handwerker Links

### Was nicht gut ist ⚠️

1. 🚨 **Pricing-Tier-Block** widerspricht Sales-Material (siehe Memo)
2. **„Live-Demo mit Ihren typischen Workflows ... kein Kreditkartendaten"** —
   Tippfehler, sollte „keine Kreditkartendaten" sein
3. **Demo-Buchen-CTA** öffnet `mailto:` — kein Calendly-Link. Lennart muss vor
   Cold-Outreach Calendly einrichten und hier einbauen.
4. **Direkt-E-Mail `lenn-dev@proton.me`** ist eine Privat-Domain, wirkt nicht
   professionell für B2B-Sales. Sollte `lennart@reparo-app.de` werden sobald
   Resend-Domain verifiziert ist.
5. **Keine Logo-Galerie** „diese Verwaltungen vertrauen uns" — verständlich
   weil Pre-Beta, aber sobald 3-5 Kunden da sind: rein.

### Bewertung Marketing-Landing

| Kategorie | Note (1-10) | Begründung |
|---|---|---|
| Nutzerfreundlichkeit | **9** | Story klar, CTAs prominent, Scroll-Flow logisch |
| Intuitivität | **9** | Verwalter versteht in 30 Sek was Reparo macht |
| Design | **9** | Sehr cleanes Design, konsistent Reparo-Brand |

---

## 🚨 Gesamt-Risiko-Liste (sortiert nach Severity)

| # | Issue | Severity | Sprint/Fix |
|---|---|---|---|
| 1 | Pricing-Inkonsistenz Landing ↔ Sales | **CRITICAL** | Lennart-Entscheidung + 30 Min Cowork-Update |
| 2 | Tippfehler „kein Kreditkartendaten" auf Landing | low | CC-Edit (5 min) |
| 3 | Demo-Buchen-CTA → mailto statt Calendly | medium | Lennart muss Calendly anlegen |
| 4 | Direkt-Mail = Privat-Adresse (Proton) | medium | Resend-Domain verifizieren |
| 5 | „Meine laufenden Aufträge" zeigt Erledigte | medium | Nomenklatur-Fix (1h) |
| 6 | „Angebotstreue 100%" ohne Tooltip | low | Sprint N6 erweitern |
| 7 | „Offenes Potenzial +0 €" leer | low | Bessere Empty-State-Logik |
| 8 | Test-Accounts haben Umlaut-Probleme im Namen | low | Test-Daten-Update |
| 9 | Mieter sieht Auktions-Sicht (evtl. unnötig) | medium-konzept | Konzept-Entscheidung |
| 10 | Diagnose-Preise-Tool obsolete wenn Sprint C durch | low | UI-Cleanup nach Sprint C |

## Empfehlungen für Cowork-Nachtisch

Wenn Lennart will, kann Cowork sofort:
- **Tippfehler-Fix** vorbereiten als CC-Issue
- **Sprint R-Spec** für Pricing-Cleanup schreiben (sobald Lennart Option A/B/C wählt)
- **Sprint S-Spec** für Nomenklatur-Fixes
- **Demo-Account-Reset-SQL** für saubere Test-Daten

Ohne Lennart-Input: Pricing-Konflikt + Konzept-Fragen bleiben offen.
