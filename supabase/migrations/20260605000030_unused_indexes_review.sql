-- Backlog-Hygiene · Vorbereitet 2026-05-22 (autonom, während Urlaub)
-- **NICHT direkt anwenden!** Diese Migration ist ein REVIEW-File —
-- Lennart/Cowork entscheiden pro Index ob droppen oder behalten.
--
-- unused_index (Performance-Advisor, Stand 22.05.2026): 15 Indizes
-- markiert als "noch nie genutzt" laut pg_stat_user_indexes.
--
-- ACHTUNG: "unused" laut Statistik heißt nicht "unnötig". Speziell:
-- - Indizes für Cron-Jobs (z.B. tickets_penalty_status_idx,
--   idx_termine_status_created, idx_ki_cache_created_at) werden nur
--   periodisch genutzt — Statistik kann sie nicht erkennen wenn die
--   Cron-Routes seit dem letzten pg_stat_reset() noch nicht liefen.
-- - Geo-Indizes (idx_*_location) werden erst aktiv wenn räumliche
--   Suche live im Marktplatz feuert (Beta-Phase).
-- - sichtbarkeits-/verfügbarkeits-Indizes brauchen aktive Cron-Pflege.
--
-- Empfehlung pro Index:

-- ❌ behalten (Cron-relevant, periodisch genutzt):
--   tickets_penalty_status_idx       → abwicklungsfrist-cron
--   idx_termine_status_created       → termin-reminder-cron (K1.3c)
--   idx_ki_cache_created_at          → ki-cache-TTL-cleanup

-- ⚠️ behalten (Beta-Phase erst aktiv):
--   idx_profiles_location, idx_tickets_location, idx_objekte_location,
--   idx_zeitslots_location           → räumliche Suche im Marktplatz
--   idx_angebote_routen              → Route-Optimizer
--   idx_profiles_rolle_handwerker    → HW-Auswahl

-- ✅ droppen-Kandidaten (wirklich unused, redundant):
--   idx_profiles_verifiziert         → wenn Verifikations-Feature nicht live
--   idx_angebote_handwerker_id       → ist FK, sollte aber von add_indexes_for_unindexed_fks abgedeckt sein
--   idx_angebote_handwerker_status   → composite, evtl. redundant zu obigem
--   idx_bewertungen_handwerker       → redundant zu FK-Index
--   idx_profiles_bewertung           → redundant zu Sort-Index

-- Lennart-Review-SQL (auskommentiert, einzeln aktivieren):

BEGIN;

-- DROP INDEX IF EXISTS public.idx_profiles_verifiziert;
-- DROP INDEX IF EXISTS public.idx_angebote_handwerker_id;
-- DROP INDEX IF EXISTS public.idx_angebote_handwerker_status;
-- DROP INDEX IF EXISTS public.idx_bewertungen_handwerker;
-- DROP INDEX IF EXISTS public.idx_profiles_bewertung;

ROLLBACK; -- per Default kein Drop; aktivieren + COMMIT durch Lennart

-- Diagnose-Hilfe: aktueller Stats-Snapshot pro Index
SELECT
  schemaname || '.' || relname AS tabelle,
  indexrelname AS index_name,
  idx_scan AS scans,
  idx_tup_read AS rows_read,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
