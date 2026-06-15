-- Sprint AR Finding A2.1: profiles exponiert sensible Felder (telefon,
-- stripe_account_id, early_adopter_bis) via USING (auth.uid() IS NOT NULL).
--
-- Vollständige Lösung erfordert Frontend-Migration (Join-Queries auf View
-- umstellen). Diese Migration erstellt die Infrastruktur; die base-table-
-- Policy bleibt unverändert um Join-Queries nicht zu brechen.
--
-- TODO Sprint AS+: Frontend auf profiles_public umstellen, dann
-- profiles_select auf (auth.uid() = id OR is_admin()) einschränken.

CREATE OR REPLACE VIEW public.profiles_public
  WITH (security_invoker = true)
AS
SELECT
  id, name, firma, rolle, gewerk, handwerker_gewerke,
  bewertung_avg, auftraege_anzahl, sichtbarkeit_stufe,
  adresse, lat, lng, radius_km, created_at
FROM public.profiles;
