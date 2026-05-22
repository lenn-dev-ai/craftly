-- Backlog-Hygiene · Vorbereitet 2026-05-22 (autonom, während Urlaub)
-- Anwendung: nach Urlaub-Rückkehr via Supabase-MCP / Studio.
--
-- B4-Follow-up: zeitslots wurde am 21.05.2026 zur konsolidierten
-- "Verfügbarkeit"-Tabelle (mit art enum). Die alte verfuegbarkeiten-
-- Tabelle wurde bewusst NICHT gedroppt, sondern als Backup erhalten,
-- bis 2 Wochen Beta-Erprobung gezeigt haben, dass kein Code mehr
-- darauf zugreift.
--
-- Stand 22.05.2026: 0 aktive Rows in verfuegbarkeiten, 0 Code-Pfade
-- referenzieren sie (siehe B4-Commit 407a875). Nach Urlaub-Rückkehr
-- ist es sicher, sie zu droppen.
--
-- Vor dem Drop noch ein finaler Sanity-Check (Migration bricht ab,
-- falls aktive Daten reinkommen während der Urlaubsphase).

BEGIN;

DO $$
DECLARE
  aktive_rows int;
BEGIN
  SELECT COUNT(*) INTO aktive_rows FROM public.verfuegbarkeiten WHERE aktiv = true;
  IF aktive_rows > 0 THEN
    RAISE EXCEPTION
      'Drop abgebrochen: % aktive Rows in verfuegbarkeiten. Erst migrieren oder Migration manuell anpassen.',
      aktive_rows;
  END IF;
END $$;

-- Vorher: dependent objects (RLS-Policies) implizit mitdroppen.
DROP TABLE IF EXISTS public.verfuegbarkeiten CASCADE;

COMMIT;
