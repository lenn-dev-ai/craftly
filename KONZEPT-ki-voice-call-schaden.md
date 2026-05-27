> # ⚠️ [OBSOLET] — Stand 25.05.2026
> Voice-AI-Use-Case hat sich um 180° gedreht: Statt **Inbound** (Mieter ruft Reparo) ist es **Outbound** (System ruft Mieter bei Lücken).
> **Source of Truth:** `KONZEPT-CONFIRMED-2026-05-25-mieter-first.md` (Voice-AI V2)
> **Operating System:** `ai/REPARO_OPERATING_SYSTEM.md` Abschnitt 4.1
>
> Dieses Doc bleibt im Repo nur als Historie. NICHT als Spec verwenden — V2-Spec wird separat geschrieben.

---

# Konzept — KI-Voice-Call bei Schadensmeldung

> Lennart-Gedanke 21.05.2026 Abend. Strategisch groß, nicht für die laufende Beta.
> Dieses Doc ist Vorabüberlegung — kein Sprint-File. Entscheidung fällt nach Beta-Reality-Check.

## Idee in 1 Satz

Statt Wizard-Klick-Strecke ruft der Mieter eine Reparo-Nummer an, ein KI-Voice-Agent führt das Gespräch und erstellt das Ticket inkl. Kategorisierung, Dringlichkeit, Doku.

## Warum gut

- **Größte Reibungsreduktion denkbar.** Kein App-Install, kein Login, kein Wizard. Telefonnummer wählen und reden.
- **Inklusion**: Ältere Mieter, Mieter ohne Smartphone, Mieter mit schlechtem Deutsch (Voice-AI versteht Akzente besser als Klick-Wizard erlaubt)
- **Doku-Tiefe**: KI kann nachfragen („Ist es ein dauerhaftes Tropfen oder nur beim Drehen?"), Wizard kann das nicht
- **Skalierung**: 1 Nummer für alle Mieter, kein Onboarding
- **Konsistenz mit Markt**: Klarna, DHL, Booking nutzen Voice-AI bereits, Akzeptanz wächst

## Warum schwierig

### Technisch
- **Voice-AI-Provider** auswählen: Vapi (700ms Latenz, gut), Bland (1.2s, billiger), Retell (mid). Cowork-Empfehlung: Vapi für deutsche Qualität.
- **DSGVO**: Voice-Recording braucht aktive Einwilligung („Dieses Gespräch wird aufgezeichnet, ja/nein?"). Speicherort EU-only. Löschfrist max. 90 Tage.
- **Phone-Number**: Twilio o.ä. für DE-Nummer (Festnetz oder 0800). ~15 €/Monat fix + Minutenkosten.
- **Integration**: Webhook von Vapi → Reparo-API → Ticket-Erstellung. Mittlere Komplexität.

### Kosten (laufend)
- Vapi: ~0.10–0.30 € pro Minute (LLM + STT + TTS gebündelt)
- Twilio DE-Nummer: ~5 €/Monat fix, ~0.05 €/Min inbound
- **Pro Schadensmeldung** (3-5 Min realistisch): **~0.50 – 1.50 €**
- Bei 100 Tickets/Monat → 50–150 € Voice-Costs. Verkraftbar wenn Verwalter pro Ticket eine Reparo-Gebühr zahlt.

### Produktrisiko
- KI-Halluzinationen: erfundene Schadens-Details die nicht stimmen → falsche Klassifikation → falscher HW → Eskalation
- **Mitigation**: KI gibt am Ende Zusammenfassung wieder vor, lässt Mieter bestätigen oder korrigieren

### Operative Risiken
- Was, wenn der KI-Agent down ist? → Fallback auf Voicemail → manuelle Verwalter-Bearbeitung
- Was, wenn Mieter den Anruf abbricht in der Mitte? → Teilstand speichern, SMS mit „Link zum Wizard" senden

## Implementation-Plan (wenn Go)

### Phase V1: Minimaler PoC (1 Woche)

- Vapi-Account anlegen, deutsche Test-Nummer
- KI-Prompt schreiben: 5 strukturierte Fragen (Was kaputt? Wo? Wie schlimm? Seit wann? Foto möglich?)
- Webhook: am Anruf-Ende → JSON → POST `/api/voice-call/ingest` → Ticket erstellen
- Test mit 5 Vertrauten

### Phase V2: Produktion (2 Wochen)

- DSGVO-Einwilligungs-Flow am Anruf-Anfang
- SMS-Confirmation an Mieter mit Ticket-Link nach dem Anruf
- Fallback-Handling (Mieter ohne Mobil-Nummer, Anruf-Abbruch)
- Dashboard für Verwalter: Voice-Call-Tickets gekennzeichnet, Recording-Link

### Phase V3: Smart-Routing

- KI erkennt Notfälle (Wasser läuft jetzt) → sofortiges SMS an Notfall-HW
- KI erkennt Planbar → normal in Auktion

## Entscheidungsmatrix

| Kriterium | Heute (Wizard) | Voice-AI |
|---|---|---|
| Reibung Mieter | Mittel (5 Steps) | Niedrig (1 Anruf) |
| Doku-Tiefe | Mittel (festgelegte Felder) | Hoch (KI fragt nach) |
| Setup-Zeit | 0 (haben wir) | 3 Wochen |
| Laufende Kosten | ~0 | 0.50-1.50 €/Ticket |
| DSGVO-Aufwand | Niedrig | Hoch (Voice-Recording) |
| Inklusion ältere Mieter | Niedrig | Hoch |
| Skalierbarkeit | Hoch | Sehr hoch |
| Markt-Erwartung 2026 | Mittel | Hoch (Trend) |

## Cowork-Empfehlung

**Voice-AI ist die richtige Richtung, aber:**
1. **Nicht jetzt für die Closed-Beta.** Beta mit Vertrauten läuft 1-2 Wochen, in der Zeit klären wir Gedanke 3 (Pivot).
2. **Pivot-Abhängigkeit**: Wenn Gedanke 3 = Mieter raus, dann Voice-AI eher beim Verwalter („Verwalter ruft an, beschreibt Schaden, KI erstellt Ticket") — anderer Use-Case.
3. **Erst Gedanke 3 entscheiden, dann Voice-AI als nächstes Feature post-Beta (v1.5, ~Juni-Juli 2026).**

Wenn Gedanke 3 = bleibt mit Mieter: Voice-AI als Mieter-Alternative parallel zum Wizard. Mieter wählt im Onboarding „lieber anrufen" oder „lieber klicken".

## Nächste Schritte

- [ ] Lennart entscheidet Gedanke 3 (Pivot ja/nein) — siehe KONZEPT-pivot-*.md
- [ ] Wenn nein-Pivot: Voice-AI als Spec V1 schreiben, ein Vapi-Account anlegen, PoC-Sprint planen
- [ ] Wenn ja-Pivot: Voice-AI für Verwalter (statt Mieter) re-konzipieren
