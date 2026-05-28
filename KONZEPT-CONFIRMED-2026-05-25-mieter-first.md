# BESTÄTIGT 25.05.2026 — Mieter-First-Workflow + Voice-AI Outbound

> Lennart-Bestätigung (25.05.2026): „Anrufe durch ki zur Schadens Steuerung
> sind smart und reduzieren extrem den Aufwand"
>
> Konzept-Update aus `KONZEPT-mieter-first-workflow-voice-ai-dreht-sich.md`
> ist hiermit BESTÄTIGT und wird umgesetzt.

## Was sich konkret ändert

### Workflow (BESTÄTIGT)

```
Mieter meldet (App-Wizard ODER direkter Anruf)
  → KI macht erste Auswertung
  → BEI LÜCKEN: Voice-AI ruft den MIETER zurück für genau die fehlenden Infos
  → Erst wenn Ticket vollständig: Verwalter sieht das fertige Ticket
  → Verwalter macht 1-Klick-Vergabe (NICHT Eingabe)
```

### Sales-Story (BESTÄTIGT)

**Neue 3-Step-Story:**
1. **Mieter meldet** (App oder Voice-AI)
2. **Reparo prüft + ruft Mieter zurück** bei Lücken
3. **Verwalter sieht fertiges Ticket** → 1-Klick-Vergabe

→ Wertversprechen: „Verwalter macht nur noch das letzte 1%"

## Konsequenzen für die Roadmap

### Sprint G (Verwalter-Wizard) — OBSOLET

- Live-Code bleibt (361 LOC) als Admin/Notfall-Tool
- UI-Verlinkung entfernen oder unter „Admin/Sonderfälle" verstecken
- Nicht weiter ausbauen
- Sales-Material erwähnt es nicht mehr

### Voice-AI V1 (Inbound für Verwalter) — OBSOLET

- Backend-Code bleibt im Repo (`app/api/voice-call/ingest/route.ts`)
- Spec wird ersetzt durch V2 (Outbound zu Mieter)
- DSGVO-Felder + Schema (Sprint Voice-AI Migration) sind weiterhin nutzbar

### Voice-AI V2 (Outbound zu Mieter) — NEUER FOKUS

**Konzept:**
- System ruft Mieter automatisch wenn Ticket unvollständig
- Vapi-Outbound-Calling, nicht Inbound
- KI fragt nur die fehlenden Felder ab
- Mieter-Opt-in beim Onboarding (DSGVO)
- Anruf-Versuche: max 3, dann SMS-Fallback mit Wizard-Link

**Sprint AC-Voice-AI-V2-Spec wird neu geschrieben.**

### Pivot-Konzept (`KONZEPT-pivot-mieter-raus-b2b-fokus.md`) — OBSOLET

- Mieter-App bleibt nicht nur, sondern ist die EINZIGE Eingabe-Quelle
- Pivot-Frage „Mieter raus?" eindeutig mit NEIN beantwortet
- Doc als „überholt 25.05." markieren

### Sales-Material — UPDATE NÖTIG

Sales-Deck Slide 4 + One-Pager + Landing-Page-3-Step:
- Alt: „Verwalter trägt ein → Marktplatz → 1-Klick"
- Neu: „Mieter meldet → System klärt Lücken (KI-Voice) → Verwalter vergibt mit 1 Klick"

Cowork-Tasks:
- Sales-Deck Slide 4 umschreiben
- One-Pager 3-Step-Block ersetzen
- Landing-Page `/hausverwaltungen` 3-Step-Sektion (Sprint K) → Sprint R+ ergänzen

## Was Voice-AI V2 konkret können muss

### Trigger-Logik

Ticket wird angelegt → KI-Klassifikation läuft → Vollständigkeits-Score berechnet:
- Score ≥80: direkt zum Verwalter
- Score 50-79: System ruft Mieter, fragt 1-3 Lücken
- Score <50: Mieter direkt ans Telefon (Anruf) für komplette Aufnahme

### Klärungs-Anruf-Inhalt

KI-Prompt: „Hi, hier ist Reparo. Sie haben gerade einen Schaden gemeldet
(kurz wiederholen). Mir fehlen noch 2 Infos: [Frage 1], [Frage 2]. Können Sie
mir die kurz nennen?"

Nach Antwort: „Danke! Ich update Ihr Ticket. Ihre Verwaltung bekommt das jetzt
direkt — Sie hören in [X] Stunden zurück."

### Eskalation

Wenn Mieter:
- 3× nicht erreichbar → SMS an Mieter mit Wizard-Link + Notification an Verwalter
- explizit ablehnt → Ticket geht trotzdem an Verwalter mit Marker „Mieter wollte nicht klären"
- gibt unsinnige Antworten → KI markiert Ticket „Klärung gescheitert" → Verwalter sieht das

## Aufwand

| Phase | Aufwand |
|---|---|
| Sales-Material-Update (Cowork) | ~1h |
| Voice-AI V2 Spec schreiben (Cowork) | ~2h |
| Voice-AI V2 Backend (CC, nach Vapi-Setup) | ~6-8h |
| Vapi-Outbound-Setup (Lennart) | ~30 Min |
| Frontend-Integration in Mieter-Wizard (CC) | ~3h |
| Sprint G UI verstecken (CC) | ~30 Min |

**Total: ~15h CC + 3h Cowork + 30 Min Lennart**

## Reihenfolge

Nach Urlaub:
1. Cowork: Sales-Material updaten (1h) — Story muss vor Cold-Outreach stimmen
2. Cowork: Voice-AI V2 Spec schreiben (2h)
3. Lennart: Vapi-Account anlegen + Outbound-Permissions aktivieren
4. CC: Sprint G UI verstecken + Voice-AI V2 Backend bauen
5. CC: Frontend-Integration (Trigger-Logik im Mieter-Wizard)
6. Beta-Test mit echtem Setup

## Was Cowork JETZT macht

- ✅ Diese Bestätigung dokumentiert (du liest gerade)
- ⏭ KONZEPT-mieter-first-workflow-voice-ai-dreht-sich.md als „BESTÄTIGT" markieren
- ⏭ KONZEPT-pivot-mieter-raus-b2b-fokus.md als „OBSOLET 25.05." markieren
- ⏭ Sprint R erweitern um „Sales-Material 3-Step-Story Update"
- ⏭ Voice-AI V2 Spec schreiben (separater Sprint)

## Status

**Konzept-Bestätigung BESTÄTIGT.** Roadmap wird entsprechend umgesetzt.
