-- Audit-Iter-3 (27.05.2026) — Privat-Termin im HW-Kalender.
--
-- CHECK constraint zeitslots_status_check wurde in Production per Studio
-- um 'privat' erweitert (Sprint AK Iter 3 / commit 405958a), aber nie
-- als Migration-File ins Repo committed. Diese Migration ist idempotent
-- (DROP IF EXISTS + ADD) und dient als Source-of-Truth für lokale Branches
-- + Disaster-Recovery.
--
-- 'privat' wird von HW im Kalender via Modal gesetzt und blockt
-- Marktplatz-Queries (filtern bereits auf status='verfuegbar').

ALTER TABLE public.zeitslots DROP CONSTRAINT IF EXISTS zeitslots_status_check;
ALTER TABLE public.zeitslots ADD CONSTRAINT zeitslots_status_check
  CHECK (status IN ('verfuegbar', 'reserviert', 'vergeben', 'abgelaufen', 'privat'));

COMMENT ON CONSTRAINT zeitslots_status_check ON public.zeitslots IS
  'Erlaubte Status: verfuegbar (Marktplatz), reserviert (Gebot offen), vergeben (Auftrag), abgelaufen (Frist), privat (Sprint AK Iter 3 — HW-eigene Sperre, blockt Marktplatz-Queries).';
