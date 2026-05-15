-- ============================================================
-- Reparo: BEFORE-INSERT-Trigger für diagnose_ablauf
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor. Idempotent.
--
-- Hintergrund (SIMULATION-REPORT-V2.md B2-K1):
-- Bisher wurde diagnose_ablauf nur im Mieter-Melden-Flow gesetzt.
-- Tickets via Seed/Admin-API/externe Quellen bekamen kein Verfallsdatum
-- → liefen nie über check-expired-Cron ab. Trigger fixt das.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fill_diagnose_ablauf_on_ticket()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_typ = 'diagnose' AND NEW.diagnose_ablauf IS NULL THEN
    NEW.diagnose_ablauf := COALESCE(NEW.created_at, now()) + interval '14 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fill_diagnose_ablauf ON public.tickets;
CREATE TRIGGER trg_fill_diagnose_ablauf
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_diagnose_ablauf_on_ticket();

-- Backfill für existing Diagnose-Tickets ohne Frist
UPDATE public.tickets
   SET diagnose_ablauf = created_at + interval '14 days'
 WHERE ticket_typ = 'diagnose'
   AND diagnose_ablauf IS NULL
   AND status = 'auktion';
