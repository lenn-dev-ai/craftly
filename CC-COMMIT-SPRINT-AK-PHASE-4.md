# CC-Commit-Prompt — Sprint AK Phase 4 (Pool-Read + Auction-Start)

## Was Phase 4 macht

Loop-Iteration-24-Feedback (`444f646e`): „Warum muss ich HW erst als Stamm
anlegen — Auctions-Logik aus dem Auge verloren". Lennart hat recht.

Phase 4 schließt das Loch:

- **Verwalter sieht jetzt zwei Sektionen** im Marktplatz-Tab „Meine Handwerker":
  - ⭐ **Stamm-Handwerker** (oben, prio-sortiert wie bisher)
  - 🔍 **Auch verfügbar in deinem Radius** (darunter, max 50 km, Gewerk-Match,
    mit Entfernung-km + Verfügbarkeits-Badge)
- **„Zu Stamm hinzufügen"-Button** pro Pool-HW — One-Click ohne Modal,
  legt `stamm_handwerker`-Zeile mit prio=50 an.
- **„Auction"-Button** pro offenem Ticket (Tab 1) statt nur „HW einladen".
  Öffnet ein kleines Modal mit drei Dringlichkeits-Optionen
  (🔴 Notfall / 🟡 Zeitnah / 🟢 Planbar) → ruft existing `/api/auction/start`.

Datenmodell unverändert — `stamm_handwerker`, `profiles`, `tickets`
existieren alle schon. Keine Migration.

## Geänderte Files

```
app/api/verwalter/hw-im-pool/route.ts                NEU
app/dashboard-verwalter/marktplatz/page.tsx          modifiziert (Pool-Section + Auction-Button + Modal)
LOOP-ITERATION-23-2026-05-27.md                      NEU (Feedback-Triage)
LOOP-ITERATION-24-2026-05-27.md                      NEU (Sprint-AK-Phase-4-Trigger)
CC-COMMIT-SPRINT-AK-PHASE-4.md                       NEU (dieser Prompt)
```

## Commit-Message

```
feat(sprint-ak-phase-4): Marktplatz lernt Auctions wieder

Phase 4 schließt das Loch aus Loop-24-Feedback 444f646e:
Verwalter musste bisher HW erst als Stamm anlegen, bevor sie im
Marktplatz sichtbar waren — gegen Mieter-First/Auctions-Konzept.

- NEU: /api/verwalter/hw-im-pool — Radius-Read aller HW (max 50 km,
  optional Gewerk-Filter), markiert pro Eintrag ist_stamm.
- Marktplatz Tab "Meine Handwerker" jetzt zwei Sektionen:
  ⭐ Stamm-HW (oben, wie bisher)
  🔍 Auch verfügbar in deinem Radius (Pool, mit Entfernung-km,
     "Zu Stamm hinzufuegen"-Action)
- Verfuegbarkeits-Endpoint laedt Status fuer Stamm + Pool zusammen
  (max 20 IDs gesamt, kein zusaetzlicher Roundtrip).
- Marktplatz Tab "Offene Tickets" hat neuen "Auction"-Button neben
  "HW einladen". Modal mit Dringlichkeit-Auswahl ruft existing
  /api/auction/start, das System macht den Best-Match-Versand.

Bezug: LOOP-ITERATION-24-2026-05-27.md
```

## Push-Befehle

```bash
cd ~/Desktop/Reparo && \
git add app/api/verwalter/hw-im-pool/route.ts \
        app/dashboard-verwalter/marktplatz/page.tsx \
        LOOP-ITERATION-23-2026-05-27.md \
        LOOP-ITERATION-24-2026-05-27.md \
        CC-COMMIT-SPRINT-AK-PHASE-4.md && \
git commit -m "feat(sprint-ak-phase-4): Marktplatz lernt Auctions wieder

- /api/verwalter/hw-im-pool: Radius-Read mit Gewerk-Filter, max 50 km,
  ist_stamm-Markierung pro HW
- Marktplatz Tab Handwerker: Sektion 1 Stamm-HW + Sektion 2 Pool im Radius
  mit Entfernung-km + Zu-Stamm-hinzu-Action
- Verfuegbarkeits-Endpoint laedt Status fuer Stamm + Pool zusammen
- Tab Tickets: Auction-Button neben HW-einladen, oeffnet Modal mit
  Dringlichkeit-Auswahl, ruft /api/auction/start

Loop-24-Feedback 444f646e adressiert." && \
git push origin main
```

## Smoke-Test nach Deploy

1. Login als Verwalter → `/dashboard-verwalter/marktplatz`
2. Tab „Meine Handwerker":
   - Sektion ⭐ Stamm-Handwerker zeigt deinen Stamm (falls vorhanden).
   - Sektion 🔍 Auch verfügbar in deinem Radius zeigt restliche HW im Pool
     mit „X km entfernt"-Badge und „Stamm"-Button.
   - „Stamm"-Button klicken: HW erscheint mit Toast in Stamm-Sektion.
3. Tab „Offene Tickets":
   - „Auction"-Button öffnet Modal mit drei Optionen.
   - „Planbar" wählen → Auction-Start, Toast „Auction läuft".
   - Ticket-Status sollte sich auf „auktion" ändern (Badge in der Liste).
4. Falls Pool-Liste leer mit Fehler „Standort": Verwalter-Profil mit
   Startort vervollständigen (in `/dashboard-verwalter` o.ä.).

## Typecheck — schon GRÜN

`npx tsc --noEmit` läuft sauber durch (EXIT=0).

## Was Phase 4 NICHT macht (offen für Phase 5/Sprint AL)

- Pool-Endpoint nutzt `handwerker_gewerke[]`-Array nicht voll aus,
  falls Filter-Gewerk gesetzt — fallback auf single-gewerk-Match.
- Auction-Start ohne Pre-Check, ob überhaupt HW im Radius sind. Bei
  leerem Pool wirft `/api/auction/start` einen 422; das Modal zeigt
  den Error im Toast.
- Map-View für die Pool-HW (Sprint AH-Roadmap-Idee) fehlt noch.
