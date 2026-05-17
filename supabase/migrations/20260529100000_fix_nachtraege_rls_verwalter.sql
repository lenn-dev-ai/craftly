-- BUG-3 aus Agent-Review (17. Mai 2026):
-- Gleiche Ursache wie BUG-2 — nachtraege_select_beteiligte prüft nur
-- t.erstellt_von, nicht t.verwalter_id. Verwalter konnten Nachträge
-- bei Mieter-erstellten Tickets nicht sehen oder genehmigen.

DROP POLICY IF EXISTS "nachtraege_select_beteiligte" ON public.nachtraege;

CREATE POLICY "nachtraege_select_beteiligte" ON public.nachtraege
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
       WHERE t.id = nachtraege.ticket_id
         AND (
              t.erstellt_von = auth.uid()
           OR t.verwalter_id = auth.uid()
           OR t.zugewiesener_hw = auth.uid()
         )
    )
    OR public.is_admin()
  );
