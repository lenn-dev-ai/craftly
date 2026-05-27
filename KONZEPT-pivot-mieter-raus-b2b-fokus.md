> # ⚠️ [OBSOLET] — Stand 25.05.2026
> Pivot-Frage „Mieter raus" wurde mit **NEIN** beantwortet.
> Mieter-App bleibt EINZIGE Eingabe-Quelle, Voice-AI V2 schließt Lücken.
> **Source of Truth:** `KONZEPT-CONFIRMED-2026-05-25-mieter-first.md`
> **Operating System:** `ai/REPARO_OPERATING_SYSTEM.md` Abschnitt 4.1
>
> Dieses Doc bleibt im Repo nur als Historie. NICHT umsetzen, NICHT als Quelle verwenden.

---

# Konzept — Pivot: Mieter-Funktionen raus, B2B-Fokus Verwalter ↔ Handwerker

> Lennart-Gedanke 21.05.2026 Abend. Strategischer Pivot — die wichtigste Entscheidung.
> Dieses Doc strukturiert die Frage, beantwortet sie nicht.

## Idee in 1 Satz

Reparo wird ein B2B-Tool für Immobilien-Verwaltungen: Verwalter pflegt Tickets selbst (nach Mieter-Anruf), Reparo verbindet ihn mit dem richtigen Handwerker. Mieter-App entfällt.

## Was sich konkret ändert

### Aktuell (3-Rollen-Modell)

```
Mieter (Schaden melden via Wizard)
    ↓
Verwalter (sichten, vergeben)
    ↓
Handwerker (annehmen, terminieren, rechnen)
```

### Nach Pivot (2-Rollen-Modell)

```
Mieter ruft Verwalter an (telefonisch, wie heute)
    ↓
Verwalter (Schaden selbst in Reparo eintragen → KI klassifiziert → vergeben)
    ↓
Handwerker (annehmen, terminieren, rechnen)
```

## Pros

### Strategisch / Geschäftsmodell

1. **B2B = direkt verkaufbar.** Verwaltungen sind Buyer mit Budget. Mieter sind nur User ohne Cash-Flow.
2. **Klare Positionierung.** „Wir bauen Verwaltern den Handwerker-Marktplatz" ist scharf, „Wir bauen die Schadens-App für alle" ist diffus.
3. **Sales-Cycle einfacher**: 1 Sales-Gespräch mit Hausverwaltung → 50-500 Wohnungen drin. Vs. 1-Mieter-für-1 onboarden.
4. **Beta-Akquise sofort einfacher**: 3 Verwaltungen finden ist machbar (Netzwerk, Empfehlungen). 30 Mieter mit App-Adoption ist hart.

### Technisch / Operativ

5. **30% weniger Code zu warten** (eine Rolle weg, ~12 Mieter-Pages obsolet)
6. **Onboarding-Reibung weg.** Mieter müssen nichts installieren, nicht registrieren.
7. **Voice-AI-Roadmap** (Gedanke 1) lässt sich später für Verwalter bauen (Verwalter ruft Reparo an statt umgekehrt) — auch elegant.
8. **Kein App-Store-Risiko**. Verwalter nutzt Web-App, das ist ausreichend.

### Wettbewerb

9. **Klare Kategorie**: „Reparo ist das CRM für Hausverwaltungen mit Handwerker-Vermittlung". Vergleichbar mit Jira/Asana für Devs.
10. Mit Mieter-Funktion war Reparo schwerer einzuordnen (Hand­werker-App? Mieter-App? Verwalter-Tool?).

## Cons

### Verwalter muss mehr tun

1. **Eingabe-Last beim Verwalter**. Mieter ruft an, Verwalter tippt Details ein. Heute könnte Mieter das selbst.
2. **KI-Vorklassifikation auf Mieter-Text entfällt.** Verwalter beschreibt selbst, KI macht trotzdem Gewerk-Vorschlag.
3. **Verzögerung**: Mieter ruft Mo 17 Uhr an → Verwalter macht's Di 9 Uhr → Reparo erst dann. Heute könnte Mieter sofort melden.

### Code-Aufwand

4. **Sprint zur Mieter-Deaktivierung**: ~1-2 h
   - Mieter-Routes deaktivieren (`/dashboard-mieter/*` → 404 oder Redirect)
   - Sidebar/BottomNav-Items raus
   - Mieter-Demo-Account entfernen aus BETA-WELCOME
5. **Verwalter-Wizard zum Tickets-Selbst-Erstellen ausbauen**: ~1 h
   - Aktuell hat Verwalter nur Liste + Detail. Braucht „+ Neues Ticket"-Wizard wie Mieter ihn hat.
   - Code aus Mieter-Wizard kopieren + an Verwalter-Layout anpassen.
6. **Heute gebaute Mieter-Features sind „verschwendet"** (M4, M5, M6, Mieter-Wizard-Komplex) — aber bleiben im Repo als Branch oder Feature-Flag.

### Pivot-Risiko

7. **Wenn Verwalter sagt „eigentlich wäre Mieter-App cool"** → wir haben den Code geschmissen
8. **Mid-Beta-Pivot wäre teurer als Pre-Beta-Pivot.** Erste Beta-Tester wären verwirrt warum die Mieter-Seite weg ist.

## Markt-Reality-Check

### Wer kauft Reparo wirklich?

- **Hausverwaltungen / Property-Manager** (klassisch B2B): wahrscheinlichster Käufer. Kann Reparo direkt monetarisieren (€/Wohnung/Monat).
- **Genossenschaften, große WGs**: Mid-Size, ähnlich Verwaltung.
- **Einzelne Mieter**: zahlen typisch nicht für Tools, sondern Verwalter. Auch wenn die App super wäre — Mieter ist nicht Buyer.

→ **Käufer = Verwaltung. Pivot ist konsistent mit Realität.**

### Konkurrenz

- Casavi (DE B2B Verwalter-Tool) — hat Mieter-App aber Verwalter ist Buyer
- Wohnmonitor — Mieter-Schaden-App, aber Mieter zahlt nichts
- Hausgold / Vermietet — mehr Verwaltungs-Suite, kein Handwerker-Marktplatz

→ **Niche „Verwalter ↔ Handwerker mit Vergabe-Marktplatz"** ist relativ frei.

## Cowork-Empfehlung

**Ich tendiere zu Pivot-ja, aber nicht heute entscheiden.**

### Konkreter Vorschlag

1. **Heute**: Beta mit aktuellem 3-Rollen-Setup starten (Vertraute einladen).
2. **In 3 Tagen** (nach 5-10 Test-Feedbacks): Frage stellen — „Würdet ihr als Mieter die App wirklich nutzen, oder lieber den Verwalter anrufen?"
3. **Wenn 70%+ sagen „Anruf reicht"** → Pivot ja, ich schreibe Sprint-File für Mieter-Deaktivierung.
4. **Wenn 70%+ sagen „App ist cool"** → behalten, evtl. parallel zum Verwalter-Pfad als Optional.

### Risiko-Bewertung

- **Pivot heute machen ohne Markt-Daten** = Bauchgefühl-Entscheidung. Schlecht weil irreversibel-feels.
- **Pivot nach Beta-Daten** = informiert. Selbst wenn nur 5 Vertraute getestet haben, das ist mehr als heute.
- **Pivot später (post-Beta)** = teurer, weil mehr Code zu deaktivieren ist und mehr Beta-Tester verwirrt werden.

## Wenn Pivot beschlossen — Implementation-Plan

### Phase P1: Mieter-Deaktivierung (1-2 h Claude Code)

- Mieter-Routes (`/dashboard-mieter/*`) auf „Reparo ist aktuell ein Tool für deine Hausverwaltung — bitte melde deinen Schaden direkt bei ihr"-Page
- Mieter-Login bleibt funktional (für später), aber Dashboard zeigt diese Hinweis-Page
- BETA-WELCOME aktualisieren: Mieter-Demo-Account raus, nur Verwalter + HW
- Sidebar/BottomNav: Mieter-Rolle ausgrauen

### Phase P2: Verwalter-Schaden-Eingabe (1 h Claude Code)

- Verwalter-Dashboard: „+ Neues Ticket"-Button prominent
- Wizard wie Mieter-Wizard, aber unter Verwalter-Layout
- Felder zusätzlich: Mieter-Name, Mieter-Telefon (Verwalter trägt Anrufer-Daten ein)
- KI-Klassifikation auf Verwalter-Beschreibung (statt Mieter-Beschreibung)

### Phase P3: Marketing / Positioning Update (Lennart)

- Landing-Page Tagline ändern: „Reparo — Der Handwerker-Marktplatz für Hausverwaltungen"
- BETA-WELCOME-PDF Headline anpassen
- Vertriebs-Pitch klären (B2B-SaaS-Modell)

### Phase P4 (optional, post-Beta): Voice-AI für Verwalter (Gedanke 1)

- Verwalter ruft Reparo-Nummer an, beschreibt Schaden, Voice-AI erstellt Ticket
- Spart Tipparbeit, schneller als manuell eingeben
- Synergetisch zu Gedanke 3

## Entscheidung-Trigger für Lennart

Sag eines von drei:
- **„Pivot jetzt"** — Cowork schreibt Phase-P1+P2-Sprint heute Nacht
- **„Pivot erst nach 3 Tagen Beta"** — Empfehlung Cowork, Datenbasierte Entscheidung
- **„Pivot nicht"** — Mieter bleibt, Status quo

---

**Bottom Line:** Pivot würde Reparo schärfer machen. Aber nicht heute aus dem Bauch entscheiden — sondern in 3 Tagen mit echten Beta-Daten.
