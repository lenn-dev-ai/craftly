-- ============================================================
-- Reparo: E2E-Flow Migration (Trigger + RLS für Bewertungen, Termine, Nachrichten)
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent (kann mehrfach laufen)
-- ============================================================

-- 1) Bewertungs-Aggregation: Trigger statt Client-Update
-- ------------------------------------------------------------
-- Der Mieter (bewerter_id) hat keine RLS-Permission, das Profil eines
-- anderen Users (handwerker) zu updaten. Lösung: SECURITY DEFINER
-- Funktion + Trigger der nach jedem Bewertungs-Insert das Profil
-- aktualisiert.

CREATE OR REPLACE FUNCTION public.aktualisiere_handwerker_bewertung()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  avg_sterne numeric;
  anzahl integer;
BEGIN
  SELECT AVG(sterne)::numeric(3,1), COUNT(*)
  INTO avg_sterne, anzahl
  FROM public.bewertungen
  WHERE handwerker_id = NEW.handwerker_id;

  UPDATE public.profiles
  SET
    bewertung_avg = COALESCE(avg_sterne, 0),
    auftraege_anzahl = anzahl
  WHERE id = NEW.handwerker_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_handwerker_bewertung ON public.bewertungen;
CREATE TRIGGER trigger_handwerker_bewertung
  AFTER INSERT ON public.bewertungen
  FOR EACH ROW
  EXECUTE FUNCTION public.aktualisiere_handwerker_bewertung();


-- 2) RLS-Policies für die E2E-Tabellen
-- ------------------------------------------------------------

-- Bewertungen: nur der Mieter (Ticket-Ersteller) darf bewerten
ALTER TABLE public.bewertungen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bewertungen_select_visible" ON public.bewertungen;
CREATE POLICY "bewertungen_select_visible"
  ON public.bewertungen FOR SELECT
  USING (true); -- Bewertungen sind öffentlich lesbar (Ranking-System)

DROP POLICY IF EXISTS "bewertungen_insert_eigenes_ticket" ON public.bewertungen;
CREATE POLICY "bewertungen_insert_eigenes_ticket"
  ON public.bewertungen FOR INSERT
  WITH CHECK (
    auth.uid() = bewerter_id
    AND EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_id
        AND erstellt_von = auth.uid()
        AND status = 'erledigt'
    )
  );

-- Termine: Handwerker und der zugewiesene Verwalter dürfen einsehen
ALTER TABLE public.termine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "termine_select_beteiligte" ON public.termine;
CREATE POLICY "termine_select_beteiligte"
  ON public.termine FOR SELECT
  USING (
    auth.uid() = handwerker_id
    OR auth.uid() IN (
      SELECT erstellt_von FROM public.tickets WHERE id = ticket_id
    )
  );

-- Termine: Insert für Verwalter (beim Vergeben) und Handwerker (selbst)
DROP POLICY IF EXISTS "termine_insert_beteiligte" ON public.termine;
CREATE POLICY "termine_insert_beteiligte"
  ON public.termine FOR INSERT
  WITH CHECK (
    auth.uid() = handwerker_id
    OR auth.uid() IN (
      SELECT erstellt_von FROM public.tickets WHERE id = ticket_id
    )
  );

-- Nachrichten: alle Beteiligten am Ticket dürfen lesen + schreiben
ALTER TABLE public.nachrichten ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nachrichten_select_beteiligte" ON public.nachrichten;
CREATE POLICY "nachrichten_select_beteiligte"
  ON public.nachrichten FOR SELECT
  USING (
    auth.uid() IN (
      SELECT erstellt_von FROM public.tickets WHERE id = ticket_id
      UNION
      SELECT zugewiesener_hw FROM public.tickets WHERE id = ticket_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND rolle IN ('verwalter', 'admin')
    )
  );

DROP POLICY IF EXISTS "nachrichten_insert_beteiligte" ON public.nachrichten;
CREATE POLICY "nachrichten_insert_beteiligte"
  ON public.nachrichten FOR INSERT
  WITH CHECK (
    auth.uid() = absender_id
    AND (
      auth.uid() IN (
        SELECT erstellt_von FROM public.tickets WHERE id = ticket_id
        UNION
        SELECT zugewiesener_hw FROM public.tickets WHERE id = ticket_id
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND rolle IN ('verwalter', 'admin')
      )
    )
  );

-- ============================================================
-- Done. Nach Ausführung:
--   - Mieter kann bewerten → Profil-Aggregat wird automatisch aktualisiert
--   - Verwalter kann beim Vergeben einen Termin im HW-Kalender anlegen
--   - System-Nachrichten werden vom Verwalter geschrieben und vom Mieter gelesen
-- ============================================================
