# Loop Iteration 24 — 1 neuer Feedback (27.05.2026 nachmittags)

> Lennart erwähnte „2" — in der DB ist seit Iter 23 nur einer neu reingekommen
> (`444f646e`, 13:04). Der zweite kam vermutlich gleich noch oder ist der bereits
> in Iter 23 triagierte `d0ec6e39`. Wenn ein weiterer eintrudelt, kann der
> sauber im nächsten Run nachgezogen werden.

## Der Finding

| ID | Wann | Wer | URL | Message |
|---|---|---|---|---|
| `444f646e` | 27.05. 13:04 | admin | `/dashboard-verwalter/marktplatz` | „Warum muss ich handwerker erst als stammthandwerker anlegen — so funktioniert doch die auktions logik dann nicht? Ich glaube die auktionslogik haben wir etwas aus dem auge verloren" |

## Triage — KONZEPT-KORREKTUR (Sprint AK Stufe 2 Nachschärfung)

**Lennart hat recht.** Sprint AK Stufe 2 hat den Verwalter-Marktplatz auf
Stamm-HW als primäre Quelle gebaut — und damit die Auctions-Logik aus dem
Blick verloren. Das passt nicht zum Mieter-First-Konzept.

### Was heute lebt

- **`/api/auction/start`** (technisch sauber): nimmt ein Ticket, sucht HWs im
  Radius (`imRadius`), filtert Top-5 nach Google-Cal-Verfügbarkeit (F1-Fix
  von vorhin), wählt Top-1 als Best-Match. Stamm-HW ist NICHT die
  Datenquelle hier — `profiles WHERE rolle='handwerker' AND PLZ-Match` ist es.
- **Stamm-HW-Routing** (`findeUndErzeugeStammAnfrage`): zusätzlicher Pfad,
  bevorzugt der HW aus `stamm_handwerker` benachrichtigt wird wenn er für
  ein Objekt gepflegt ist. Stamm ist also eine OPTIONAL-Vorrang-Liste,
  nicht die Suchgrundlage.
- **Verwalter-Marktplatz Tab 2 (Sprint AK MVP)**: zeigt nur `stamm_handwerker`
  des aktuellen Verwalters. Wenn keine angelegt → leere Liste.

→ **Inkonsistenz**: Auctions-System weiß über ALLE Radius-HW Bescheid,
  aber der Verwalter-Marktplatz zeigt ihm nur seine Stamm-HW. Wenn der
  Verwalter „aktiv jemanden suchen" will, sieht er nur die, die er schon
  kennt. Wenn die Auction läuft, schickt das System Einladungen an HWs,
  die der Verwalter im UI gar nicht sieht.

### Was Lennart vermisst

Im UI fehlt die Brücke: „starte für dieses Ticket eine Auction" → System
findet automatisch die passenden HW (Gewerk + Radius + Verfügbarkeit) →
schickt Einladungen → HW antworten mit Angebot → Verwalter pickt. Heute
muss der Verwalter den Pool selbst per Stamm-HW vorpopulieren, sonst gibt's
keinen sichtbaren Pool im Marktplatz.

## Empfehlung — Sprint AK Phase 4 Spec

**Marktplatz Tab „Meine Handwerker" → Tab „Handwerker im Pool"** mit zwei
Sektionen:

1. **⭐ Stamm-Handwerker** (oben): die explizit gepflegten, mit Verfügbarkeits-
   Badges wie heute.
2. **🔍 Auch verfügbar in deinem Radius** (darunter): Liste aller HW aus
   `profiles WHERE rolle='handwerker'` mit
   - Gewerk-Match zu mind. einem aktiven Ticket-Gewerk
   - PLZ/Distanz < 50 km zum Verwalter-Sitz oder Objekt-Standort
   - Verfügbarkeits-Check on-demand (gleicher Endpoint wie heute)

Action pro HW in Sektion 2: **„Zu Stamm hinzufügen"** + **„Direkt einladen"**
(zu welchem Ticket). Damit wird klar: Stamm ist eine Convenience-Liste,
nicht die Vorbedingung.

**Tab „Offene Tickets" Action erweitern**: statt nur „HW einladen" (manuell
einen aus dem Drawer) auch **„Auction starten"** (automatisch Top-N aus dem
Radius einladen). Letzteres ruft `/api/auction/start` wie heute schon.

### Datenmodell

Keine neue Migration nötig — `profiles` + `stamm_handwerker` existieren
schon. Nur die Frontend-Query erweitern + UI-Sektion ergänzen + neuer
Endpoint `/api/verwalter/hw-im-pool` der die Radius-Suche macht (analog
zu `auction/start.imRadius`-Logik, aber als reines Read).

### Aufwand

- 1 neuer API-Endpoint (~80 LoC)
- Marktplatz-Page um Sektion 2 erweitern (~150 LoC)
- Optional: „Auction starten"-Button im Tickets-Tab (~30 LoC, ruft existing API)

→ Ein Hotfix-Commit, vielleicht 1-2 Stunden.

## Severity

**HIGH** — das ist Architektur-Feedback an einem frisch gepushten MVP. Wenn
das nicht nachgezogen wird, ist der Verwalter-Marktplatz für jeden Verwalter
mit weniger als 5 Stamm-HW nutzlos. Und genau diese Verwalter (kleine
Hausverwaltungen ohne festen HW-Pool) sind die Beta-Zielgruppe.

## Mein Mea Culpa

Im Konzept-Memo (`SPRINT-AK-VERWALTER-MARKTPLATZ-KONZEPT.md`, Stufe 2)
habe ich die „Open Question Nr. 1" notiert: _„Pool des Verwalters — wie
ist das aktuell modelliert? MVP nimmt Stamm-HW + Fallback alle"_ — aber
den Fallback dann nicht implementiert. Habe stillschweigend auf Stamm-HW
reduziert, weil das die einfachste Query war. Das war Auto-Komfort, kein
strategisches Denken. Lennart hat das in einem Satz bemerkt — gut, dass er
es gemacht hat.

## Empfehlung für nächste Action

Sprint AK Phase 4 als eigenes Hotfix-Commit:
1. `app/api/verwalter/hw-im-pool/route.ts` neu (Radius-Read)
2. `app/dashboard-verwalter/marktplatz/page.tsx` erweitern
3. Optional „Auction starten"-Button im Tickets-Tab

Will Lennart das jetzt noch heute (= drittes größeres Push-Set) oder
morgen frisch? Es ist 14:30 deutscher Zeit — vom Sprint-Volumen heute
würde ich morgen empfehlen, aber technisch ist der Pfad sauber und kurz.

## viewed-Flag

`444f646e` wird auf `viewed=true` gesetzt.
