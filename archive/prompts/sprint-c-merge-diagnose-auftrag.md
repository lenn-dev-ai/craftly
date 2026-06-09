# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Sprint C — Diagnose ↔ Auftrag mergen (zu Phase im Auftrag)

> Konzept-Entscheidung Lennart 18.05.2026: **Mergen — Diagnose ist nur eine Phase, keine separate Entität**.
> Aufwand L (mehrere Stunden, Schema-Migration). Sub-Sprints empfohlen.

## Ziel

Eine zentrale Entität: **Auftrag**. Lebenszyklus in Phasen:

```
gemeldet → diagnose → angebot → reparatur → erledigt
                                    ↑
                                    └ optional: nachtrag/genehmigung
```

„Diagnose" ist nur ein Status/Phase im Auftrag — keine separate Tabelle, keine eigenen API-Routes. Aktuell hat Reparo `/diagnose/*`-Routes + Diagnose-Tabelle parallel zu Auftrag — soll konsolidiert werden.

## Begründung

- User-Feedback `1c0964f1`: „Machen Diagnose Aufträge wirklich Sinn? Aufteilung verwirrend."
- Lennart-Entscheidung: mergen
- Reduziert Mental-Model: User denkt nur in „Aufträgen", nicht in zwei Welten
- Aktuell: Verwalter hat doppelte Buchhaltung (ein Diagnose-Auftrag + danach ein „richtiger" Auftrag)

## Phasen-Plan (STRIKT in Reihenfolge, Lennart-Approval pro Schema-Phase!)

### Phase C1: Bestandsaufnahme (Code-only, lesen)

Claude Code findet alle Diagnose-spezifischen Files:
- `app/api/diagnose/*` (alle Routes)
- `app/dashboard-handwerker/diagnosen/page.tsx`
- DB-Tabellen mit `diagnose` im Namen
- Frontend-Komponenten die `diagnose` referenzieren

Liefert eine **Inventur** (kein Code-Change). Cowork dokumentiert in BETA-FEEDBACK.

### Phase C2: Schema-Migration vorbereiten (KEIN DROP)

Migrations-Spec für Lennart-Review:
- `tickets.status` enum erweitern um `'diagnose'` falls noch nicht da
- `tickets.diagnose_befund` text-Feld hinzufügen (für HW-Eintrag)
- `tickets.diagnose_pauschale` numeric (für Diagnose-Termin-Kosten)
- Alle vorhandenen `diagnose_*` Tabellen-Daten in `tickets` migrieren (Insert + Update)
- Old-Tables NICHT droppen, nur als deprecated markieren via Comment

**STOP für Lennart-Approval** bevor Migration ausgeführt wird.

### Phase C3: API-Routes konsolidieren

- `app/api/diagnose/termin-annehmen` → wird Teil von `app/api/auftraege/annehmen` (Status-abhängige Logik)
- `app/api/diagnose/befund-abgeben` → wird `app/api/auftraege/befund-abgeben` (universell)
- `app/api/diagnose/projekt-annehmen` → `app/api/auftraege/projekt-annehmen`
- `app/api/diagnose/projekt-zur-auktion` → kann gestrichen werden (Status-Transition reicht)

Alte `/api/diagnose/*`-Routes als deprecated markieren (302-Redirect für 2 Wochen Übergang).

### Phase C4: UI konsolidieren

- HW-Sidebar: „Diagnosen"-Eintrag entfernen → ersetzt durch Filter „Aufträge in Diagnose-Phase"
- Verwalter-Marktplatz: „Diagnose-Aufträge"-Tab entfernen → in normaler Auftrags-Liste mit Phase-Filter
- Ticket-Detail-Komponente: Phase-Indikator (gemeldet → diagnose → angebot → reparatur → erledigt) ergänzen

### Phase C5: Old-Tables droppen (POST-Beta)

Erst nach 2 Wochen Beta, wenn sicher dass keine alten Verweise mehr da sind.
**Eigene Lennart-Approval**, eigene Migration.

## Constraints

- C2 + C5: NUR mit Lennart-Approval
- Pro Phase max. 1 Klärungsfrage
- Bei Datenmigration: vorher Backup (oder Confidence dass DROP nicht passiert)
- Pricing-Engine + Penalty-Logik nicht anfassen, alles status-quo
- Vor C2 immer erst C1 (Inventur)

## Risiken

- Bestehende Tickets in „Diagnose"-Status könnten in Limbo landen wenn Migration unvollständig → Beta-Tester betroffen
- Frontend kann Old-API-Aufrufe weiter machen während neuer Migration → 404
- Empfehlung: nicht alle Phasen in einer Session, sondern getrennt mit Test-Pause dazwischen

## Erster Schritt

Phase C1 (Inventur, nur lesen): Liefere die Liste aller `diagnose`-Files + DB-Tabellen + Verwendungsstellen. KEINE Code-Aenderungen in C1.
