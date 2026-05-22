# Migration-Reihe 2026-06-05 — Backlog-Hygiene aus Urlaubs-Vorbereitung

Vorbereitet 22.05.2026 von Claude Code (autonome Urlaubs-Session). Lennart wendet die Files in der Reihenfolge unten nach Rückkehr (~04.06.) via Supabase-MCP oder Studio SQL-Editor an.

## Reihenfolge & Charakter

| Datei | Risiko | Direkt apply? |
|---|---|---|
| `20260605000000_function_search_path_fix.sql` | gering | ✅ direkt |
| `20260605000010_add_indexes_for_unindexed_fks.sql` | gering | ✅ direkt |
| `20260605000020_drop_verfuegbarkeiten_table.sql` | gering (Backup-Drop nach B4) | ✅ direkt, sofern keine neuen aktiven Rows |
| `20260605000030_unused_indexes_review.sql` | mittel | ⚠️ Review-File, einzelne DROPs aktivieren |
| `20260605000040_auth_rls_initplan_refactor.sql` | hoch (Policy-Touch) | ⚠️ Skelett, tabellenweise applyen |

## Was jeweils gefixt wird (Advisor-Lints, Stand 22.05.2026)

- `function_search_path_mutable`: 18 Funktionen → Standard-Set `search_path = public, pg_temp`
- `unindexed_foreign_keys`: 14 FK ohne Index → CREATE INDEX
- `drop verfuegbarkeiten`: B4-Follow-up nach 2 Wochen Beta-Erprobung
- `unused_index`: 15 Indizes ohne Scans seit pg_stat_reset() → REVIEW (einige sind Cron-relevant!)
- `auth_rls_initplan`: ~57 Policies rufen `auth.uid()` ohne `(SELECT ...)`-Wrapper → Re-Eval pro Row

## Nicht in dieser Reihe (post-Urlaub-Sprints)

- `multiple_permissive_policies` (41): erfordert Konsolidierung von überlappenden Policies — riskant ohne Test-Coverage, Cowork sollte eigenen Sprint dafür planen.
- Next.js Major-Upgrade (15.x/16.x): die in 14.2.35 noch offenen CVEs sind nur in 15.5.16+ gefixt, das ist aber Breaking-Change-Risiko.

## Verifikation nach Apply

```sql
-- Nach 20260605000000: search_path_check
SELECT n.nspname || '.' || p.proname AS fn,
       p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f';

-- Nach 20260605000010: alle FK haben Index
SELECT mcp__supabase__get_advisors performance;  -- via MCP

-- Nach 20260605000020: verfuegbarkeiten weg
SELECT * FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'verfuegbarkeiten';
```

## Hintergrund

Diese Migrations sind während Lennarts Urlaub 22.05–04.06.2026 vorbereitet worden. Beta-Start ist auf nach Rückkehr verschoben. Ziel: dass Lennart nach dem Urlaub in einer geordneten Welle alle aufgelaufenen Advisor-Findings abräumen kann, ohne neue Specs schreiben zu müssen.
