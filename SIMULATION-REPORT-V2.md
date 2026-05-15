# Nutzungs-Simulation Iteration 2 — Befund-Update

**Datum:** 2026-05-15
**Methodik:** Frisches Seed (1500 Tickets, 300 User) gegen gefixten Code,
gezielte Validierung der 9 Maßnahmen aus Iteration 1 + Code-Audit der
Mieter- und HW-Dashboards (in Iteration 1 nicht gemacht).

## Validierung Iteration-1-Fixes

| Maßnahme | Status | Daten |
|---|---|---|
| **K1** Verwalter-Pipeline-Sektion | ✅ | 25 offene Nachträge + viele Befunde sichtbar im Dashboard |
| **K2** Diagnose-Ablauf | ⚠️ Teil-Lücke | Backfill OK (50/50), neue Tickets via Seed/Direct-Insert ohne Frist (0/100) |
| **K3** verwalter_id | ✅ | 1500/1500 Tickets gesetzt, 620 davon Mieter-erstellt mit korrektem Verwalter |
| **W1** Typ-Filter | ✅ | Filter funktional, Counts korrekt |
| **W2** Bewertungs-Reminder | ✅ | Live-Test 30 Mails versendet, idempotent |
| **W3** Smart-Score Null-Safety | ✅ | 4 neue Unit-Tests grün |
| **W4** HW-Reaktivierung | ✅ | 3 stille HW erkannt, Re-Send-Schutz aktiv |
| **V1** Sichtbarkeit-Recompute | ⚠️ Schwelle | nach Cron: avg_score Gold 51, Silber 56 — Gold-Schwelle (75) zu streng |
| **V2** Empty-State | ✅ | rendert wenn tickets.length===0 |
| **V3** Markt-Stats | ✅ | Pro Gewerk 90d-Aggregat sichtbar |

## Neue Befunde aus Iteration 2

### 🐛 **B2-K1: `diagnose_ablauf` nur app-side, nicht trigger-side**

```
150 Diagnose-Tickets, 50 mit Ablauf, 100 ohne
```

Setting passiert in `app/dashboard-mieter/melden/page.tsx`. Wer das Ticket über einen
anderen Pfad anlegt (Seed-Script, künftige Admin-UI, externe API) bekommt **keine Frist**
→ Ticket läuft nie automatisch ab. Analog zu `verwalter_id` müsste das ein DB-Trigger sein.

### ⚠️ **B2-W1: Sichtbarkeits-Schwellen zu streng kalibriert**

```
Bronze: 45 HW, avg 50.1
Silber: 39 HW, avg 55.6
Gold:   16 HW, avg 51.1   ← niedriger als Silber!
```

Mit ZIEL_SLOTS=20 + ZIEL_BIDS=10 erreichen wenige HW genug für Gold (≥75 Punkte). Die
16 Gold-HW kommen aus den HW die der Cron nicht aktualisiert hat (alte Seed-Werte).
Schwellen sollten an realer Verteilung kalibriert sein, z. B. P85 → Gold, P50 → Silber.

### ⚠️ **B2-W2: Mieter-Dashboard sieht den Diagnose-Befund nicht**

```
app/dashboard-mieter/page.tsx — 0 Erwähnungen von ticket_typ, Befund, projekt_angebot
```

Wenn ein Mieter eine Diagnose bucht und der HW gibt einen Befund + Angebot ab, sieht der
Mieter im Dashboard nichts davon — nur eine "in Bearbeitung"-Karte. Er kann nicht
einschätzen ob/wann der Verwalter entscheidet. Symmetrisch zum K1-Befund von Iteration 1,
nur für die Mieter-Seite.

### ⚠️ **B2-W3: Handwerker-Dashboard zeigt eigene Sichtbarkeits-Stufe nicht**

```
app/dashboard-handwerker/page.tsx + profil/page.tsx — 0 Erwähnungen von
sichtbarkeit_stufe, verfuegbarkeit_score, angebotstreue
```

V1-Cron berechnet täglich die Stufe — aber der HW erfährt nie davon. Damit gibt es
keinen Anreiz, Slots zu pflegen oder Bewertungen zu sammeln. Die ganze Gamification
ist im Backend bezahlt, im Frontend unsichtbar.

### ℹ️ **B2-W4: Seed simuliert Verwalter-Annehmen nicht**

```
0 Projekt-Tickets aus 110 Befunden
```

Das verzerrt das Conversion-Bild. Für realistische Sim sollte der Seed ~30 % der
Befunde durchschleusen (projekt-annehmen + projekt-zur-auktion). Aber: das ist
Sim-Tool-Lücke, kein Production-Bug.

## Maßnahmen-Vorschlag Iteration 2

| Item | Priorität | Schätzung |
|---|---|---|
| **B2-K1** Diagnose-Ablauf-DB-Trigger (analog `fill_verwalter_id_on_ticket`) | 🔴 | 10 Min |
| **B2-W2** Mieter-Dashboard Diagnose-Awareness (Befund-Karte, Status-Pipeline) | 🟡 | 30 Min |
| **B2-W3** HW-Dashboard Stufen-Badge + Score-Aufschlüsselung | 🟡 | 30 Min |
| **B2-W1** Sichtbarkeits-Schwellen kalibrieren (Quartile statt fester Werte) | 🟢 | 20 Min |
| **B2-W4** Seed um Verwalter-Pipeline-Simulation erweitern | 🟢 | 30 Min |

Empfehlung: **B2-K1 (Trigger) sofort**, da Daten-Konsistenz. Danach B2-W2 + B2-W3
zusammen (symmetrische UX-Polish für die andere Seite der Pipeline).
