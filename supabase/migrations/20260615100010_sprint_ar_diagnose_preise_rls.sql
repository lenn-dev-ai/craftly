-- Sprint AR Finding A2.2: diagnose_preise SELECT auf Verwalter + Admin einschränken.
-- Vorher: USING (true) — alle authentifizierten User konnten Preisparameter lesen.

DROP POLICY IF EXISTS "diagnose_preise_select_authenticated" ON public.diagnose_preise;

CREATE POLICY "diagnose_preise_select_verwalter_admin"
  ON public.diagnose_preise FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rolle IN ('verwalter', 'admin')
    )
  );
