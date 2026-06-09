# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Master-Vacation-Plan — 2 Wochen autonome Build-Power

> Lennart geht 22.05.2026 in 2 Wochen Urlaub. Beta wird NICHT gestartet während Urlaub.
> Cowork + Claude Code arbeiten autonom mit allen Tokens und maximalem Throughput.
> Dokument wird kontinuierlich fortgeschrieben als zentrales Lebenszeichen.

## Strategische Grundlinie

**Pivot-Entscheidung verschoben** auf nach-Urlaub (datenbasiert mit Beta-Feedback).
**Build-Direction: „Soft-Pivot"** — alle neuen Features gehen in Verwalter-Direction, Mieter-Code bleibt aktiv aber wird nicht weiter erweitert. Optionalität bleibt, Fokus ist klar.

**Erwartetes Outcome nach 2 Wochen:**
- Verwalter-Seite produktionsreif für B2B-Sales
- Sales-Material komplett (Deck, One-Pager, Pricing-Calculator)
- Voice-AI-PoC lauffähig (für Verwalter-Use-Case)
- Sprint C/D/E/F durch CC abgearbeitet
- E2E-Test-Suite grundlegend etabliert

## Streams im Überblick

| Stream | Owner | Status | Aufwand | Deliverable |
|---|---|---|---|---|
| 1 — Verwalter-Hardening | CC (Sprint G/H/I) | Specs schreiben → queuen | ~10h CC | Wizard + Dashboard + Bulk-Import |
| 2 — B2B-Sales-Material | Cowork | in_progress | ~4h Cowork | PPTX + PDF + Pricing-Calc |
| 3 — Sprint C/D/E/F | CC | F läuft, C/D/E gequeut | ~6h CC | UX-Polish abgeschlossen |
| 4 — Voice-AI PoC | Cowork (Spec) + CC (Impl) | Spec V1 schreiben | ~2h Cowork + ~6h CC | Vapi-PoC mit Test-Anruf |
| 5 — Quality/E2E | CC (Sprint J) | Spec schreiben → queuen | ~8h CC | Playwright-Suite für 3 Flows |

## Stream 1 — Verwalter-Hardening

Pre-Pivot-Investitionen, die in beiden Welten (mit/ohne Mieter) sinnvoll sind.

### Sprint-G: Verwalter-Wizard „Neues Ticket selbst erstellen"
- **Datei:** `PROMPTS/sprint-g-verwalter-wizard.md`
- **Rationale:** Verwalter telefoniert mit Mieter, tippt Schaden ein. P2 aus Pivot-Doc.
- **Aufwand:** ~3-4h CC
- **Status:** Spec wird geschrieben

### Sprint-H: Verwalter-Dashboard-KPIs
- **Datei:** `PROMPTS/sprint-h-verwalter-kpis.md`
- **Rationale:** Stats-Cards für Throughput, Top-HW, offene Tickets. Sales-relevant.
- **Aufwand:** ~3h CC
- **Status:** Spec wird geschrieben

### Sprint-I: Bulk-Wohnungs-Import
- **Datei:** `PROMPTS/sprint-i-bulk-import.md`
- **Rationale:** Verwalter mit 50-500 Wohnungen kann Excel hochladen statt einzeln tippen. Sales-Blocker eliminieren.
- **Aufwand:** ~4h CC
- **Status:** Spec wird geschrieben

## Stream 2 — B2B-Sales-Material

Damit du aus Urlaub mit Cold-Outreach starten kannst.

### Sales-Deck (PPTX, ~12 Slides)
- **Datei:** `Reparo-Sales-Deck-Hausverwaltungen.pptx`
- **Inhalt:** Problem → Lösung → Workflow → USP → Pricing → Demo → Case-Study → CTA
- **Aufwand:** ~2h Cowork
- **Status:** in Queue

### One-Pager B2B (PDF, A4)
- **Datei:** `Reparo-One-Pager-Hausverwaltungen.pdf`
- **Inhalt:** Headline, 3 Benefits, Pricing-Hook, QR zu Demo
- **Aufwand:** ~1h Cowork
- **Status:** in Queue

### Pricing-Calculator (HTML-Artifact)
- **Datei:** `Reparo-Pricing-Calculator.html` (artifact)
- **Inhalt:** Verwalter wählt Wohnungs-Anzahl, sieht monatliche Kosten
- **Aufwand:** ~1h Cowork
- **Status:** in Queue

## Stream 3 — Sprint C/D/E/F (CC läuft)

| Sprint | Inhalt | Status |
|---|---|---|
| F | Mieter-Profil + Location-per-Klick | **in CC, deployt gerade** (`main@b1c9b6e`) |
| C | Diagnose+Auftrag-Merge | Spec existiert, an CC zu pasten |
| D | Wording+RLS-Cleanup | Spec existiert, an CC zu pasten |
| E | Mieter-Vorgang-Card inline | Spec existiert, an CC zu pasten |

## Stream 4 — Voice-AI PoC

### Voice-AI Spec V1
- **Datei:** `SPEC-voice-ai-v1.md`
- **Inhalt:** Vapi-Setup, KI-Prompt für Verwalter-Use-Case, Webhook-Schema, Code-Skeleton
- **Aufwand:** ~2h Cowork
- **Status:** in Queue
- **Blocker für Impl:** Vapi-Account (Lennart muss anlegen)

## Stream 5 — Quality & E2E

### Sprint-J: Playwright E2E-Suite
- **Datei:** `PROMPTS/sprint-j-e2e-playwright.md`
- **Inhalt:** 3 Kern-Flows als End-to-End-Test (Mieter-meldet, Verwalter-vergibt, HW-Auktion)
- **Aufwand:** ~8h CC
- **Status:** Spec wird geschrieben

## Eskalations-Pfade

Was Cowork NICHT autonom kann während Lennart im Urlaub:

| Block | Was tun |
|---|---|
| Vapi-Account erstellen | Auf Lennart warten (nicht-kritisch, Spec ist bereit) |
| Domain für Resend | Auf Lennart warten (Beta-Mails noch nicht nötig) |
| Beta-Tester einladen | Bewusst nicht — Urlaub |
| Schema-Migrationen | Cowork hat Autonomie via Lennart-Mandate (autonomous mode) |
| Code-Deploy | Auto via GitHub-Push (CC committet → Netlify deployt) |

## Status-Tracking

Cowork aktualisiert diesen Plan nach jedem abgeschlossenen Stream-Item.
Letzter Stand: **2026-05-22 18:36** — Plan initial erstellt, Specs werden geschrieben.

## Lennarts Beta-Rückkehr-Checkliste

Wenn Lennart aus Urlaub kommt, hat er:
- [ ] Sales-Deck zum Cold-Outreach an Hausverwaltungen
- [ ] One-Pager als E-Mail-Anhang
- [ ] Pricing-Calculator als Sales-Tool
- [ ] Verwalter-Wizard funktional (Demo-tauglich)
- [ ] Verwalter-Dashboard mit KPIs (Demo-tauglich)
- [ ] Bulk-Import-Tool (Sales-Blocker eliminiert)
- [ ] Voice-AI-Spec bereit (Vapi-Account dann anlegen)
- [ ] E2E-Tests laufen (CI-Sicherheit)
- [ ] Sprint C/D/E/F durch (alle UX-Lücken zu)
- [ ] Beta-Tester-Einladungs-Liste bereit (Lennart-Aufgabe)

Dann: Beta starten → 3-5 Tage Daten → Pivot entscheiden → Voice-AI Impl + ggf. Mieter-Deaktivierung.
