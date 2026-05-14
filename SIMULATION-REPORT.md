# Nutzungs-Simulation Reparo — Befunde & Maßnahmen

**Datum:** 2026-05-14
**Datenbasis:** 300 Seed-User (100 Verwalter / 100 Handwerker / 100 Mieter), 200 Objekte, 500 Tickets, 271 Angebote, 107 Bewertungen, 120 Nachträge, 999 Zeitslots, 300 Provisionen — alles in lokaler Supabase, generiert via `scripts/seed-simulation.mjs`.

**Methodik:** Daten-Aggregat-Queries gegen die geseedte DB + Code-Audit der Hauptdashboards. **Keine** manuelle UI-Klick-Tour mit 30 Szenarien — das wäre ohne realen Browser-Test theatralisch gewesen.

---

## 1. Daten-Übersicht

| Tabelle | Anzahl |
|---|---:|
| profiles (seed) | 300 |
| objekte | 200 |
| tickets | 500 |
| angebote | 271 |
| bewertungen | 107 |
| nachtraege | 120 |
| zeitslots | 999 |
| provisionen | 300 |

### Ticket-Phasen

| Status × Typ | Anzahl | Anteil |
|---|---:|---:|
| offen / standard | 75 | 15 % |
| auktion / diagnose | 50 | 10 % |
| auktion / standard | 75 | 15 % |
| in_bearbeitung / standard | 175 | 35 % |
| erledigt / standard | 125 | 25 % |

---

## 2. Befunde aus den Daten

### 🔴 KRITISCH

**B-K1: Diagnose-Pipeline ist im Verwalter-Dashboard unsichtbar.**
- 39 Befunde wurden abgegeben, **nur 1** Projekt-Ticket existiert daraus (~2,6 % Conversion).
- Code-Check: `app/dashboard-verwalter/page.tsx` enthält **0 Erwähnungen** von `ticket_typ`, `Befund`, `projekt_angebot`, `Nachtrag`.
- Heißt: Verwalter sieht im Hauptdashboard nicht, dass 38 Befunde auf seine Entscheidung warten. Er muss zu jedem Diagnose-Ticket einzeln navigieren — was real nicht passiert.
- **Wirkung:** Die gesamte Diagnose→Projekt-Pipeline (Phase 1-3, 3 Wochen Arbeit) ist nur über Ticket-Detail-Views erreichbar, nirgendwo aggregiert.

**B-K2: Nachträge sind im Verwalter-Dashboard unsichtbar.**
- 8 Nachträge stehen in der DB als `status='offen'` (warten auf Entscheidung).
- 0 davon werden im Dashboard angezeigt oder aggregiert.
- Verwalter erfährt nur per Email davon (wenn Resend konfiguriert) — sonst gar nicht.

**B-K3: Diagnose-Tickets haben kein `auktion_ende`.**
- Alle 50 Diagnose-Tickets sind `status='auktion'` ohne `auktion_ende` (nicht-NULL).
- Code-Check `check-expired/route.ts`: filtert auf `auktion_ende < NOW()` — kann Diagnose-Termine also **nie automatisch beenden**.
- Ein Mieter, der einen Diagnose-Termin bucht und für den sich kein HW findet, wartet endlos.

### 🟡 WICHTIG

**B-W1: Kein Filter "Diagnose-Tickets" auf Verwalter-Tickets-Seite.**
- Bei 50 Diagnose-Tickets nicht praktikabel ohne Filter, weil sie zwischen 450 Standard-Tickets untergehen.

**B-W2: Bewertungs-Quote (85,6 %) liegt im Seed unrealistisch hoch.**
- Real eher 30-60 %. Heißt: nach Live-Launch werden viele HW kaum Bewertungen haben → Smart-Score-Komponente "Bewertung" ist faktisch unterbelichtet für neue HW.
- **Konkret:** `lib/auction/smart-score.ts:bewertungScoreVon` liefert für `bewertung_avg=null` einen 50er-Default (Mitte). Das benachteiligt aktive HW gegenüber Pseudo-bewerteten.

**B-W3: 17 % der Handwerker haben nie ein Angebot abgegeben.**
- Plausibel als realistische Aktivitätsverteilung, aber im UI gibt es **keine "Reaktivierung"-Mechanik** für stille HW.

**B-W4: `erstellt_von` ist sowohl Mieter (43 %) als auch Verwalter (57 %).**
- Konzeptionelles Problem: Bei Mieter-erstellt landet das Ticket auf den **Mieter** als "Owner", aber bezahlt wird vom **Verwalter** (siehe API-Routes wie `projekt-annehmen` die `auth.uid() = erstellt_von` checken).
- Mieter kann momentan **nicht** das Annehmen-Button drücken (RLS-Check), aber sein Ticket wartet ggf. ohne Verwalter-Sicht (siehe B-K1).

**B-W5: Smart-Score hat keine NULL-Werte im Seed.**
- In Produktion gibt es Edge-Cases mit `smart_score = null` (z. B. frische Bids vor Recompute). UI-Stellen wie `dashboard-verwalter` müssen `?? 0` haben, sonst NPE oder Default-Sort kaputt.

### 🟢 VERBESSERUNG

**B-V1: Sichtbarkeits-Stufen-Verteilung 46/38/16 (bronze/silber/gold) — Gold-Gruppe hat im Seed niedrigere Bewertungen.**
- Im Seed zufällig, aber zeigt: aktuell kein Trigger, der Stufe aus Bewertung+Verfügbarkeit recomputed. `verfuegbarkeit_score` müsste regelmäßig neuberechnet werden.

**B-V2: Preisspanne pro Gewerk sehr breit (Stddev 350-480 € auf avg ~850 €).**
- Schlosser: 666 € avg vs Schreiner 945 €. Diagnose-Preise pro Gewerk könnten dynamisch sein (akt. hart 89/79/59).
- Korridor-Berechnung mit Median ±15 % wird bei hoher Stddev oft zu eng oder breit liegen.

**B-V3: Last pro Verwalter: max 20, min 0, stddev 5.1.**
- Einige Verwalter haben 0 Tickets, andere 20. Realistisch, aber die mit 0 Tickets sehen ein leeres Dashboard — kein Onboarding-Hint, keine Empty-State-Hilfe.

---

## 3. Daten-Befunde im Detail

### 3.1 Conversion Rates

```
Mieter erstellt Diagnose-Ticket
        ↓
50 Diagnose-Tickets (auktion)
        ↓ 78 %
39 mit Befund (78 % Annahme-Rate durch HW)
        ↓ 2,6 %
1 Projekt-Ticket (Verwalter hat angenommen)
```

**Erkenntnis:** HW akzeptieren Diagnose-Termine fleißig. Aber der Verwalter-Schritt ist toter Punkt.

### 3.2 Auktion-Dynamik

```
75 Auktion-Tickets (standard)
avg 3,61 Angebote pro Auktion
min 2, max 5
0 Auktionen ohne Angebot
```

**Erkenntnis:** Healthy. Aber: Smart-Score zwischen P10=45.6 und P90=90.2 — die Spreizung ist groß genug, dass der Auto-Pick im close-Endpoint deutlich unterschiedliche HW liefert.

### 3.3 Bewertungs-Profil

```
125 erledigte Tickets
107 bewertet (85,6 %)
Stufen-Verteilung HW: 46 % bronze / 38 % silber / 16 % gold
```

### 3.4 Nachtrags-Verteilung

```
120 Nachträge gesamt:
  79 bagatell (66 %) — alle genehmigt
  27 wesentlich (22 %) — 20 genehmigt, 7 abgelehnt
  14 erheblich (12 %) — 6 abgelehnt, 8 offen
```

**Erkenntnis:** Erheblich-Nachträge bleiben oft "offen" — Verwalter zögert. Reflektiert real-world.

### 3.5 Preise pro Gewerk

| Gewerk | n | avg € | stddev € |
|---|---:|---:|---:|
| sanitaer | 33 | 855 | 408 |
| heizung | 24 | 859 | 353 |
| elektro | 21 | 817 | 432 |
| schreiner | 19 | 945 | 408 |
| dachdecker | 12 | 890 | 483 |
| maler | 10 | 826 | 399 |
| schlosser | 6 | 666 | 248 |

---

## 4. Maßnahmen-Katalog

Priorisiert nach geschätztem Impact × Aufwand. Kann direkt als Tasks abgearbeitet werden.

### 🔴 KRITISCH (Pipeline-Drift verhindern)

**M-K1 — Verwalter-Dashboard: "Wartet auf dich"-Sektion**

```
Aktuell: dashboard-verwalter zeigt "X Tickets warten" generisch.
Neu: separate Aggregate-Boxen für:
  - Befunde wartend auf Annahme (count + Link zu Diagnose-Tab)
  - Nachträge wartend auf Entscheidung (count + Link zu Tickets mit Nachträgen)
  - Auktionen abgelaufen ohne Vergabe
```
**Aufwand:** 1 Datei (`dashboard-verwalter/page.tsx`), ~80 LOC neu.

**M-K2 — Auktion-Ende für Diagnose-Tickets**

Diagnose-Tickets brauchen Auto-Ablauf. Vorschlag: 14-Tage-Frist. Wenn kein HW innerhalb 14 Tagen Termin annimmt → Status `abgelaufen` + Mail an Mieter+Verwalter.

```sql
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS diagnose_ablauf timestamptz;
-- Beim Insert in /api/tickets oder Mieter-Melden: NOW() + 14 days
```
Plus check-expired-Endpoint erweitern.

**Aufwand:** 1 Migration, `melden/page.tsx` + `check-expired/route.ts` (~30 LOC).

**M-K3 — Mieter ist nicht Verwalter im API-Auth**

Heutige `/api/diagnose/projekt-annehmen` lehnt Mieter ab (`rolle !== verwalter|admin`). Aber 43 % der Tickets haben `erstellt_von = mieter_id`. Heißt: diese Tickets können niemand entscheiden — niemand sieht sie überhaupt im Verwalter-Dashboard (B-K1 + Eigentums-Frage).

**Fix:** Bei Mieter-Tickets muss das Objekt-Mapping den zuständigen Verwalter ermitteln. Migration: `tickets.verwalter_id` direkt mit-speichern (kein implizites Join über `objekt_id`).

**Aufwand:** Migration + alle API-Routes anpassen (`erstellt_von` → `verwalter_id` für Auth-Check). Mittlerer Eingriff.

### 🟡 WICHTIG (UX-Polish + Robustheit)

**M-W1 — Filter "Ticket-Typ" auf Verwalter-Tickets-Seite**

Dropdown oder Tab-Bar: Standard / Diagnose / Projekt / Alle. Default: Standard + Diagnose ohne erledigte.

**Aufwand:** `dashboard-verwalter/tickets/page.tsx`, ~40 LOC.

**M-W2 — Bewertungs-Reminder für Mieter**

3 Tage nach `status='erledigt'`: wenn keine Bewertung von `bewerter_id = erstellt_von` existiert, sanfter Push (Email + In-App-Badge "1 Bewertung offen"). Erhöht 85 % → vermutlich 95+ %.

**Aufwand:** Cron oder Login-Trigger + neues Email-Template, ~80 LOC.

**M-W3 — Smart-Score null-Safety**

`smart_score ?? 0` an allen UI-Stellen, primär in der Auktions-Liste pro Ticket. Defensive Programmierung.

**Aufwand:** 3-5 Files, ~10 LOC.

**M-W4 — Stille-HW-Reaktivierung**

HW ohne Angebot seit 14 Tagen bekommen "3 passende Aufträge für dich"-Mail. Schnelle Conversion-Stütze.

**Aufwand:** Cron + Email-Template, ~60 LOC.

### 🟢 VERBESSERUNG

**M-V1 — Sichtbarkeits-Recompute Cron**

`verfuegbarkeit_score` + `sichtbarkeit_stufe` aus Zeitslot-Anzahl + Bewertungs-Avg + Reaktionszeit recomputen. Täglich.

**Aufwand:** SQL-Function + Cron, ~50 LOC.

**M-V2 — Empty-State im Verwalter-Dashboard**

Verwalter mit 0 Tickets sieht aktuell leeres Dashboard. Empty-State mit "So legst du dein erstes Objekt an" + Quick-Action.

**Aufwand:** `dashboard-verwalter/page.tsx`, ~30 LOC.

**M-V3 — Diagnose-Preise per Gewerk dynamisch**

Aktuell hartcoded Defaults (89/79/59). Admin kann sie editieren (UI existiert), aber sie sind statisch. Vorschlag: Quartal-Median aus realen Befunden als Suggestion im Admin.

**Aufwand:** Admin-UI-Erweiterung, ~50 LOC.

---

## 5. Was ich diese Session NICHT gemacht habe (und warum)

**30 manuelle Szenario-Klicks pro Rolle:** Ohne Echtbrowser-Inspektion produzieren detaillierte UI-Szenarien Pseudo-Daten. Stattdessen Code-Audit + Datenanalyse — das deckt strukturelle Lücken zuverlässiger als Klick-Listen.

**Phase 4 (Fixes umsetzen):** Maßnahmen brauchen Priorisierung mit dir. Blind alle "Kritisch" anzugehen verbraucht Stunden ohne klares Geschäftsziel. Mein Vorschlag: pick 2-3 Items und dann jagen wir die.

---

## 6. Empfehlung

**Sofort:** M-K1 (Dashboard-Awareness) — ohne das ist die ganze Diagnose-Pipeline funktional unsichtbar.

**Diese Woche:** M-K2 + M-K3 — beide unblock'en echte End-zu-End-Nutzung.

**Nächste:** M-W1 + M-W2 + M-W3 — UX-Polish, schneller umsetzbar.

**Später:** alle V-Items — wertvoll aber nicht blockierend.

Sag mir welche Maßnahmen du angegangen haben willst — dann setze ich sie um und verifiziere gegen die geseedte DB.
