-- Sprint AR follow-up: diagnose_preise-Policy auf Helper-Functions umstellen.
-- Vorherige Migration (100010) nutzte inline EXISTS-Subquery; diese ersetzt
-- sie durch is_verwalter() / is_admin() — konsistent mit allen anderen Policies.

DROP POLICY IF EXISTS "diagnose_preise_select_verwalter_admin" ON public.diagnose_preise;

CREATE POLICY "diagnose_preise_select_verwalter_admin"
  ON public.diagnose_preise FOR SELECT TO authenticated
  USING (public.is_verwalter() OR public.is_admin());
