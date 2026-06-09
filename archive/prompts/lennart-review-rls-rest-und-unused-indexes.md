# ARCHIVED / OBSOLETE

Diese Datei ist historisch und nicht mehr operative Source of Truth.

Aktuelle Quellen:
- `ai/REPARO_OPERATING_SYSTEM.md`
- `ai/SESSION_HANDOFF.md`

Nicht für neue Architektur- oder Produktentscheidungen verwenden.

---

# Lennart-Review nötig — Rest auth_rls_initplan + unused_indexes

> Erstellt 25.05.2026 von Cowork (autonom).
> Sicherer Teil von beiden Review-Migrationen ist applied. Rest braucht
> manuelles Review weil pro Tabelle / pro Index Daten-Sicherheits- oder
> Performance-Risiken bestehen.

## Was Cowork bereits applied hat

### Migration `rls_initplan_helpers_and_profiles` (25.05., Cowork via MCP)

- Helper-Functions `is_admin()`, `is_handwerker()`, `is_verwalter()` nutzen jetzt
  intern `(SELECT auth.uid())` statt `auth.uid()` → identisches Verhalten,
  besseres Caching im Query-Plan
- 3 profiles-Policies (`profiles_insert`, `profiles_select`, `profiles_update`)
  refaktoriert auf `(SELECT auth.uid())`

Verifiziert via `pg_policies` — neue Policies aktiv, alte Versionen weg.

## Was NOCH offen ist — auth_rls_initplan

47 weitere Policies in 17 Tabellen mit gleichem Pattern. Cowork hat sie
NICHT angefasst weil DROP + CREATE auf produktiver DB pro Policy ein
kurzes Fenster mit fehlender Sicherheit hat — bei Beta-Traffic minimal,
aber bei Reklamation („wer hat in der Sekunde was geschrieben?") schwer
zu erklären.

**Empfehlung — Reihenfolge:**

Tabellen mit wenig Daten / niedrigem Risiko zuerst:
1. `feedback` (2 Policies) — niedriges Risiko, kleiner Tisch
2. `bewertungen` (1 Policy) — ähnlich
3. `einladungen` (3 Policies)
4. `nachrichten` (4 Policies)
5. `nachtraege` (3 Policies)
6. `objekte` (2 Policies)
7. `private_termine` (4 Policies)
8. `handwerker_stats` (3 Policies)
9. `routen_planung` (2 Policies)
10. `termine` (7 Policies)
11. `tickets` (3 Policies) — wichtigste, ganz am Ende
12. `zeitslots` + `zeitslot_gebote` (7 Policies)
13. `angebote` (6 Policies)
14. `provisionen` (2 Policies)
15. `diagnose_preise` (1 Policy)

**Wie umsetzen:**

Option A — selbst via Supabase-MCP (kontrolliert):
```bash
# Pro Tabelle ein Mini-Migrations-File, dann via MCP applyen
# Cowork kann pro Tabelle helfen wenn du sagst „mach jetzt feedback"
```

Option B — alle in einem Rutsch in Wartungsfenster (z.B. nachts 03:00):
- 1 große Migration mit allen Tables-Policies
- BEGIN ... COMMIT — atomar, kein Sicherheits-Fenster

Cowork-Empfehlung: **Option B in einem nächtlichen Wartungsfenster**.
Aufwand 1-2h. Beta-Traffic ist nachts ~0.

## Was NOCH offen ist — unused_indexes

43 Indizes ohne idx_scan in pg_stat_user_indexes (Stand 25.05.).

Die meisten sind **NICHT** wirklich unused:
- **Cron-Indizes** (idx_termine_status_created, tickets_penalty_status_idx, idx_ki_cache_created_at):
  werden periodisch genutzt — Statistik registriert nur seit letztem `pg_stat_reset()`
- **Geo-Indizes** (idx_*_location): erst aktiv wenn Marktplatz-Geo-Suche live
- **Sichtbarkeits-/Verfügbarkeits-Indizes**: brauchen aktive Cron-Pflege

Echte Drop-Kandidaten laut CC-Review:
- `idx_profiles_verifiziert` (Verifikations-Feature nicht live)
- `idx_angebote_handwerker_id` (FK-Index, evtl. doppelt mit `add_indexes_for_unindexed_fks`)
- `idx_angebote_handwerker_status` (composite, evtl. redundant)
- `idx_bewertungen_handwerker` (redundant zu FK-Index)
- `idx_profiles_bewertung` (redundant zu Sort-Index)

**Empfehlung:**

NICHT droppen vor Beta-Start. Erst nach 30 Tagen Beta-Traffic den
Performance-Advisor erneut abfragen — wenn diese Indizes dann immer noch
0 Scans haben, sind sie wirklich unused.

```sql
-- Diagnose erneut nach 30 Tagen Beta:
SELECT schemaname||'.'||relname AS tabelle, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

Wenn Liste dann immer noch lang ist, droppen — sind dann sicher unused.

## Wann ist „done"

- auth_rls_initplan komplett: nach Wartungsfenster + Smoke-Test
- unused_indexes: nach 30 Tagen Beta + erneutem Review

Beides ist NICHT Beta-Blocker. Performance-Advisor-Warnungen verschwinden
nach Apply, aber Beta funktioniert auch jetzt schon.
