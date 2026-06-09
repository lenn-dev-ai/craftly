# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint B — Slot ↔ Verfügbarkeit mergen

> Konzept-Entscheidung Lennart 18.05.2026: **Mergen — nur 'Verfügbarkeit' bleibt**.
> Aufwand M (~1-2 h). Klassisches Doodle-Pattern.

## Ziel

HW pflegt **eine** Einheit: seine **Verfügbarkeit** (regelmäßige Wochenstruktur + ggf. Ausnahmen).
System generiert daraus konkrete Slot-Vorschläge wenn Verwalter/Mieter buchen will.
„Slot" als separates User-Konzept verschwindet.

## Aktueller Code-Stand

Im HW-Kalender (`app/dashboard-handwerker/kalender/page.tsx`) gibt es 3 Chip-Layer:
- **Termine** (bestätigte Aufträge)
- **Slots** (konkrete Buchungs-Slots vom HW manuell angeboten)
- **Verfügbarkeit** (generelle Wochenstruktur)

Aktuell ist „Slot" und „Verfügbarkeit" UI-getrennt aber semantisch überlappend. User-Feedback `625be650`: „Was ist der Unterschied? Brauchen wir beide?"

## Implementations-Plan (Phasen)

### Phase B1: User-Konzept klären (Code-only, keine Schema-Änderung)

- In der HW-Sidebar/UI: „Slots"-Chip umbenennen zu „Buchungsfenster" oder ganz entfernen (Slots werden gleichbedeutend mit Verfügbarkeit)
- **Mein Vorschlag (autonom): Slot-Chip ganz entfernen.** Verfügbarkeit-Chip übernimmt visuell beides
- Klick auf leere Stunde → öffnet künftig „Verfügbarkeit anbieten"-Modal statt „Slot anbieten"-Modal
- Wording-Update im Modal: „Diese Zeit zur Verfügung stellen — Verwalter sehen das im Marktplatz"

### Phase B2: Slot-Pflege-Konzept klar trennen

- **Wiederkehrend** (z.B. „jeden Montag 8-12"): separate Maske (`/dashboard-handwerker/verfuegbarkeit/wochenstruktur`)
- **Einmalig** (heutiger „Slot"): Klick im Kalender → einmaliges Zeitfenster
- Beide werden in derselben DB-Tabelle gespeichert (`zeitslots` oder umbenannt zu `verfuegbarkeit`)

### Phase B3: Frontend-Marktplatz anpassen

- Verwalter-Marktplatz zeigt aktuell „Verfügbare Slots" — bleibt so (ist eh User-Sicht)
- Aber: Slot-Filter intern aus `verfuegbarkeit` ableiten statt aus 2 Tabellen
- Sicherstellen dass HW-Wochenstruktur sich in konkrete Slots auflöst (z.B. „nächste 14 Tage werden Slots automatisch generiert aus Wochenstruktur")

### Phase B4 (optional, post-Sprint): Schema-Konsolidierung

Wenn aktuell 2 Tabellen `zeitslots` + `verfuegbarkeit` existieren:
- Migration: alles in eine Tabelle (`verfuegbarkeit`) mit `art` enum ('einmalig', 'wiederkehrend')
- BRAUCHT Lennart-OK (Schema-Touch + Daten-Migration)
- Erstmal sparen, erst nach B1-B3 evaluieren

## Constraints

- B4 (Schema) NUR nach explizitem Lennart-Approval
- B1-B3 sind Code-only, kann Claude Code in einer Session machen
- Pricing-Engine nicht anfassen
- Pro Phase max. 1 Klärungsfrage

## Erster Schritt

Phase B1: HW-Kalender-Page öffnen, Slot-Chip entfernen, Wording-Update. Diff zeigen, dann Frage „weiter mit B2?" oder direkt machen.
