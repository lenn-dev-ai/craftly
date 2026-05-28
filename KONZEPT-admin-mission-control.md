# Konzept — Admin-Dashboard Redesign: Mission Control statt Analytics-Playground

> Lennart-Feedback `9ab7382d` (25.05.): „Macht das Dashboard so wirklich Sinn,
> also was ziehe ich da raus. Sollten wir nicht vllt. auch aufnehmen, wie viele
> gerade online sind, was laufend ist etc. Können ja auch alles tote Accounts
> sehen aber ich will ja die Nutzung live verstehen."
>
> Bestätigt Designer-Audit (24.05.): „Mission Control statt Analytics Playground."
>
> Status: KONZEPT, kein Sprint-Spec. Aufwand ~2-3 Tage CC.

## Problem

Aktuelles Admin-Dashboard zeigt:
- Statische KPI-Cards (Anzahl Verwalter / HW / Mieter)
- Wochentrend-Chart (Tickets pro Woche)
- System-Health-Bars
- KI-Anomalien

Was es NICHT zeigt:
- Wer ist gerade online?
- Was passiert JETZT?
- Welche Vorgänge stehen still und brauchen Eingriff?

→ Lennart kann nicht erkennen, ob das System lebt oder tot ist.

## Konzept-Update — „Mission Control"

### Vorbild

- Stripe-Live-Dashboard
- Linear-Activity-View
- Datadog-Incident-View

Nicht: PowerBI / Tableau / Statistik-Tools.

### Neue Layout-Struktur

```
┌─────────────────────────────────────────────────────────┐
│ 🟢 LIVE STATUS                                           │
│ 3 User online · 7 aktive Auktionen · 2 Klärungs-Anrufe  │
├─────────────────────────────────────────────────────────┤
│ ⚠️ BRAUCHEN AKTION (= Mission Control)                  │
│ • Verwalter "Mustermann GmbH" — 3 Tickets ohne Vergabe  │
│ • HW "Müller Sanitär" — 5 Tage offline                   │
│ • Auktion AAAA — 12h ohne Angebot                        │
├─────────────────────────────────────────────────────────┤
│ 📊 LETZTE 24h (Activity)                                 │
│ • 12 neue Tickets · 8 vergeben · 3 abgeschlossen        │
│ • 2 neue HW registriert                                   │
│ • 5 Mieter-Klärungsanrufe (Voice-AI)                     │
├─────────────────────────────────────────────────────────┤
│ 🔧 SYSTEM-STATUS (klein, dezent unten)                  │
│ ✓ DB OK · ✓ API <200ms · ✓ Voice-AI OK                  │
└─────────────────────────────────────────────────────────┘
```

### Tech-Implementation

**Live-Daten (Section 1 + 2):**
- Server-Sent-Events (SSE) oder Polling alle 30 Sek
- Backend-Query: aktive Sessions in Supabase Auth + offene Auktionen
- Frontend: useEffect mit interval

**Aktions-Liste (Section 2 — wichtigste):**
- SQL-View „admin_action_items" mit:
  - Tickets ohne Vergabe >24h
  - HW ohne Login >7 Tage
  - Auktionen ohne Angebot >12h
  - Mieter ohne Feedback nach Reparatur
  - Voice-AI-Anrufe gescheitert

**24h-Activity (Section 3):**
- Aggregierte Counts der letzten 24h
- KEIN Chart — nur Zahlen + Trend-Pfeil

**System-Status (Section 4):**
- Health-Check-Endpoints (DB-Latency, API-Avg-Response, External-Services)
- Klein + dezent — nicht das Hauptthema

### Was raus muss

- Wochentrend-Chart (zu makro, nicht actionable) → kann in „Reporting"-Sektion
- KI-Anomalien als prominente Cards (zu vague) → in Action-Items integrieren wenn echt
- System-Health-Bars (Designer: „pseudo-professionell") → klein unten
- KPI-Cards für Total-User-Count (statisch, kein Insight) → in „Status"-Section nur dynamisch

### Was bleibt

- KI-Anomalien (aber als Action-Items, nicht als eigener Block)
- Activity-Trend (aber als Number-Cards, nicht Charts)

## Aufwand

| Phase | Aufwand |
|---|---|
| Backend: Live-Endpoint (SSE oder Polling) | ~0.5 Tag |
| Backend: action_items SQL-View | ~0.5 Tag |
| Frontend: Layout refactoren | ~1 Tag |
| Tests: Live-Updates simulieren | ~0.5 Tag |

**Total:** ~2.5 Tage CC.

## Verbindung zu anderen Findings

- **Designer-Audit Verwalter 5.5/10** + Admin 5/10: dieser Sprint adressiert Admin direkt
- **Sprint AB (Verwalter beruhigen):** ähnliches Prinzip („operative Ruhe, klare Aktion"), könnte parallel laufen
- **Feedback `9337c802` (tote HW-Routen):** Action-Item „X HW-Routen sind nicht in Sidebar — Sprint R Phase 2"
- **Sprint Q2 (Stufenweise Dashboards):** ähnliche Idee, aber Q2 ist für Verwalter — dieses Konzept ist für Admin

## Empfehlung

Nach Sprint R + AB. Vorher Beta-Daten sammeln, dann Action-Items konkret machen.

**Reihenfolge:**
1. Sprint R fertig (alle Bugs raus)
2. Sprint AB fertig (Verwalter beruhigt)
3. Beta-Start (3-5 Tester, 1-2 Wochen)
4. Beta-Daten zeigen welche Action-Items real wichtig sind
5. DANN Sprint AH (Admin-Mission-Control) bauen

## Status

WARTET auf Lennart-Bestätigung nach Urlaub. Konzept dokumentiert.
