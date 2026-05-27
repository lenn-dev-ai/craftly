# CC-Commit-Prompt — Sprint AK (Slot-Marktplatz-Cleanup)

Lennart hat schon lokal editiert. Bitte folgende Files committen + pushen.

## Was Sprint AK macht

Alter Slot-Marktplatz war Erbe vom Push-Modell (HW bietet Slot → Verwalter
kauft). Mit Mieter-First-Pivot (23.05.) + Google-Cal-Sync (Sprint AE) tot.
Sprint AK migriert in drei Stufen, alle in diesem Commit:

- **Stufe 1**: HW-Kalender entrümpelt — Verfügbarkeits-Layer + Toggles raus.
  Filter-Bar wird Legende (4 Farben: Auftrag/Vorschlag/Google/Privat).
  Modal blockt nur noch Privat-Zeit. Wochenstruktur-Logik komplett entfernt.
- **Stufe 2**: Verwalter-Marktplatz umgebaut. Zwei Tabs: "Offene Tickets" +
  "Meine Handwerker" (Stamm-HW mit Live-Verfügbarkeit aus Google-Cal).
  Neuer API-Endpoint `/api/verwalter/hw-verfuegbarkeit`. Alte Page als Backup
  unter `marktplatz-archiv/`.
- **Stufe 3**: zeitslots-Cleanup in HW-Dashboard (Quick-Action ersetzt),
  Einnahmen-Page (Übergangs-Banner), Scoring-Library (Deprecated-Kommentar),
  Sichtbarkeits-Cron (Deprecated-Kommentar). Keine harten Removes — wir
  brauchen die Logik noch eine Iteration für die Historie.

## Geänderte Files

```
app/dashboard-handwerker/kalender/page.tsx              — Stufe 1
app/dashboard-handwerker/page.tsx                       — Stufe 3 (Quick-Action)
app/dashboard-handwerker/einnahmen/page.tsx             — Stufe 3 (Banner)
app/dashboard-verwalter/marktplatz/page.tsx             — Stufe 2 (NEU)
app/dashboard-verwalter/marktplatz-archiv/page.tsx      — Stufe 2 (Backup; identisch zur alten marktplatz/page.tsx)
app/api/verwalter/hw-verfuegbarkeit/route.ts            — Stufe 2 (NEU)
app/api/cron/sichtbarkeits-recompute/route.ts           — Stufe 3 (Kommentar)
lib/scoring/verfuegbarkeit.ts                           — Stufe 3 (Kommentar)
SPRINT-AK-VERWALTER-MARKTPLATZ-KONZEPT.md               — NEU (Konzept-Memo)
```

## Migrations — KEINE neue erforderlich

`zeitslots` und `zeitslot_gebote` bleiben unverändert (Historie + Privat-Blocks).
Stufe 4 (Sprint AL) könnte später eine Spalte `art` constraints oder die
ganze Tabelle umbenennen.

## Commit-Message

```
refactor(sprint-ak): Slot-Marktplatz-Konzept abgekündigt — 3-Stufen-Cleanup

Stufe 1: Kalender entrümpelt
- Verfügbarkeits-Layer + Toggle raus (Filter-Bar → 4-Farben-Legende)
- Modal vereinfacht: nur noch Privat-Zeit-Block
- Wochenstruktur-Logik entfernt (jsWochentag/dbWochentag/LayerChip Helper weg)
- Klick auf leere Stunde öffnet Privat-Block-Modal statt Slot-Anbieten

Stufe 2: Verwalter-Marktplatz umgebaut
- Zwei Tabs: "Offene Tickets" (verwalter_id + zugewiesener_hw IS NULL)
  und "Meine Handwerker" (stamm_handwerker mit Live-Verfügbarkeit)
- "HW einladen"-Drawer pro Ticket mit Gewerk-Match-Hinweis
- Status-Badges: frei/belegt/nicht_verbunden/fehler aus Google-Cal-Check
- Neuer Endpoint /api/verwalter/hw-verfuegbarkeit (max 20 IDs, 4h-Fenster)
- Alte Page als Backup unter /dashboard-verwalter/marktplatz-archiv/

Stufe 3: zeitslots-Cleanup
- HW-Dashboard: "Zeitslots"-QuickAction durch "Karte" ersetzt
- Einnahmen-Page: Übergangs-Banner für Slot-Historie
- lib/scoring/verfuegbarkeit + sichtbarkeits-recompute: Deprecated-Kommentar
  (Code bleibt aktiv, Refactor kommt in Sprint AL)

Bezug: Konzept-Memo KONZEPT-Mieter-First-Workflow + neues
SPRINT-AK-VERWALTER-MARKTPLATZ-KONZEPT.md
```

## Push-Befehle

```bash
cd ~/Desktop/Reparo
git add app/dashboard-handwerker/kalender/page.tsx \
        app/dashboard-handwerker/page.tsx \
        app/dashboard-handwerker/einnahmen/page.tsx \
        app/dashboard-verwalter/marktplatz/page.tsx \
        app/dashboard-verwalter/marktplatz-archiv/page.tsx \
        app/api/verwalter/hw-verfuegbarkeit/route.ts \
        app/api/cron/sichtbarkeits-recompute/route.ts \
        lib/scoring/verfuegbarkeit.ts \
        SPRINT-AK-VERWALTER-MARKTPLATZ-KONZEPT.md \
        CC-COMMIT-SPRINT-AK.md
git commit -m "refactor(sprint-ak): Slot-Marktplatz abgekündigt — 3-Stufen-Cleanup"
git push origin main
```

## Smoke-Test nach Deploy

### HW-Kalender
1. Login als HW → /dashboard-handwerker/kalender
2. Über dem Grid: Legende mit vier Farb-Punkten (Auftrag/Vorschlag/Google/Privat),
   KEINE Filter-Toggles mehr.
3. Klick auf leere Stunde: Modal heißt "Zeit blockieren", nur Datum/Von/Bis,
   kein "Verfügbar/Privat"-Toggle, kein "Wochenstruktur"-Toggle.
4. Speichern → grauer "🔒 Privat"-Block erscheint, klick zum Löschen.
5. Empty-State (frischer Account): "So füllst du deinen Kalender" listet
   nur noch Google + Aufträge + Privat-Block, keine "Verfügbarkeit anbieten".

### Verwalter-Marktplatz
1. Login als Verwalter → /dashboard-verwalter/marktplatz
2. Tab "Offene Tickets" zeigt deine Tickets ohne zugewiesenen HW.
3. Action "HW einladen" öffnet Drawer mit Stamm-HW-Liste.
4. Klick auf einen HW → Bestätigung → einladung in DB.
5. Tab "Meine Handwerker": Liste deiner Stamm-HW mit Status-Badges.
   "frei"/"belegt"/"unbekannt" je nach Google-Cal-Status.
6. Filter "Nur frei jetzt" reduziert auf grüne Badges.
7. URL-Param ?tab=handwerker landet direkt auf Tab 2.

### HW-Dashboard
1. /dashboard-handwerker — Quick-Actions zeigen "Kalender / Karte / Einnahmen / Profil"
   (kein "Zeitslots" mehr).

## Typecheck — schon GRÜN

`npx tsc --noEmit` läuft sauber durch (EXIT=0).

## Was NICHT in diesem Sprint passiert

- `zeitslots`/`zeitslot_gebote` Tabelle bleibt (kein DROP, kein Rename).
- `lib/yield-management.ts` und Sichtbarkeit-Scoring laufen weiter (mit
  Deprecated-Kommentar), für die Historie.
- Voice-AI, Map-View-Marktplatz, Notification-Stream zum Verwalter sind
  Sprint AL/AM.
