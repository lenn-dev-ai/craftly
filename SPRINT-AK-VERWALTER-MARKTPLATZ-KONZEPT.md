# Sprint AK Stufe 2 — Verwalter-Marktplatz Konzept-Memo

**Datum**: 27.05.2026
**Autor**: Claude (Cowork-Session)
**Status**: Konzept finalisiert, MVP-Code committed
**Vorgänger-Memos**: KONZEPT-Mieter-First-Workflow (23.05.), 3-Audits-Triangulation (24.05.)

---

## Problem

Der alte Marktplatz ist ein _Push-Modell_: HW bietet proaktiv Zeitslots an,
Verwalter scrollt und kauft. Das stammt aus einem Modell, das wir mit dem
**Mieter-First-Pivot** (23.05.) abgekündigt haben:

- Mieter macht Ticket → System öffnet Auction → HWs bieten → Mieter pickt Termin.
- HW pflegt Verfügbarkeit ab Sprint AE in Google-Kalender, nicht mehr aktiv
  in Reparo-Slots.
- Notfall-Match (F1-Fix vom 27.05.) checkt direkt Google-Events.

Damit:
- `zeitslots`-Tabelle ist konzeptionell tot. HW legt keine Slots mehr aktiv an
  (Sprint AK Stufe 1 hat das aus dem Kalender-UI entfernt). Bestand existiert
  noch für Audit und Privat-Blocks.
- Verwalter-Marktplatz zeigt eine leere Liste, sobald kein HW mehr Slots
  pflegt — also sehr bald.

Der Marktplatz braucht einen neuen Daseinszweck oder muss weg.

## Was Verwalter wirklich brauchen

Aus den Stakeholder-Konversationen und Audit-Findings (Sprint AH +
Mieter-First-Memo) destilliert: ein Verwalter öffnet den Marktplatz, weil
er für ein Problem einen HW finden will. Drei konkrete Sub-Use-Cases:

1. **&bdquo;Welche Tickets warten gerade auf mich, damit ich einen HW zuweise?&ldquo;**
   — heute übers Tickets-Inbox-Pattern unklar gelöst; Marktplatz könnte das
   bündeln.

2. **&bdquo;Welche HWs in meinem Pool sind diese Woche frei und im Gewerk X?&ldquo;**
   — heute gar nicht: Stamm-HW-Liste zeigt keine Verfügbarkeit, HW-Verzeichnis
   ist Pool-übergreifend ohne Frei-Indikator.

3. **&bdquo;Schnell-Aktion: dieses Ticket diesem HW direkt anbieten&ldquo;**
   — heute via Einladungs-Flow auf Ticket-Detail-Seite, aber nicht aus dem
   Marktplatz heraus.

Use Case 1 ist ein Inbox, Use Case 2 ist ein Filter-Verzeichnis, Use Case 3
ist eine Action. Der alte Marktplatz hat all das nicht — er hatte nur
&bdquo;eine Liste von Slots, klick zum Bewerben&ldquo;.

## Neuer Marktplatz — zwei Listen, eine Action

Das MVP für Sprint AK Stufe 2 macht aus dem Marktplatz eine **zwei-Tab-Page**:

### Tab 1: &bdquo;Offene Tickets&ldquo; (Use Case 1, Default-Tab)

Liste aller Tickets im Pool des Verwalters, die noch keinen zugewiesenen HW
haben (`zugewiesener_hw IS NULL`) und nicht im Status `geschlossen`/`storniert`.
Sortiert nach Erstellungs-Datum (älteste zuerst — der Verwalter sieht, was
am längsten liegt).

Pro Zeile:
- Titel, Gewerk, Einsatzort
- Mieter-Name + Wohnung
- Alter des Tickets (&bdquo;vor 3 Stunden&ldquo; / &bdquo;seit Mo&ldquo;)
- Anzahl HW-Einladungen + Anzahl Gebote (falls Auction läuft)
- Action: &bdquo;HW zuweisen&ldquo; → öffnet ein Drawer/Modal mit der HW-Liste
  aus Tab 2 (gefiltert auf passendes Gewerk).

### Tab 2: &bdquo;Verfügbare Handwerker&ldquo; (Use Case 2)

Liste aller HWs im Pool des Verwalters (Stamm-HW + Pool-Mitglieder), mit
**Live-Verfügbarkeits-Indikator** aus Google-Cal:

- 🟢 Frei jetzt (keine Google-Events in den nächsten 2h)
- 🟡 In 4–24h frei (sonst belegt)
- 🔴 Heute komplett belegt
- ⚪ Nicht verbunden (kein Google-OAuth, Status unbekannt)

Filter: Gewerk, PLZ-Bereich, Status-Indikator. Action pro HW: &bdquo;Zu Ticket
einladen&ldquo; → öffnet Drawer mit den eigenen offenen Tickets aus Tab 1.

### Performance-Hinweis

Die Live-Verfügbarkeits-Abfrage pro HW ist 1 Google-API-Call. Bei >20 HWs
wird das spürbar. Lösungs-Optionen für Stufe 2.1:
- Cache pro HW für 5 Minuten (Server-Action mit `revalidate`).
- Lazy-Load nur die ersten 10 sichtbar, Rest beim Scroll.
- Status async setzen — erst Liste rendern, dann Badges einzeln nachschieben.

MVP macht alle Calls synchron (Top-20-Limit auf der Liste).

## Was wegfällt

- **Slot-Liste + Slot-Filterung** (Gewerk-Filter-Buttons) — durch
  HW-Liste mit Gewerk-Filter ersetzt.
- **&bdquo;Bewerben&ldquo;-Aktion auf Slots** — gibt's gar nicht mehr; Auction
  läuft Mieter-getrieben.
- **`zeitslot_gebote`-Tabelle** — wird in Stufe 3 nicht mehr geschrieben.
  Lese-Code bleibt vorerst für Historie.
- **Wochenstruktur-Generierung** (virtuelle Slots aus `art='wiederkehrend'`)
  — komplett raus.

## Was bleibt (Migrations-Backup)

- `zeitslots`-Tabelle: bleibt für Privat-Blocks (Stufe 1) und als
  Datenarchiv. Stufe 3 entscheidet, ob umbenennen (`hw_blockzeiten`) oder
  lassen.
- `zeitslot_gebote`: bleibt für Historie/Audit. Keine neuen Einträge.
- `app/dashboard-verwalter/marktplatz/page.tsx`: alt umbenannt zu
  `marktplatz-archiv/page.tsx` (oder ähnlich), damit notfalls re-deployed
  werden kann. Neue MVP liegt unter dem aktiven Pfad.

## Open Questions (für Lennart)

1. **&bdquo;Pool des Verwalters&ldquo;** — wie ist das aktuell modelliert? Per
   `stamm_handwerker`-Tabelle (Sprint V)? Oder &bdquo;alle HWs im
   PLZ-Radius&ldquo;? Das MVP nimmt Stamm-HW + Fallback &bdquo;alle&ldquo;,
   falls leer.
2. **Tab-Default** — &bdquo;Offene Tickets&ldquo; oder &bdquo;Verfügbare
   HWs&ldquo; als erstes? MVP: Tickets, weil das der häufigere Pain-Point ist.
3. **Notification** — soll Verwalter benachrichtigt werden, wenn ein neues
   Ticket im Pool landet (Email/Push)? Out of Scope für Stufe 2, gehört zu
   Sprint U (Status-Flow).
4. **&bdquo;HW zuweisen&ldquo;-Drawer** — direkt Auction starten oder einzelnen
   HW einladen? MVP: einladen (existing Flow), Auction kommt nur wenn Mieter
   das Ticket macht.

Default-Antwort bei allen vier: pragmatisch das simpelste, was funktioniert;
die echten Antworten kommen aus echter Verwalter-Nutzung.

## Migrationspfad

| Phase | Was | Wann |
|---|---|---|
| Stufe 1 ✅ | Kalender entrümpelt | 27.05. |
| Stufe 2a ✅ | Konzept-Memo | 27.05. |
| Stufe 2b ✅ | Marktplatz-MVP umgebaut, alt als `marktplatz-archiv` | 27.05. |
| Stufe 2c | Smoke-Test live, Verwalter-Feedback einsammeln | Post-Deploy |
| Stufe 3 | `zeitslots`-Code-Cleanup in Sidebar/Dashboard/Einnahmen/Scoring | Nach Stufe 2c |

## Fragen die das MVP nicht beantwortet

- Was passiert mit dem Yield-Management (`berechneDynamischenPreis`,
  Sichtbarkeit-Cron, `lib/scoring/verfuegbarkeit.ts`)? Antwort: an
  `tickets` binden statt an `zeitslots`. Sprint AL.
- Bekommt der Verwalter eine Map-View (Sprint AH-Roadmap)? Antwort: ja,
  später. Stufe 2-MVP ist Liste-only.
