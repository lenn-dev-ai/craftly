-- Audit 2.0 (#242/#245): Tabellen ohne jegliche Code-Referenz entfernen.
-- handwerker_stats: Relikt aus dem alten Yield-Management-Sprint
--   (20240401000000_yield.sql), nie im App-Code verwendet, 0 Zeilen.
-- reporting_config, reports_archive: nie implementiertes Sprint-W/T
--   "MEA-Reporting"-Schema, nur in archivierten Planungs-Docs erwähnt,
--   0 Zeilen, kein Code-Bezug.
DROP TABLE IF EXISTS public.handwerker_stats CASCADE;
DROP TABLE IF EXISTS public.reporting_config CASCADE;
DROP TABLE IF EXISTS public.reports_archive CASCADE;
