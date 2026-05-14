-- ============================================================
-- Reparo: tickets.verwalter_id — direkte Verwalter-Zuordnung
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent
--
-- Hintergrund (siehe SIMULATION-REPORT.md M-K3):
-- Heutige API-Routes (projekt-annehmen, auktion-close etc.) prüfen
-- ticket.erstellt_von gegen auth.uid() und verlangen rolle=verwalter.
-- Bei Mieter-erstellten Tickets (~43 % im Seed) versagt das: niemand
-- darf die Pipeline-Schritte triggern. Ticket bleibt hängen.
--
-- Lösung: separate verwalter_id-Spalte mit Auto-Fill via Trigger aus
-- objekt.verwalter_id (Default-Pfad für Mieter-Tickets) oder direkt
-- aus erstellt_von wenn der Ersteller selbst ein Verwalter ist.
--
-- erstellt_von bleibt erhalten und beschreibt weiterhin den Initiator
-- (Mieter ODER Verwalter). verwalter_id ist der zuständige Auftraggeber.
-- ============================================================

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS verwalter_id uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_tickets_verwalter_id
  ON public.tickets (verwalter_id);

-- Backfill 1: über objekt.verwalter_id (Mieter-Tickets mit Objekt-Bezug)
UPDATE public.tickets t
   SET verwalter_id = o.verwalter_id
  FROM public.objekte o
 WHERE t.objekt_id = o.id
   AND t.verwalter_id IS NULL;

-- Backfill 2: wenn erstellt_von selbst ein Verwalter ist
UPDATE public.tickets t
   SET verwalter_id = t.erstellt_von
  FROM public.profiles p
 WHERE p.id = t.erstellt_von
   AND p.rolle IN ('verwalter', 'admin')
   AND t.verwalter_id IS NULL;

-- Auto-Fill bei INSERT
CREATE OR REPLACE FUNCTION public.fill_verwalter_id_on_ticket()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verwalter_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Prio 1: aus Objekt-Zuordnung
  IF NEW.objekt_id IS NOT NULL THEN
    SELECT verwalter_id INTO NEW.verwalter_id
      FROM public.objekte WHERE id = NEW.objekt_id;
  END IF;
  -- Prio 2: erstellt_von selbst (wenn Verwalter/Admin)
  IF NEW.verwalter_id IS NULL THEN
    SELECT id INTO NEW.verwalter_id
      FROM public.profiles
     WHERE id = NEW.erstellt_von
       AND rolle IN ('verwalter', 'admin');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_fill_verwalter_id ON public.tickets;
CREATE TRIGGER trg_fill_verwalter_id
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_verwalter_id_on_ticket();
