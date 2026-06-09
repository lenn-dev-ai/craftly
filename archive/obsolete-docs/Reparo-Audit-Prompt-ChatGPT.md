# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# ChatGPT-Audit-Prompt für Reparo (3. unabhängige Meinung)

> Pastet du in ChatGPT (GPT-5 oder besser). ChatGPT bekommt alle Infos die er
> braucht, plus die Aufforderung zur eigenen Meinung — ohne Cowork- oder
> CC-Findings.

## Wie verwenden

1. Logge dich in ChatGPT ein (GPT-5 oder Plus-Account empfohlen)
2. Pastet du den ganzen Block unten
3. ChatGPT braucht ~10 Min für ein gutes Audit
4. Antwort kopieren in `Reparo-UX-Audit-ChatGPT-2026-05-24.md`
5. Dann hast du 3 Audits zum Vergleich

---

## Paste-Block für ChatGPT

```
Du bist ein erfahrener Senior UX-Designer mit Fokus auf B2B-SaaS-Plattformen
für die Wohnungswirtschaft. Ich brauche ein detailliertes, ehrliches UX-Audit
meiner Plattform "Reparo" — bitte ohne Sales-Brille, knallhart kritisch wo nötig.

═══════════════════════════════════════════════════════
WAS REPARO IST
═══════════════════════════════════════════════════════

Reparo ist eine SaaS-Plattform für Hausverwaltungen, die Schadensmeldungen
von Mietern an Handwerker via Auktions-Marktplatz vergibt.

Drei Nutzerrollen plus Admin:
- MIETER: meldet Schaden via Wizard (Foto + KI-Analyse + Adresse)
- VERWALTER: nimmt Tickets entgegen, startet Auktion, vergibt an besten HW
- HANDWERKER: sieht Marktplatz mit passenden Aufträgen, bietet Preis+Termin
- ADMIN: KPIs, Feedback-Triage, System-Health

Stand: 24.05.2026. Pre-Beta. 18 Code-Sprints in 3 Tagen abgearbeitet
(Wizard, KPIs, Bulk-Import, B2B-Landing, A11y, Mobile-Polish, Filter-Persistence,
Empty-States, Voice-AI-Backend).

═══════════════════════════════════════════════════════
URLS UND TEST-ZUGÄNGE
═══════════════════════════════════════════════════════

Production: https://reparo-app.netlify.app
B2B-Landing: https://reparo-app.netlify.app/hausverwaltungen
Login: https://reparo-app.netlify.app/login

Test-Logins (alle Passwort: BetaReparo2026!):
- test.verwalter@craftly-test.de
- test.handwerker@craftly-test.de
- test.mieter@craftly-test.de

(Falls du als ChatGPT keinen Browser hast: nimm an dass die App existiert
wie unten beschrieben, und audite konzeptionell. Wenn du Browsing/Vision
hast: schau die Landing-Page wirklich an.)

═══════════════════════════════════════════════════════
FEATURE-INVENTAR (was implementiert ist)
═══════════════════════════════════════════════════════

HANDWERKER-Bereich:
- Dashboard mit Sichtbarkeits-Stufe Bronze/Silber/Gold + Smart-Score-Multiplikator
- 3 KPI-Karten: Verfügbar im Radius / Meine Aufträge / Bewertung
- 4 Aktions-Tiles: Zeitslots / Kalender / Einnahmen / Profil
- Aktuelle Ausschreibungen (Liste, Smart-Score-sortiert)
- Marktplatz-Filter auf Stamm-Gewerke (1-3 wählbar im Profil)
- Karte & Route (OpenStreetMap mit Markern)
- Einnahmen-Dashboard mit Yield-Management
- Verdienst-Rechner mit Reparo-Provision-Hinweis (5%)

VERWALTER-Bereich:
- Dashboard mit 4 KPIs + Throughput-Chart letzte 4 Wochen
- Tickets-Liste mit Filter (Status, Typ)
- "+ Neues Ticket"-Wizard für telefonische Eingabe
- Handwerker-Verzeichnis mit Suche+Filter
- Marktplatz für Zeitslots der HW
- Properties: Excel/CSV-Bulk-Import von Wohnungen
- Reporting mit Provisions-Auflistung

MIETER-Bereich:
- Dashboard mit Vorgangs-Karten (Fortschrittsleiste Gemeldet→Auktion→Reparatur→Fertig)
- 6-Step-Wizard: Foto → KI-Analyse → Details → Ort (Default aus Profil) → Zusammenfassung → Gesendet
- Mein Profil mit Wohnungs-Adresse

ADMIN-Bereich:
- KI-Anomalie-Dashboard
- 7-Tage-Activity mit Trend + Peak-Detection
- Feedback-Triage mit Auto-Loop-Aggregation
- Nutzer-Verwaltung
- Diagnose-Preise-Verwaltung
- System-Metrics mit Health-Bars

LANDING-PAGE /hausverwaltungen:
- Hero "Schadensmanagement, neu gedacht"
- 3-Step-Story (Verwalter trägt ein → Marktplatz → 1-Klick)
- Pricing: Starter 49€, Pro 149€, Enterprise Auf Anfrage
- Security-Strip (EU-Hosting, DSGVO, RLS, TLS)
- Final CTA "Demo buchen"

═══════════════════════════════════════════════════════
DEINE AUFGABE
═══════════════════════════════════════════════════════

Schreibe ein UX-Audit mit folgender Struktur:

1. **TL;DR** (3-5 Sätze)
2. **Pro Rolle** (Handwerker, Verwalter, Mieter, Admin):
   - 5-8 Punkte was gut funktioniert
   - 5-8 Punkte was nicht gut ist
   - Bewertung 1-10 für Nutzerfreundlichkeit, Intuitivität, Design
3. **Marketing-Landing-Audit**
4. **Top 5 kritische Findings** sortiert nach Severity
5. **Konkrete Quick-Fixes** (1-2h Arbeit) die größten Impact hätten
6. **Strategische Empfehlungen** (was du als CEO machen würdest)

Länge: 4-8 Seiten, kondensiert.
Sprache: Deutsch.
Ton: Professionell, kritisch wo nötig, konkret immer.

═══════════════════════════════════════════════════════
KRITIK-FOKUS — bitte ungeschont
═══════════════════════════════════════════════════════

Ich will EHRLICHE Kritik. Wenn etwas:
- Nicht intuitiv ist → sag es
- Inkonsistente Wording hat → sag es
- Tote Features hat → sag es
- "Studentisch" wirkt → sag es
- Konzept-Lücken hat → sag es

Vergleiche gerne mit etablierten B2B-Player im Markt (Casavi, Wohnmonitor,
Hausgold, vermietet.de) — wo ist Reparo besser, wo schlechter?

═══════════════════════════════════════════════════════
WICHTIG
═══════════════════════════════════════════════════════

- Du bist DRITTER Auditor. Zwei andere (Cowork + Claude Code) haben schon
  geaudited — ich vergleiche die drei Meinungen. Bilde dir eine EIGENE Meinung
  ohne zu wissen was die anderen gesagt haben.
- Spekuliere nicht über nicht-existierende Features. Bleib bei dem was im
  Feature-Inventar oben steht.
- Wenn du Browser-Tools hast: schau die Landing-Page wirklich an, dann ist
  dein Audit fundierter.

Bitte starte mit der TL;DR.
```

---

## Was Lennart dann machen sollte

1. **Ergebnis von ChatGPT kopieren** in `Reparo-UX-Audit-ChatGPT-2026-05-24.md`
2. **3 Audits parallel lesen** (Cowork + CC + ChatGPT)
3. **Triangulation**:
   - Konvergenz-Findings (alle drei sagen das gleiche) → SOFORT FIXEN
   - 2-von-3-Findings → wahrscheinlich richtig, einplanen
   - 1-von-3-Findings → ggf. blinder Fleck, oder Fehlinterpretation — Lennart entscheidet
4. **Pricing-Konflikt entscheiden** (Cowork-Memo separate Datei)
5. **Aus Konvergenz-Findings einen Sprint-R schreiben** (von Cowork) für die wichtigsten Fixes

---

## Bonus — wenn ChatGPT auch noch mit anderen LLMs verglichen werden soll

Du kannst denselben Prompt auch in:
- Google Gemini (2.5 Pro o.ä.)
- Mistral Large
- Lokales LLM (Llama 3.3, etc.)

pasten — dann hast du 5 unabhängige Meinungen. Wahrscheinlicher Overkill,
aber für eine wichtige strategische Entscheidung (Pivot ja/nein) wertvoll.
