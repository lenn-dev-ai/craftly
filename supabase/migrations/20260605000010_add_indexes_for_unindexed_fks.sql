-- Backlog-Hygiene · Vorbereitet 2026-05-22 (autonom, während Urlaub)
-- Anwendung: nach Urlaub-Rückkehr via Supabase-MCP / Studio.
--
-- unindexed_foreign_keys (Performance-Advisor): 14 FK-Constraints ohne
-- covering Index. Postgres muss bei DELETE/UPDATE auf der referenzierten
-- Tabelle einen Sequential-Scan auf der referenzierenden machen — bei
-- größeren Tabellen schmerzhaft.
--
-- Standard-Fix: CREATE INDEX auf die FK-Spalte.
-- Idempotent: IF NOT EXISTS.
-- Spalten-Namen abgeleitet aus dem FK-Constraint-Namen (`<table>_<col>_fkey`).

BEGIN;

CREATE INDEX IF NOT EXISTS idx_bewertungen_bewerter_id
  ON public.bewertungen (bewerter_id);
CREATE INDEX IF NOT EXISTS idx_bewertungen_ticket_id
  ON public.bewertungen (ticket_id);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id
  ON public.feedback (user_id);
-- feedback_user_id_profiles_fkey ist FK auf dieselbe user_id-Spalte
-- (siehe H10) — ein Index reicht für beide Constraints.

CREATE INDEX IF NOT EXISTS idx_nachrichten_absender_id
  ON public.nachrichten (absender_id);

CREATE INDEX IF NOT EXISTS idx_nachtraege_genehmigt_von
  ON public.nachtraege (genehmigt_von);
CREATE INDEX IF NOT EXISTS idx_nachtraege_handwerker_id
  ON public.nachtraege (handwerker_id);

CREATE INDEX IF NOT EXISTS idx_objekte_verwalter_id
  ON public.objekte (verwalter_id);

CREATE INDEX IF NOT EXISTS idx_profiles_verifiziert_von
  ON public.profiles (verifiziert_von);

CREATE INDEX IF NOT EXISTS idx_provisionen_handwerker_id
  ON public.provisionen (handwerker_id);

CREATE INDEX IF NOT EXISTS idx_tickets_diagnose_ticket_id
  ON public.tickets (diagnose_ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_objekt_id
  ON public.tickets (objekt_id);

CREATE INDEX IF NOT EXISTS idx_zeitslot_gebote_ticket_id
  ON public.zeitslot_gebote (ticket_id);
CREATE INDEX IF NOT EXISTS idx_zeitslot_gebote_verwalter_id
  ON public.zeitslot_gebote (verwalter_id);

COMMIT;

-- Verifikation: Advisor sollte `unindexed_foreign_keys` mit 0 reports
-- zeigen. Manueller Check:
SELECT
  tc.table_schema || '.' || tc.table_name AS tabelle,
  tc.constraint_name AS fk,
  kcu.column_name AS col
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes i
    WHERE i.schemaname = tc.table_schema
      AND i.tablename = tc.table_name
      AND i.indexdef ILIKE '%(' || kcu.column_name || '%'
  )
ORDER BY tabelle, fk;
