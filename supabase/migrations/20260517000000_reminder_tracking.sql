-- ============================================================
-- Reparo: Reminder-Tracking für Bewertungs- + HW-Reaktivierungs-Cron
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent
--
-- Hintergrund (SIMULATION-REPORT.md M-W2 + M-W4):
-- M-W2 Bewertungs-Reminder: 3+ Tage nach Erledigung wird der Mieter
-- per Mail erinnert seine Bewertung abzugeben. Damit nicht täglich
-- gespammt wird, persistiert tickets.bewertung_reminder_gesendet
-- den Versand-Timestamp.
--
-- M-W4 Stille-HW-Reaktivierung: HW ohne Bid in 14+ Tagen bekommen
-- eine "3 passende Aufträge"-Mail. profiles.letzte_reaktivierung_mail
-- verhindert tägliche Re-Sends.
-- ============================================================

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS bewertung_reminder_gesendet timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS letzte_reaktivierung_mail timestamptz;

-- Partial Index für den Cron-Query: erledigte Tickets ohne gesendeten Reminder
CREATE INDEX IF NOT EXISTS idx_tickets_bewertung_reminder
  ON public.tickets (created_at)
  WHERE status = 'erledigt' AND bewertung_reminder_gesendet IS NULL;
