# Konzept — Google-Calendar-Sync für Handwerker

> Lennart-Feedback `b1ad8083` (25.05.): „Ich bin damit immer noch nicht
> happy — das ist extrem manuell. So bekommen wir die Handwerker nicht
> wenn die erstmal händisch ihren ganzen Kalender pflegen müssen. Das
> muss über Google oder so erfolgen."
>
> Status: KONZEPT, kein Sprint-Spec. Aufwand-Schätzung ~2-3 Tage CC.

## Problem

Aktuell muss HW seine Verfügbarkeit manuell in Reparo pflegen:
- Zeitslots erstellen
- Kalender-Einträge anlegen
- Bei jedem neuen Termin: doppelte Pflege (Reparo + eigener Kalender)

**Konsequenz:** HW würden Reparo nicht regelmäßig nutzen → Marktplatz wäre leer.

**Show-Stopper für HW-Adoption.**

## Lösung — 3 Optionen

### A) Google Calendar Sync (OAuth) — Cowork-Empfehlung

**Wie es funktioniert:**
1. HW klickt „Mit Google verbinden" in Profil
2. OAuth-Flow → Reparo bekommt Read-Only-Zugriff auf 1 Cal
3. Reparo liest free/busy-Slots
4. Verfügbar-Slots in Reparo = freie Zeit im Google-Cal
5. Bei Reparo-Termin-Vergabe: Event wird in Google-Cal geschrieben (mit „📍 Reparo-Auftrag X")
6. HW pflegt nur noch Google-Cal, Reparo synct

**Pro:**
- Marktstandard (Google = 70%+ aller Cal-User)
- OAuth-Flow ist bekannte Technik
- Free-Slots automatisch
- HW erleben „Magie": eintragen ohne Aufwand

**Contra:**
- Setup-Hürde: OAuth-Permission verstehen
- HW ohne Google-Cal sind ausgeschlossen
- API-Quotas bei Google (Free: 1M calls/Tag)
- Konflikt-Edge-Cases (HW löscht Reparo-Event im Cal — was passiert?)

**Aufwand:** ~2-3 Tage CC
- 1 Tag OAuth-Flow + Google-Cal-API
- 1 Tag Sync-Logik + Konflikt-Handling
- 0.5 Tag UI in HW-Profil

### B) iCal/CalDAV — universeller, komplexer

Funktioniert auch mit Apple-Cal, Outlook-Cal. ABER:
- Read-Only ist ok, Write zurück ist schwer
- Sync-Loop bei Apple-Cal nicht zuverlässig

**Cowork-Take:** zu komplex für Beta, später als „Pro-Feature".

### C) Manuelle Eingabe + AI-Vorschläge

System schlägt Verfügbarkeits-Muster vor basierend auf:
- HW-Profil (z.B. „arbeitet Mo-Fr 8-17")
- Vergangene Aufträge
- HW kann „so übernehmen" klicken statt manuell tippen

**Cowork-Take:** löst nicht das Kernproblem (zu manuell), nur Komfort-Reduktion.

## Cowork-Empfehlung

**Option A.** MVP in 2-3 Tagen CC. Marktstandard. HW versteht es sofort.

**Reihenfolge:**
1. Post-Urlaub: Lennart bestätigt Konzept
2. Cowork schreibt detaillierte Sprint-AE-Spec
3. CC baut OAuth-Flow + Sync-Logik
4. Beta-HW testen

**Wichtige Edge-Cases die im Sprint-Spec adressiert werden müssen:**
- HW löscht Reparo-Event im Cal → Auftrag-Status?
- HW ändert Reparo-Event-Zeit im Cal → wer informiert Mieter?
- HW disconnects Google → was passiert mit Bestands-Terminen?
- Zeitzonen (besonders DST-Wechsel)

## Verbindung zu anderen Sprints

- Sprint B (Slot+Verfügbarkeit-Merge) hat Verfügbarkeits-Modell konsolidiert
- Sprint AE (NEU) würde Google-Cal als 3. Sync-Quelle dazustellen
- Voice-AI V2: könnte Mieter direkt „Termin mit dem HW vereinbaren" — verbindet sich gut

## Status

WARTET auf Lennart-Bestätigung nach Urlaub. Konzept dokumentiert.
