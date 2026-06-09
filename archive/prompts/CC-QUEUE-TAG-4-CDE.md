# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# CC-Queue Tag 4 — Sprint C/D/E (UX-Polish)

> Korrigierter Paste-Block für Lennart. Verwendet die ECHTEN Dateinamen.
> (Die ursprüngliche CC-QUEUE-VACATION.md hatte falsche Filenames für C/D/E,
> weshalb CC die Files nicht gefunden hat.)

---

## Pasten in CC nachdem Tag 3 (Sprint I + K) durch ist:

```
Tag 4 — UX-Polish-Block.

Bitte arbeite die folgenden 3 Sprint-Files in dieser Reihenfolge ab:

1. PROMPTS/sprint-c-merge-diagnose-auftrag.md
   → Diagnose + Auftrag zusammenführen
   → Konzept-Entscheidung Lennart war "Mergen" (siehe BETA-FEEDBACK.md Iteration 11)
   → Commit: "feat(ux): Diagnose+Auftrag-Merge (Sprint C)"

2. PROMPTS/sprint-d-cleanup-wording-rls.md
   → Wording-Konsistenz + RLS-Cleanup
   → Keine RLS-Lockerung, nur Erweiterung wenn nötig
   → Commit: "chore(ux): Wording + RLS-Cleanup (Sprint D)"

3. PROMPTS/sprint-e-mieter-vorgang-card-inline.md
   → Mieter-Vorgang-Card inline statt separate Sicht
   → Commit: "feat(mieter): Vorgang-Card inline (Sprint E)"

4. PROMPTS/sprint-l-hw-gewerk-aus-profil.md
   → Bug-Fix aus Iteration 11 (Feedback 7de666f7): HW-Gewerk aus
     Profil-Stamm statt pro Ticket frei wählbar.
   → Cowork hat das Bug-Spec heute nachgeliefert.
   → Commit: "fix(handwerker): Stamm-Gewerke aus Profil (Sprint L)"

GLOBALE CONSTRAINTS (unverändert):
- Eigenständig durcharbeiten, keine Lennart-Rückfragen
- Schema-Migrationen idempotent via Supabase-MCP
- Pricing-Engine NICHT anfassen
- Stripe/Banking-Code NICHT anfassen
- Bei Blockern: in BETA-FEEDBACK.md als "CC-BLOCKER Sprint [X]" dokumentieren

REPORTING in BETA-FEEDBACK.md:
"Iteration 17 — Tag 4 Sprint C/D/E" mit Commit-Hashes pro Sprint.

Starte mit Sprint C.
```

---

## Falls Lennart schon vorher Tag 4 starten will

Bei zügigem CC-Throughput kann er den Block auch direkt nach Sprint I/K pasten.
CC sortiert die Queue selbst korrekt sequenziell.
