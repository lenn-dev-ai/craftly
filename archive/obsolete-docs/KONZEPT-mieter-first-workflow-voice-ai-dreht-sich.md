# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Konzept — Mieter-First-Workflow + Voice-AI dreht sich um

> Lennart-Feedback `c636f2bf` vom 25.05.2026 08:31 Uhr.
> Strategische Konzept-Update — verändert Sprint G, Voice-AI-Roadmap und
> Pivot-Konzept gleichzeitig.

## Lennarts Original-Aussage

> „hier soll doch der mieter schadensmeldung abgeben, dann erste ki auswertung
> erfolgen und bei rückfragen anruf direkt beim mieter nach den nötigen weiteren
> informationen zum schaden und erst dann weiterleitung sobald alle notwendigen
> infos da geht schade an HV oder man überlegt schadensmeldung durch mieter
> geht an hv die können notwendige und fehlende info anklicken und dann wird
> autmatisch mieter angerufen um infos einzuholen aber auf jeden fall setzt
> nicht die HV das ticket ab"

## Was Lennart konzeptionell sagt

**Bisheriger Workflow (laut Sprint G):**
```
Mieter ruft Verwalter an
  → Verwalter tippt im /dashboard-verwalter/neues-ticket Wizard
  → Ticket im System
  → Auktion → HW-Auswahl
```

**Neuer Workflow (Lennarts Vision):**
```
Mieter meldet IMMER im /dashboard-mieter/melden Wizard (oder Voice-AI direkt)
  → KI macht erste Auswertung
  → BEI LÜCKEN: Voice-AI ruft den MIETER zurück für genau die fehlenden Infos
  → Erst wenn Ticket vollständig: Verwalter sieht das Ticket
  → Verwalter macht Auktion / Vergabe (NICHT Eingabe)
```

**Alternative die Lennart einwirft:**
```
Mieter meldet (eventuell mit Lücken)
  → Ticket geht trotzdem an HV
  → HV sieht „fehlende Infos" markiert
  → HV klickt auf fehlende Felder → Voice-AI ruft Mieter an + sammelt das ein
  → HV bekommt vollständiges Ticket zurück
```

**Kerngedanke beide Varianten:** **„auf jeden fall setzt nicht die HV das ticket ab"** — der Verwalter tippt nicht mehr.

## Konsequenzen

### Konsequenz 1 — Sprint G war strategisch falsch

Sprint G (telefonischer Verwalter-Wizard) wurde explizit als „Verwalter telefoniert
mit Mieter, tippt Schaden ein" konzipiert. Lennart sagt jetzt: das soll nicht
existieren.

**Optionen:**
- A) Sprint G komplett rausnehmen + Route droppen
- B) Sprint G umlabeln zu „Ticket-Korrektur für Admins" (Edge-Case wenn Mieter wirklich nicht selbst meldet)
- C) Sprint G behalten als Backup für Fälle wo Mieter überfordert ist

**Cowork-Empfehlung:** **B** — der Code existiert, ist 361 LOC, könnte als Admin/Edge-Case-Tool weiterleben. Aber UI nicht prominent.

### Konsequenz 2 — Voice-AI-Use-Case dreht sich um 180°

**Bisherige Voice-AI-Spec (SPEC-voice-ai-v1.md):**
- Verwalter ruft Reparo-Nummer
- Voice-AI nimmt Schaden auf (Verwalter erzählt was Mieter sagt)
- Ticket entsteht

**Neue Voice-AI-Spec:**
- **System** ruft den MIETER an (outbound, nicht inbound!)
- Voice-AI stellt nur die fehlenden Klärungsfragen
- KI-Output ergänzt das schon teilweise befüllte Ticket
- Verwalter sieht das ergänzte Ticket — fertig

**Konkrete Änderungen:**
- Vapi-Setup: Outbound-Calling statt Inbound
- Phone-Number-Setup: weniger wichtig (System ruft, kein Mieter-anruf-an)
- Twilio: outbound-Permissions
- DSGVO: Mieter muss VOR System-Anruf zugestimmt haben (Opt-in)
- Conversation-Flow: nur Fragen zu spezifischen offenen Feldern, kein Wizard

**Aufwand-Implikation:** SPEC-voice-ai-v1.md muss komplett neu geschrieben werden. Vapi-Setup-Checkliste auch.

### Konsequenz 3 — Pivot-Konzept dreht sich

Bisheriges Pivot-Konzept (`KONZEPT-pivot-mieter-raus-b2b-fokus.md`):
- Mieter-App raus, Verwalter wird der Eingeber

Neues Konzept:
- **Mieter-App ist KRITISCH** — sie ist die einzige Eingabe-Quelle
- HV wird vom Eingeber zum Validator + Vergeber
- Voice-AI ist der Lückenfüller zwischen Mieter und HV

**Bedeutet:** Pivot-Frage „Mieter-App raus?" ist eindeutig mit NEIN beantwortet. Mieter-App ist Teil des Hauptpfads.

→ KONZEPT-pivot-mieter-raus-b2b-fokus.md sollte überarbeitet oder als überholt markiert werden.

### Konsequenz 4 — Sales-Material braucht Story-Update

Aktuelle 3-Step-Story (Sales-Deck Slide 4):
1. Verwalter trägt ein
2. Reparo macht Auktion
3. Sie vergeben mit 1 Klick

Neue 3-Step-Story:
1. **Mieter** meldet (App/Voice)
2. Reparo prüft + ruft Mieter zurück bei Lücken
3. Verwalter sieht fertiges Ticket → 1-Klick-Vergabe

Das ist sogar STÄRKER für Sales: „Verwalter macht nur noch das letzte 1%"
ist ein viel klareres Wertversprechen als „Verwalter tippt schnell".

## Vorschlag — Was Cowork als nächstes tun könnte

### Option 1 — Sofort umsetzen
- Sprint AB-Spec: Sprint-G-UI verstecken/droppen + Mieter-Wizard prominenter
- Sprint AC-Spec: Voice-AI-V2-Spec (Outbound-Calling für Mieter-Klärung)
- Pivot-Konzept als „überholt" markieren
- Sales-Material 3-Step-Story umschreiben

### Option 2 — Erst diskutieren mit Lennart
- Cowork wartet auf Lennart-Rückmeldung
- Risiko: Lennart entscheidet später anders, dann ist Update verschwendet

**Cowork-Empfehlung:** **Option 1** mit Notiz „diese Updates basieren auf
Lennart-Feedback c636f2bf, falls überholt: zurückrollen". Schadens-frei weil
Sales-Material noch nicht extern verschickt wurde.

## Offene Konzept-Fragen für Lennart

1. **Sprint-G-Schicksal:** A (droppen), B (Admin-Tool), C (Backup)?
2. **Voice-AI-Trigger:** automatisch wenn KI sagt „Infos fehlen" (Score <70)? Oder manuell durch Verwalter („fehlende Felder anklicken")?
3. **Mieter-Opt-in für Voice-AI-Rückruf:** beim Onboarding einmal? Oder pro Anruf?
4. **Mehrfache Klärungsanrufe:** wenn Mieter nicht erreichbar — wie viele Versuche? Eskalation an Verwalter?
5. **Was wenn Mieter beim Klärungsanruf NEUE Infos bringt die wieder Lücken erzeugen?** Rekursive Voice-AI-Calls?
6. **Wann ist ein Ticket „vollständig genug"?** Mindest-Score? Pflicht-Felder definiert?

## Zeitplan-Empfehlung

```
Heute (während Urlaub):
├── Cowork dokumentiert Konzept (du liest gerade)
├── Cowork notiert in URLAUBS-STATUS.md das Sprint G und Voice-AI-Spec überholt
└── KEIN Code-Change — wartet auf Lennart-Bestätigung

Nach Urlaub:
├── Lennart bestätigt oder modifiziert das Konzept (30 Min Gespräch mit Cowork)
├── Cowork schreibt finale Sprint-Specs (G-Replacement, Voice-AI-V2, Sales-Story)
├── CC arbeitet ab (3-5 Tage)
└── Pivot-Konzept-Doc wird obsolet markiert
```

## Cowork-Bottom-Line

Lennarts Konzept-Update ist **strategisch wertvoll** und macht Reparo
schärfer:
- Klare Rollen-Trennung: Mieter = Quelle, HV = Entscheider, System = Lücken-Schließer
- Bessere Sales-Story: „Verwalter macht nur noch das letzte 1%"
- Voice-AI kommt zum Einsatz wo er den meisten Mehrwert hat (Klärungs-Fragen)

**Aber:** das ist eine 180°-Drehung gegen Sprint G + bisherige Voice-AI-Spec.
Bevor wir Code anpassen, sollte Lennart das nochmal explizit bestätigen — keine
„aus dem Bauch"-Entscheidung.

**Status:** Konzept dokumentiert, wartet auf Lennart-Bestätigung. Bis dahin:
keine Code-Änderungen, keine Sprint-Specs für CC.
