-- Sprint G — Verwalter-Wizard (P2-Pre-Pivot)
-- Vorbereitet 23.05.2026 in Urlaubs-Session, Apply nach Rückkehr.
--
-- Markiert Tickets, die der Verwalter telefonisch via Sprint-G-Wizard
-- eingetragen hat (statt vom Mieter selbst gemeldet). Treibt das
-- "📞 telefonisch"-Badge in der Verwalter-Ticket-Liste.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS eingetragen_von_verwalter boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tickets.eingetragen_von_verwalter IS
  'true wenn Verwalter das Ticket telefonisch via Sprint-G-Wizard eingetragen hat';
