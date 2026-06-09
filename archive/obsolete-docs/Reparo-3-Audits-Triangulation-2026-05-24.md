# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Reparo — 4-Audits-Triangulation 2026-05-24

> Vier unabhängige UX-Audits, parallel ohne Wissen voneinander geschrieben:
> Cowork (Live-Browser-Tour + früherer Kontext), Claude Code (Code-Inspektion +
> DB-Snapshot), ChatGPT (Konzept + Strategie), Senior UX Designer (Design-System
> + Target-Group-Fit). Diese Datei trianguliert die vier Meinungen.

## Methodik

| Auditor | Stärke | Schwäche |
|---|---|---|
| **Cowork** | Live-Browser-Tour, visuelle Pain-Points, Cross-File-Konsistenz (Sales-Material) | Nur 1 Rolle (HW) live gesehen, viel aus Code abgeleitet |
| **Claude Code** | Tiefste Code-Inspektion (LOC-Counts, tote Routen, DB-Stand) | Keine Live-Klicks, kein visueller Eindruck |
| **ChatGPT** | Strategische Brille, B2B-Erfahrung, ehrlich-kritisch | Kein Code-Zugriff, nur Feature-Liste, kann nicht im Browser klicken |
| **Senior UX Designer** | Design-System-Reife, Target-Group-Fit pro Rolle, Enterprise-Vertrauen | Vermutlich kein tiefer Live-Test, eher Heuristik aus Erfahrung |

Vier unterschiedliche Linsen auf das gleiche Produkt — Quad-Konvergenz = höchste Aussagekraft.

---

## QUAD-KONVERGENZ — alle vier Auditoren sagen das Gleiche (höchste Konfidenz!)

### 0. „Nicht weiter Features bauen — fokussieren!" (4/4)

- Cowork: implizit (Sprint-Listen wurden zu lang)
- CC: „Reparo ist näher an ‚ready' als die Sprint-Anzahl suggeriert. Was fehlt, ist Aufräumen — kein neuer Code."
- ChatGPT: „Ich würde Reparo jetzt nicht weiter mit Features aufblasen."
- Designer: „Reduktion, Fokus, Ruhe, Konsistenz, Vertrauenswirkung."

**→ Konsens-Strategie: Sprint R (Aufräumen) ist die einzig richtige Antwort jetzt. Keine neuen Features für 2-3 Wochen.**

### 0a. Visuelles Design-System fehlt (4/4)

- Cowork: Sprint M Spec mit Tokens
- CC: „Drift überall, HW-Hero noch nicht angepasst auf Sprint L Array"
- ChatGPT: implizit „Buzzword-Overload, gleich laute Elemente"
- Designer: **„kein echtes visuelles System"** — explizit als Kern-Problem benannt

**→ Sprint M muss aufgebohrt werden, nicht nur Token-Cleanup sondern echtes Design-System inkl. Component-Library, State-Design, Hierarchie-Regeln.**

## TRIPLE-KONVERGENZ — 3 von 4 Auditoren

**Diese Findings sind mit höchster Sicherheit echt. SOFORT FIXEN.**

### 1. 🚨 Pricing-Inkonsistenz (CRITICAL — 3 Varianten in der Wildnis)

- **Landing `/hausverwaltungen`**: Starter 49 €/Mon · Pro 149 €/Mon · Enterprise auf Anfrage
- **Sales-Deck + One-Pager + Calculator**: Starter 1,29 €/Wohnung · Pro 0,89 €/Wohnung · Custom
- **Startseite FAQ** (von ChatGPT entdeckt): „Provision pro Auftrag, keine monatliche Grundgebühr"

Drei verschiedene Geschäftsmodelle, alle live. Verwalter würden in 30 Sek das Vertrauen verlieren.

**Sofort-Maßnahme:** Lennart entscheidet 1 Modell, alle 3 Quellen angleichen.
Siehe `CRITICAL-Pricing-Konflikt-2026-05-24.md` für Optionen.

### 2. Wording-Konsistenz fehlt überall

- Cowork: „Laufende Aufträge" zeigt Erledigte, „Mueller Sanitaer" mit Umlaut-Issue, toter `dringlichkeit`-Step im Wizard
- CC: HW-Hero nutzt `profile.gewerk` statt `handwerker_gewerke[]`
- ChatGPT: „Handwerker/HW/Auftrag/Ausschreibung/Auktion/Ticket nicht wild mischen"

**Sofort-Maßnahme:** 1 Wording-Cleanup-Pass über alle Strings.

### 3. Empty-States brauchen Next-Action

- Cowork: Sprint N spec
- CC: „Wartet auf deine Entscheidung" leer ohne CTA
- ChatGPT: „nicht nur ‚keine Tickets', sondern ‚Import starten / Testticket'"

### 4. Marketing-Landing solide, aber Conversion-Lücken

- Alle drei: Story-Arc gut
- CC: Pricing-Calculator existiert, ist aber nicht von Landing verlinkt
- ChatGPT: Beispielrechnung „Was spart Reparo pro Schaden?" fehlt
- Cowork: Demo-CTA ist `mailto:` statt Calendly

### 5. B2B-Vertrauen schwächer als nötig

- Cowork: DSGVO/RLS/TLS gut, aber Privat-Mail `lenn-dev@proton.me` wirkt unprofessionell
- CC: „Bereits Kunde? Anmelden" suggeriert es gäbe Kunden (bei Closed-Beta falsch)
- ChatGPT: SLA, Audit-Trail, Pilotkunden, Logo-Wand, Freigabegrenzen fehlen

---

## DUAL-KONVERGENZ — 2 von 3 Auditoren

### Cowork + ChatGPT (CC hatte keinen Live-Browser-Blick)

- Demo-CTA `mailto:` statt Calendly
- Direkt-Mail wirkt unprofessionell
- Sales-Pricing-Calculator existiert als perfekt funktionierendes Tool

### CC + ChatGPT (B2B + Code-Tiefe)

- **Mieter-Wizard zu komplex** (CC: 915 LOC; ChatGPT: 6 Schritte zu viel)
- **Verwalter-Statuslogik zu grob** (CC: kein Sort-Toggle; ChatGPT: 10 Status-Zustände statt 4)
- **KI-Animation 5 Sek wartet** (CC findet's nervig; ChatGPT: Mieter starrt 5 Sek ins Loading)
- **Notfall vs. Standard-Schaden** (CC: Dringlichkeit ohne Erklärung; ChatGPT: separater Flow nötig)
- **Reporting-Lücken** (CC: keine Zeitraum-Filter; ChatGPT: kein Eigentümer-Reporting)

### CC + Cowork (Code-Detailblick)

- **HW-Hero nutzt single `gewerk`** statt `handwerker_gewerke[]` Array — Drift nach Sprint L
- **Wohnungen-Migration noch nicht überall integriert** (Sprint I)

---

## NUR EIN AUDITOR — die Mehrheit ist trotzdem oft richtig

### Nur Cowork (Live-Browser-Visuelles)

- „Mueller Sanitaer" Umlaut-Issue im Test-Profil
- „Angebotstreue 100%" ohne Tooltip

### Nur CC (Code-Tiefe — sehr wertvoll!)

- **🔴 6 tote HW-Routen** (`/diagnosen`, `/termine`, `/zeitplan`, `/zeitslots`, `/auftraege`, `/verfuegbarkeit`) — nicht in Sidebar erreichbar
- **🔴 Verwalter-Wizard ist Code-Duplikat des Mieter-Wizards** (361 + 915 LOC) — Pflege-Risiko
- **🔴 2 parallele Zeit-Konzepte:** Kalender (677 LOC) + Zeitplan + Termine (589 LOC)
- **🟠 Admin-Sidebar 4 Items, Code 8 Pages** — 4 unerreichbar
- **🟠 „Verwaltung"-Item in Admin-Sidebar** führt zu /dashboard-verwalter (semantisch verwirrend)
- **🟡 DB-Hygiene:** 2 Profile mit `rolle = null` (`demo.hw2`, `demo.hw3`)
- **🟡 `bewertungen` + `handwerker_stats` 0 rows** — Features im Code aber nie aktiviert
- **🟡 Mieter-Dashboard + /tickets duplizieren** Ticket-Cards
- **🟡 Mieter-Profil hat Adresse als Freitext** trotz `wohnungen`-Tabelle

### Nur ChatGPT (Strategie + B2B)

- **🔴 „Auktion" für Mieter problematisch** — sollte „Handwerker wird gesucht" heißen
- **🟠 SLA + Audit-Trail + Freigabegrenzen + Vier-Augen-Prinzip fehlt** für B2B-Vertrauen
- **🟠 Stammhandwerker vs. Marktplatz-Hybrid** — Verwaltungen wollen oft Stamm-HW als Default
- **🟠 Eigentümer-Reporting fehlt** (Casavi-Standard: Export, Historie, Nachweisbarkeit)
- **🟡 Kostenkontrolle:** Budget, Eigentümer-Zuordnung, Cap, Freigabegrenzen
- **🟡 „100% Auftragswert" + 5% Provision = widersprüchlich**
- **🟡 18 Sprints in 3 Tagen = feature-verliebt** — strategisch Fokus verlieren
- **🟡 KI/Smart/Auktion = Buzzword-Overload** — B2B-Kunden kaufen Ergebnisse
- **🟢 Strategische Pilot-Metriken:** 100 Wohnungen, 20 Schäden, 5 HW, 30 Tage; Zeit-bis-Vergabe, Zeit-bis-Termin, Kosten/Schaden, Zufriedenheit

---

## NEUE FINDINGS NUR vom Designer (4. Audit, einzigartiger Wert)

### 🚨 Verwalter-Design-Fit = 5.5/10 — größtes UX-Problem

**Designer-Insight:** Verwalter ist die zahlende Buyer-Rolle (B2B), aber das Design ist für sie am schlechtesten gestaltet.

> „Aktuell vermittelt Reparo eher ‚innovatives SaaS' als ‚stabile Arbeitsplattform'."

Verwalter brauchen:
- Operative Ruhe (nicht Dynamik)
- Klarheit (nicht Innovation)
- Belastbarkeit (nicht Trendiness)
- Nachvollziehbarkeit (nicht Visuals)

Aktuell: zu modern, zu verspielt, zu startup-artig.

**→ Cowork-Bewertung der Sprint-K-Landing (9/9/9) muss differenziert werden:**
- Marketing-Landing ist gut so wie sie ist (Conversion-orientiert)
- ABER der Verwalter-Arbeitsbereich (Dashboard, Tickets, Marktplatz) muss anders aussehen — ruhiger, professioneller, weniger laut

### Target-Group-Fit-Matrix (nur Designer hat das)

| Rolle | Design-Fit | Hauptproblem |
|---|---|---|
| Handwerker | 8/10 | Bronze/Silber/Gold zu „Uberisierung" |
| Mieter | 7.5/10 | „Auktion" zu plattform-technisch, Wizard zu KI-lastig |
| **Verwalter** | **5.5/10** ⚠️ | zu startup-bunt, zu wenig Enterprise-Ruhe |
| **Admin** | **5/10** ⚠️ | Mission-Control fehlt, Analytics-Playground statt Steuerzentrale |

### Karten-Überladung (nur Designer)

> „Zu viele Inhalte sitzen in separaten Cards. Dadurch entstehen visuelle Fragmentierung, fehlende Ruhe, Dashboard-Unordnung. Nicht alles braucht eine Card."

→ Sprint M sollte „Card-Reduktion" als explizites Ziel haben.

### „Reputation statt Level-System" (nur Designer — konkreter Vorschlag)

Statt „Bronze/Silber/Gold" mit Multiplikator:
- **„Vertrauter Partner"** (10+ erledigte Aufträge)
- **„Top-Partner"** (50+ Aufträge, Bewertung ≥4.7)
- **„Stamm-Partner"** (mit dieser Verwaltung gearbeitet)

Mechanisch ähnlich, semantisch professioneller. **Konkreter Sprint AC-Kandidat.**

### State-Design professionalisieren (nur Designer)

Loading/Error/Warning/Konflikt/Eskalation/Success aktuell ad-hoc. Brauchen System:
- Standard-Loading-Skeleton
- Standard-Error-Card (mit Retry + Support-Link)
- Warning-Banner (gelb, dezent, dismissable)
- Konflikt-Modal (z.B. „2 Verwalter bearbeiten gleichzeitig")
- Eskalations-Marker (rot, prominent)
- Success-Toast (grün, 3 Sek autodismiss)

→ Teil von Sprint M (Design-System-Erweiterung)

## DIVERGENZ — Auditoren widersprechen sich

### Bronze/Silber/Gold-Gamification (3 vs 1 → eher fixen)

- **Cowork**: „motivierend, on point" (8/10)
- **CC**: „Lehrbuch-Empty-State, Gamification-Signal sichtbar"
- **ChatGPT**: „wirkt gamifiziert und potenziell unseriös, Lieferdienst-Mechanik"
- **Designer**: „darf nicht wirken wie Lieferdienst-Ranking, Uberisierung, Billigplattform"

**Bewertung mit 4. Audit:** 3-zu-1 für „problematisch". Cowork war zu optimistisch. **Klare Empfehlung:** Sprint AC umsetzen — rebrand zu „Partner-Stufen" (Vertrauter Partner / Top-Partner / Stamm-Partner). Mechanik bleibt, Wording wird Enterprise-tauglich.

### Reparo-Reife für Beta

- **Cowork**: „nach 18 Sprints überraschend solide"
- **CC**: „Beta-launchable: ja. Reparo ist näher an ‚ready' als die Sprint-Anzahl suggeriert"
- **ChatGPT**: „aktuell noch eher Pre-Beta-Prototyp mit vielen Modulen als reife B2B-SaaS"

**Bewertung:** Cowork + CC sehen die Code-Realität, ChatGPT die Außenwirkung. **Beide haben recht:**
- Code-Stand: Beta-launchable ✓
- Marktreife-Außenwirkung: noch nicht da (Pricing-Chaos, fehlende B2B-Trust-Signale)

→ Konsens: Beta JA mit 3-5 Vertrauten, Cold-Outreach NEIN bis Trust-Pack steht.

---

## MASTER-ACTION-LISTE — sortiert nach Severity und Konvergenz

### 🚨 CRITICAL (Triple- oder mehrfach-konvergent)

| # | Item | Aufwand | Sprint |
|---|---|---|---|
| 1 | **Pricing-Vereinheitlichung** (3 Quellen abgleichen) | 1h Lennart-Entscheidung + 30 Min Edits | **Sprint R** |
| 2 | **Tote HW-Routen** (droppen oder verlinken) | 30 Min CC | **Sprint R** |
| 3 | **Wizard-Duplikat Verwalter↔Mieter** auflösen | 2h CC (Refactor) | **Sprint R** |
| 4 | **Mieter-Wizard ohne Foto = nur Regex** (Hinweis prominenter, KI parallelisieren) | 1h CC | **Sprint R** |
| 5 | **„Auktion" für Mieter** → „Handwerker wird gesucht" umlabeln | 30 Min CC | **Sprint R** |
| 6 | **Bronze/Silber/Gold → „Partner-Stufen" rebrand** (3-zu-1 Audit-Konsens) | 1h CC | **Sprint AC** (neu) |
| 7 | **Verwalter-Bereich beruhigen** (Karten-Reduktion, Hierarchie schärfen, Enterprise-Look) | 3-4h CC | **Sprint AB** (neu) |
| 8 | **Vergabe-Regression Hotfix** (Lennart-Feedback 25.05.) | 1-2h CC | **Sprint AA** (neu) |

### 🔴 HIGH (Dual-konvergent oder strategisch)

| # | Item | Aufwand | Sprint |
|---|---|---|---|
| 6 | Admin-Sidebar erweitern um 4 fehlende Pages | 15 Min CC | Sprint R |
| 7 | Wohnungen-Migration angewandt (war Sprint I, ist offen für 1 HW) | 5 Min Cowork (MCP) | sofort |
| 8 | Pricing-Calculator von Landing verlinken | 10 Min CC | Sprint R |
| 9 | Verwalter-Tickets Sort-Toggle | 30 Min CC | Sprint R |
| 10 | Reporting Zeitraum-Filter | 1h CC | Sprint R |
| 11 | Marketing-CTA „Bereits Kunde" → „Schon ein Test-Account?" | 5 Min CC | Sprint R |
| 12 | Verwalter-Statuslogik (10 Zustände statt 4) | 3-4h CC | **Sprint U (Konzept)** |
| 13 | B2B-Trust: SLA + Audit-Trail + Freigabegrenzen + Vier-Augen | groß | **Sprint T (Konzept)** |

### 🟡 MEDIUM (single-audit aber konkret)

| # | Item | Aufwand | Sprint |
|---|---|---|---|
| 14 | Eigentümer-Reporting (Export, Historie, Nachweisbarkeit) | groß | Sprint W (Konzept) |
| 15 | Stamm-HW vs. Marktplatz-Hybrid | konzept | Sprint V (Konzept) |
| 16 | Mieter-Profil mit `wohnungen`-Tabelle integrieren | 1h CC | Sprint R |
| 17 | HW-Hero auf `handwerker_gewerke[]` umstellen | 15 Min CC | Sprint R |
| 18 | Mieter-Dashboard + /tickets Duplikat auflösen | 20 Min CC | Sprint R |
| 19 | KI-Animation kürzen / parallelisieren | 30 Min CC | Sprint R |
| 20 | Notfall-Flow visuell abtrennen (Wasserschaden ≠ Hahn) | 1h CC | Sprint X (Konzept) |

### 🟢 LOW (Polish)

| # | Item | Aufwand |
|---|---|---|
| 21 | DB-Cleanup `rolle IS NULL` Profile | 5 Min Cowork |
| 22 | Test-Account-Umlaute (Mueller→Müller, Sanitaer→Sanitär) | 5 Min Cowork |
| 23 | „Angebotstreue 100%" Tooltip | Sprint N6 |
| 24 | Karten-Page redundanter Hero raus | 10 Min CC |

---

## Strategische Empfehlung (aus ChatGPT, Cowork stimmt zu)

**„Nicht weiter mit Features aufblasen. Nächste 2 Wochen nur Core-Workflow + Vertrauen + Conversion."**

Reihenfolge nach Urlaub:
1. **Pricing-Entscheidung** (Lennart, 30 Min)
2. **Sprint R: Aufräumen** (CC, ~6-8h) — alle 🚨 CRITICAL + 🔴 HIGH-Quick-Fixes
3. **Beta-Tester einladen** (3-5 Vertraute, 14 Tage testen)
4. **Während Beta:** Sprint T (B2B-Trust) + Sprint U (Statuslogik) konzeptionell ausarbeiten — NICHT bauen
5. **Pivot-Entscheidung** mit Beta-Daten (siehe `KONZEPT-pivot-mieter-raus-b2b-fokus.md`)
6. **Dann erst:** Sprint T/U/V/W/X umsetzen je nach Pivot-Outcome

**Pilot-Metriken (ChatGPT-Vorschlag, sehr stark):**
- 100 Wohnungen
- 20 Schäden
- 5 Handwerker
- 30 Tage
- Messen: Zeit bis Vergabe, Zeit bis Termin, Kosten/Schaden, Mieter-Zufriedenheit, Verwalter-Aufwand

→ Das sollte das offizielle Beta-Setup werden.

---

## Was Cowork als nächstes liefert

- ✅ Dieses Dokument (du liest gerade)
- ⏭ Pricing-Memo um die 3. Variante (FAQ) erweitern
- ⏭ Sprint-R-Spec (Aufräumen + Pricing + Wording + Quick-Fixes 1-19)
- ⏭ B2B-Trust-Roadmap-Memo (Sprint T/U/V/W/X als Konzept für Post-Urlaub)

CC kann während Urlaub Sprint-R abarbeiten — wenn du den Block pastest.
