# Konzept — Auktion als Preisformel + generalisierte Direktvergabe (Sprint AM)

> Folgekonzept zu Task #217 ("Handwerker-Verfügbarkeit & Direktbuchung —
> Doctolib-Mechanik"). Nach mehreren Feedback-Runden hat sich das
> Konzept von "neue Direktbuchungs-Funktion" zu einer **Neuinterpretation
> der bestehenden Auktion** entwickelt. Status: KONZEPT, Basis für die
> anschließende Sprint-Spec (Task #222). Strategischer Rahmen unverändert:
> Handwerker sind die Kern-Zielgruppe — "das Doctolib der Reparaturen".

## 1. Wie wir hier hingekommen sind

1. **v1 (verworfen):** Direktbuchung als eigenständige 4. Möglichkeit
   neben "HW einladen" / "Auction starten" / K1-Doodle — neuer Button,
   neue Wochenkalender-UI, neuer `termine`-Status. Risiko: genau das
   Nebeneinander-mehrerer-Wege-Problem, das Sprint AK Stufe 1 (alter
   Slot-Marktplatz) bereits einmal beerdigt hat.
2. **v2:** Direktbuchung und Auktion über ein gemeinsames
   `vorschlag_datum/von/bis`-Feld auf `angebote`/`einladungen` mergen.
3. **v3 — "ein System":** Direktvergabe = Auktion-mit-einem-Empfänger;
   jedes Angebot hat immer Preis + Termin.
4. **v4 (final, dieses Dokument):** **Auktion = Preisformel.** Kein
   48h-Bieterwettbewerb, kein Warten auf mehrere Angebote — das System
   berechnet einen Preis aus objektiven Faktoren (Zeitdruck, Fahrtweg,
   Auslastung) und vergibt **direkt** an den am besten passenden HW.
   HW antwortet mit Annehmen/Ablehnen, kein Gegenangebot-Ritual.

## 2. Die zentrale Erkenntnis: Das gibt's größtenteils schon

`/api/auction/start` enthält für `dringlichkeit=notfall` **bereits exakt
diesen Mechanismus**:

- `berechneSmartScore()` rankt HW im Radius nach Nähe/Bewertung.
- Preis = `stundensatz × geschätzte_Stunden × surge_faktor` (heute eine
  Konstante je Dringlichkeit).
- Top-1-Kandidat wird per Google-Cal-Check (F1, `hasGoogleEventInRange`)
  validiert.
- **Direktvergabe**: `zugewiesener_hw`, `kosten_final`, `termine`-Eintrag
  — alles in einem Schritt, kein Auktionsfenster.

Und für `zeitnah`/`planbar` gibt es mit `findeUndErzeugeStammAnfrage`
(Sprint V) bereits eine Vorstufe: 1:1-Anfrage an den Stamm-HW, Ticket
bleibt `offen`, kein Auktionsfenster — nur bei Ablehnung/Fristablauf
fällt es in die heutige Marktplatz-Auktion (Mass-Invite an alle im
Radius mit `empfohlener_preis = stundensatz × h × surge`).

**Die Aufgabe ist also keine Neuentwicklung, sondern eine
Generalisierung**: das Notfall-Muster (Preis berechnen → Top-Kandidat →
Direktvergabe) auf alle Dringlichkeitsstufen anwenden, mit
Stamm-HW-Vorzug als Schritt 0 und der heutigen Mass-Invite-Auktion als
letzten Fallback statt als Standardweg.

## 3. Die Preisformel

Drei Faktoren, alle aus vorhandenen oder leicht ableitbaren Daten —
**"Komplexität des Auftrags" als eigener Faktor wird bewusst
weggelassen** (subjektiv, vor einem Befund kaum belastbar einschätzbar;
ihre eigentliche Funktion — Stunden schätzen — übernimmt weiterhin
`estimatedH`/`befund_aufwand_stunden`, siehe unten).

### a) Zeitdruck (existiert)
`surge_faktor` aus `konfigFuer(dringlichkeit)`. Notfall teurer als
planbar. Keine Änderung nötig.

### b) Fahrtweg (neu als Preiskomponente)
Bisher beeinflusst Entfernung nur das Ranking (`naeheScore`), nicht den
Preis — unrealistisch, denn ein 25-Min-Anfahrtsweg kostet den HW echte
Zeit. `haversineKm`/`schaetzeFahrzeitMin` (lib/distance) existieren
bereits. Neu: **Anfahrtspauschale**, die zum Auftragswert addiert wird —
gestaffelt nach Fahrzeit (z.B. 0,50 €/Fahrtminute oder Stufenmodell
0–10/10–20/20+ Min). Nebeneffekt: HW in der Nähe werden für
Verwalter/Mieter automatisch günstiger — ein nachvollziehbarer,
transparenter Unterschied ("warum ist HW B 8 € teurer? → 8 km weiter
weg").

### c) Auslastung (neu, ersetzt "Komplexität")
Wie voll ist der Google-Kalender des HW in den nächsten Tagen?

- Voller Kalender → Preis leicht erhöht (Opportunitätskosten)
- Leerer Kalender → Preis leicht reduziert (Anreiz, die Lücke zu füllen)
- Kein Google-Cal verbunden → neutral (Multiplikator 1.0, **kein**
  Nachteil — fail-open wie bei `hasGoogleEventInRange`)

Das ist der ehrlichere "Auktions"-Gedanke als Komplexität: klassische
Surge-Preise (Uber etc.) entstehen aus Angebot/Nachfrage, nicht aus
"wie schwer ist die Aufgabe". Gleichzeitig bekommt Sprint AE
(Google-Cal-Sync) einen weiteren handfesten Nutzen für HW — zusätzlicher
Anreiz, den Kalender zu verbinden.

### Formel-Skizze

```
Basisbetrag   = stundensatz × geschätzte_Stunden
Auftragswert  = Basisbetrag × surge_faktor (Zeitdruck)
              + Anfahrtspauschale(fahrzeit_min)              [Fahrtweg]
Auftragswert  = Auftragswert × auslastungs_multiplikator     [Auslastung]
```

`geschätzte_Stunden` bleibt wie heute: `estimatedH` als Default je
Dringlichkeit (zeitnah=2h, planbar=3h), ersetzt durch
`befund_aufwand_stunden` sobald ein Befund vorliegt (Projekt-Angebot-Flow,
unverändert).

## 4. Der generalisierte Vergabe-Flow

Für **alle** Dringlichkeitsstufen (nicht nur Notfall):

0. **Stamm-HW-Vorzug** (existiert, `findeUndErzeugeStammAnfrage`):
   Verwalter hat für Objekt+Gewerk einen Stamm-HW hinterlegt? → der ist
   Kandidat #1.
1. **Kandidatenliste bilden**: Stamm-HW (falls vorhanden) zuerst, sonst
   Pool im Radius, sortiert nach Smart-Score (Nähe/Bewertung/Sichtbarkeit
   — unverändert).
2. **Preis berechnen** (Abschnitt 3) — individuell pro Kandidat, da
   `stundensatz` und Fahrtweg je HW unterschiedlich sind.
3. **Google-Cal-Check** (existiert, F1) — Kandidat überspringen, wenn im
   relevanten Zeitfenster belegt.
4. **Direktvergabe-Anfrage an Top-Kandidat**: "Auftrag X, Preis Y
   (berechnet), Termin Z (aus Kalender oder Default-Vorschlag)." HW
   bekommt ein Zeitfenster zum Antworten (gestaffelt nach Dringlichkeit:
   Notfall ~15 Min, zeitnah ~2 Std, planbar ~24 Std).
5. **Annehmen** → sofort `zugewiesener_hw` + `termine`-Eintrag, fertig.
   **Ablehnen oder Timeout** → nächster Kandidat aus der Liste, zurück zu
   Schritt 2.
6. **Fallback**: nach N erfolglosen Versuchen (z.B. 3) öffnet sich die
   heutige Marktplatz-Auktion (Mass-Invite an alle im Radius) als
   Notnagel — bleibt also erhalten, wird aber zur Ausnahme statt zur
   Regel.

K1-Doodle (`/api/termine/vorschlagen` + `/api/termine/select-slot`)
bleibt als Fallback für den Fall, dass der direkt zugewiesene HW (noch)
keinen Google-Kalender hat und daher keinen konkreten Slot vorschlagen
konnte — er kann dann wie heute nachträglich 2-3 Termine anbieten.

## 5. Was sich ändert vs. heute

| Bereich | Heute | Neu (Sprint AM) |
|---|---|---|
| Notfall | Top-1-Direktmatch, Preis = stundensatz×2h×surge | Gleich, + Anfahrtspauschale + Auslastungs-Multiplikator |
| Zeitnah/Planbar mit Stamm-HW | 1:1-Anfrage, **kein** Preis im Request (Verwalter verhandelt) | 1:1-Anfrage **mit berechnetem Preis + Terminvorschlag**, Stamm-HW nimmt an/ab |
| Zeitnah/Planbar ohne Stamm-HW | Mass-Invite an alle im Radius, alle können bieten, Verwalter wählt | Sequenzielle Einzel-Anfragen (Top-Score zuerst); Mass-Invite erst nach N Ablehnungen als Fallback |
| Preisformel | stundensatz × estimatedH × surge | + Anfahrtspauschale(Fahrzeit) × Auslastungs-Multiplikator |
| `angebote`/`einladungen` | Parallele Bieter-Tabellen | Werden zum "aktuell offene Anfrage an genau einen HW"-Log (Strukturänderung optional, kann auch in Phase 1 unverändert bleiben — siehe Risiken) |

## 6. Wiederverwendung bestehender Bausteine

- `berechneSmartScore()` (lib/auction/smart-score.ts) — Ranking bleibt,
  unverändert.
- `haversineKm`/`schaetzeFahrzeitMin` (lib/distance) — jetzt zusätzlich
  für die Preisformel statt nur fürs Ranking.
- `hasGoogleEventInRange` (lib/google-cal/events.ts) — F1-Check bleibt,
  zusätzlich neue Funktion für Auslastungs-Dichte (siehe Abschnitt 7).
- `findeUndErzeugeStammAnfrage` (lib/auction/stamm-routing.ts) — wird zu
  Schritt 0 des generalisierten Flows, bekommt zusätzlich Preis+Termin
  im Request.
- `konfigFuer(dringlichkeit)` (lib/auction/auction-manager.ts) —
  `surgeFaktor` bleibt Quelle für den Zeitdruck-Faktor.
- K1-Doodle (`/api/termine/vorschlagen`, `/select-slot`) — Fallback für
  HW ohne Google-Cal, unverändert.

## 7. Was fehlt konkret / neue Bausteine

1. **`lib/pricing/auftragswert.ts`** (neu) — zentrale
   `berechneAuftragswert()`-Funktion nach der Formel aus Abschnitt 3,
   ersetzt die verstreute Inline-Berechnung in `/api/auction/start`.
2. **Auslastungs-Dichte-Funktion** in `lib/google-cal/` — z.B.
   `berechneAuslastung(userId, days=7)`: Anteil belegter Stunden in
   Arbeitszeit über die nächsten N Tage → Multiplikator 0.95–1.10,
   Default 1.0 ohne Verbindung.
3. **Sequenz-Mechanismus**: Tracking, welcher Kandidat aktuell angefragt
   ist und seit wann (für Timeout-Eskalation). Einfachste Variante:
   bestehende `einladungen`-Zeile mit `status='offen'` + `created_at`,
   ein Cron prüft Timeouts und triggert den nächsten Kandidaten — kein
   neues Tabellen-Design nötig.
4. **Terminvorschlag bei Direktvergabe-Anfrage**: wenn HW Google-Cal
   verbunden hat, einen freien Slot vorschlagen (Wiederverwendung der
   freie-Slots-Logik aus dem v1-Konzept, Abschnitt 4 dort); sonst
   Platzhalter-Termin + K1-Doodle als Nachgang.
5. **Cron für Timeout-Eskalation**: analog bestehenden Scheduled Tasks
   (z.B. `keep-alive`) — prüft offene Direktvergabe-Anfragen, eskaliert
   zum nächsten Kandidaten oder zum Mass-Invite-Fallback.

## 8. Offene Fragen & Risiken

- **`protect_ticket_fields()`-Trigger**: jede neue Status-Transition
  (insb. das automatische Eskalieren zum nächsten Kandidaten, das
  `zugewiesener_hw` u.U. wieder zurücksetzt) muss in der Whitelist
  landen — explizit mit Trigger-Test, analog der Sprint-AL-Lektion.
- **Preisvarianz zwischen Kandidaten**: zwei HW könnten für denselben
  Auftrag unterschiedliche Preise sehen (unterschiedlicher
  `stundensatz`/Fahrtweg). Das ist beabsichtigt und transparent
  (Anfahrtspauschale erklärt den Unterschied), sollte aber dem
  Verwalter im UI klar kommuniziert werden ("Preis hängt vom
  zugewiesenen HW ab").
- **Sequenzielle Kette / Performance**: bei nischigen Gewerken oder
  dünn besiedelten PLZ-Bereichen könnte die Kette mehrere Runden
  brauchen. Timeout-Staffelung (15 Min/2 Std/24 Std) + Fallback nach N=3
  hält das Risiko begrenzt; Mass-Invite-Fallback fängt den Rest auf.
- **Laufende Auktionen zum Umstellungszeitpunkt**: Migration sollte
  bestehende `status='auktion'`-Tickets unangetastet lassen (auslaufen
  lassen) statt sie in den neuen Flow zu zwingen.
- **HW-Akzeptanz**: weniger Verhandlungsspielraum für HW (kein eigenes
  Angebot mehr, nur Annehmen/Ablehnen). Sollte in Beta-Feedback früh
  beobachtet werden — ggf. später ein "Gegenvorschlag"-Escape-Hatch
  (Phase 3, nicht MVP).
- **Auslastungs-Faktor mit wenig Google-Cal-Daten**: solange #162
  (Smoke-Test Google-Login) nicht breit validiert ist, greift der
  Auslastungs-Multiplikator für die meisten HW nur als neutraler
  Default (1.0) — das ist unkritisch (Architektur fail-open), aber der
  Faktor entfaltet seinen Nutzen erst mit mehr verbundenen Kalendern.

## 9. Phasenplan & Aufwandsschätzung

- **Phase 1 (~1-2 Tage):** Preisformel (`lib/pricing/auftragswert.ts`,
  Fahrtweg + Auslastung) in `/api/auction/start` integrieren — **ohne**
  den Vergabe-Ablauf zu ändern. Notfall + Mass-Invite-Preise nutzen
  sofort die neue Formel. Niedrigstes Risiko, sofort sichtbarer
  Mehrwert (realistischere Preise).
- **Phase 2 (~3-4 Tage):** Generalisierung — Stamm-Vorzug-Anfrage bekommt
  Preis+Terminvorschlag, sequenzielle Direktvergabe für zeitnah/planbar
  ohne Stamm-HW, Timeout-Cron, `protect_ticket_fields()`-Update +
  Trigger-Test.
- **Phase 3 (~2 Tage):** Mass-Invite-Auktion zu echtem Fallback umbauen
  (nur sichtbar/aktiv nach N Ablehnungen) + UI-Anpassungen im Marktplatz
  (Anzeige "wird automatisch vergeben, voraussichtlich an HW X zu Y €").

## 10. Empfehlung

Phase 1 zuerst und unabhängig umsetzen — sie ist in sich abgeschlossen,
risikoarm (reine Preisberechnung, keine neuen Status/Trigger) und macht
sofort einen Unterschied in den angezeigten Preisen. Phase 2+3 als
eigene Sprint-Spec (Task #222) detaillieren, sobald Phase 1 live ist und
sich die neue Formel in der Praxis bewährt hat.
