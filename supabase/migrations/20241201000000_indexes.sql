-- ============================================================
-- Reparo: Performance-Indexes für häufige Query-Patterns
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent (CREATE INDEX IF NOT EXISTS überall)
--
-- Hintergrund: Die meisten Dashboard-Queries filtern entweder nach
-- Owner-ID oder nach Status. Primary-Keys sind automatisch indiziert,
-- alle Foreign-Keys auch (Postgres legt seit langem KEINE FK-Indexe
-- automatisch an, aber Supabase macht das per Konvention nicht — also
-- erstellen wir die wichtigsten manuell).
-- ============================================================

-- TICKETS — meistgenutzte Filter
-- Mieter/Verwalter laden eigene Tickets, sortiert nach Erstellung
CREATE INDEX IF NOT EXISTS idx_tickets_erstellt_von_created
  ON public.tickets (erstellt_von, created_at DESC);

-- Handwerker laden zugewiesene Aufträge
CREATE INDEX IF NOT EXISTS idx_tickets_zugewiesener_hw_status
  ON public.tickets (zugewiesener_hw, status)
  WHERE zugewiesener_hw IS NOT NULL;

-- Status-Filter (Verwalter-Dashboard nach offen/auktion/in_bearbeitung)
CREATE INDEX IF NOT EXISTS idx_tickets_status
  ON public.tickets (status, created_at DESC);

-- Auktion-Cron findet abgelaufene Auktionen
CREATE INDEX IF NOT EXISTS idx_tickets_auktion_ende
  ON public.tickets (auktion_ende)
  WHERE status = 'auktion';

-- ANGEBOTE — pro Ticket und pro Handwerker
-- (UNIQUE(ticket_id, handwerker_id) deckt Combined-Lookups, aber
--  Single-Column-Queries auf ticket_id alleine profitieren von
--  einem expliziten Index.)
CREATE INDEX IF NOT EXISTS idx_angebote_ticket
  ON public.angebote (ticket_id, smart_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_angebote_handwerker_status
  ON public.angebote (handwerker_id, status);

-- EINLADUNGEN — pro Ticket
CREATE INDEX IF NOT EXISTS idx_einladungen_handwerker_status
  ON public.einladungen (handwerker_id, status);

-- BEWERTUNGEN — Trigger AVG-Berechnung nutzt das
CREATE INDEX IF NOT EXISTS idx_bewertungen_handwerker
  ON public.bewertungen (handwerker_id);

-- NACHRICHTEN — Chat-Verlauf pro Ticket, chronologisch
CREATE INDEX IF NOT EXISTS idx_nachrichten_ticket_created
  ON public.nachrichten (ticket_id, created_at);

-- PROFILES — Handwerker-Suche im Verwalter-Flow
-- Partial-Index spart Speicher: nur Handwerker werden gefiltert
CREATE INDEX IF NOT EXISTS idx_profiles_rolle_handwerker
  ON public.profiles (rolle)
  WHERE rolle = 'handwerker';

-- Für Bewertungs-Sortierung in Auction-Picker
CREATE INDEX IF NOT EXISTS idx_profiles_bewertung
  ON public.profiles (bewertung_avg DESC NULLS LAST)
  WHERE rolle = 'handwerker';

-- TERMINE — Tagesplan pro Handwerker
CREATE INDEX IF NOT EXISTS idx_termine_handwerker_datum
  ON public.termine (handwerker_id, datum);

-- ZEITSLOTS — Marktplatz-Filter (verfügbare Slots, sortiert nach Datum)
-- Schema kommt aus migration-yield.sql; falls Tabelle existiert, anlegen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='zeitslots') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_zeitslots_status_datum
              ON public.zeitslots (status, datum)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_zeitslots_handwerker_datum
              ON public.zeitslots (handwerker_id, datum DESC)';
  END IF;
END $$;

-- ============================================================
-- Smoke-Check (optional in einem zweiten Run):
--   SELECT indexrelname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
--   ORDER BY tablename, indexname;
-- ============================================================
