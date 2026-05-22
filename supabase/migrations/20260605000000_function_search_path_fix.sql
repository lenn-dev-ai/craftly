-- Backlog-Hygiene · Vorbereitet 2026-05-22 (autonom, während Urlaub)
-- Anwendung: nach Urlaub-Rückkehr via Supabase-MCP / Studio.
--
-- function_search_path_mutable (Security-Advisor): 18 Funktionen ohne
-- explizit gesetztes search_path. Standard-Fix: SET search_path =
-- public, pg_temp damit kein Angreifer eine eigene `public`-Schema-
-- Function unter-schmuggeln kann (search_path-Hijacking).
--
-- Alle Funktionen sind ohne Overloads → eindeutige Identity-Args.
-- Idempotent: ALTER FUNCTION überschreibt bestehenden SET-Wert.

BEGIN;

ALTER FUNCTION public.berechne_dynamischen_preis()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.can_bewerten(_ticket_id uuid, _handwerker_id uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_default_verfuegbarkeiten(hw_id uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.effektive_provision_rate(basis_rate numeric, surge numeric, early_adopter boolean)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.expire_zeitslots()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.fill_diagnose_ablauf_on_ticket()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.fill_verwalter_id_on_ticket()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_nachtrag_genehmigt()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.has_einladung(_ticket_id uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_handwerker()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_verwalter()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.protect_profile_fields()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.protect_ticket_fields()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.touch_diagnose_preise()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.try_consume_ki_quota(_max_per_day integer)
  SET search_path = public, pg_temp;

COMMIT;

-- Verifikation: 0 verbleibende Funktionen ohne expliziten search_path
SELECT n.nspname AS schema, p.proname AS fname, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND (p.proconfig IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
       ))
ORDER BY fname;
