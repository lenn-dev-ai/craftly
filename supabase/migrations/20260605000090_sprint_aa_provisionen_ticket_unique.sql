-- Sprint AA Hotfix — Vergabe-Regression (25.05.2026)
-- Root-Cause: app/api/auction/close/route.ts ruft
--   admin.from("provisionen").upsert(…, { onConflict: "ticket_id" })
-- aber public.provisionen hatte keinen UNIQUE-Constraint auf ticket_id —
-- PostgreSQL braucht UNIQUE/PRIMARY-KEY für ON CONFLICT, sonst 42P10.
--
-- Semantisch: ein Ticket hat genau einen Provisions-Snapshot (nach
-- Auftragsvergabe). UNIQUE-Constraint reflektiert das Geschäftsmodell.
--
-- Apply via MCP fehlgeschlagen (read-only mode für CC). Cowork
-- applied diese Migration via deren MCP-Connection.
--
-- Sanity: SELECT ticket_id, count(*) FROM provisionen GROUP BY 1
-- HAVING count(*) > 1; → leer am 25.05.2026, sicher applybar.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.provisionen'::regclass
      AND conname  = 'provisionen_ticket_id_unique'
  ) THEN
    ALTER TABLE public.provisionen
      ADD CONSTRAINT provisionen_ticket_id_unique UNIQUE (ticket_id);
  END IF;
END $$;
