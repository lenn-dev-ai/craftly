-- ============================================================
-- Reparo: Diagnose-Ablauf — Auto-Verfall für nicht-übernommene Diagnose-Tickets
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent
--
-- Hintergrund (siehe SIMULATION-REPORT.md M-K2):
-- Diagnose-Tickets sind status='auktion' ohne auktion_ende. Der
-- check-expired-Cron-Endpoint filtert auf auktion_ende < NOW(), kann
-- Diagnose-Tickets also nie automatisch beenden. Mieter wartet endlos
-- wenn kein HW innerhalb sinnvoller Frist anbietet.
--
-- Lösung: separate diagnose_ablauf-Spalte. Default 14 Tage nach Erstellung
-- (im Mieter-Melden-Flow gesetzt). check-expired-Endpoint hat einen
-- zweiten Block, der abgelaufene Diagnose-Tickets auf status='offen'
-- zurücksetzt (Verwalter entscheidet manuell wie weiter).
-- ============================================================

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS diagnose_ablauf timestamptz;

-- Backfill für existierende Diagnose-Tickets: 14 Tage nach created_at
UPDATE public.tickets
   SET diagnose_ablauf = created_at + interval '14 days'
 WHERE ticket_typ = 'diagnose'
   AND diagnose_ablauf IS NULL
   AND status = 'auktion';

-- Index für check-expired-Query
CREATE INDEX IF NOT EXISTS idx_tickets_diagnose_ablauf
  ON public.tickets (diagnose_ablauf)
  WHERE ticket_typ = 'diagnose' AND status = 'auktion';
