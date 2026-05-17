-- BUG-2 aus Agent-Review (17. Mai 2026):
-- Die einladungen_select_hw-Policy prüfte nur erstellt_von = auth.uid().
-- Wenn ein MIETER das Ticket erstellt hat, sah der zuständige VERWALTER
-- die Einladungen nicht — Vergabe-Workflow im Verwalter-Dashboard war
-- damit faktisch unbenutzbar bei Mieter-erstellten Tickets.

DROP POLICY IF EXISTS "einladungen_select_hw" ON public.einladungen;
DROP POLICY IF EXISTS "einladungen_select_alle_beteiligten" ON public.einladungen;

CREATE POLICY "einladungen_select_alle_beteiligten" ON public.einladungen
  FOR SELECT
  USING (
    -- Eingeladener HW sieht eigene Einladung
    auth.uid() = handwerker_id
    -- Ersteller oder Verwalter des Tickets sehen alle Einladungen
    OR EXISTS (
      SELECT 1 FROM public.tickets t
       WHERE t.id = einladungen.ticket_id
         AND (t.erstellt_von = auth.uid() OR t.verwalter_id = auth.uid())
    )
    -- Admin sieht alles
    OR public.is_admin()
  );
