-- ============================================================
-- Reparo: SECURITY-DEFINER-Härtung (Audit 2026-07-05, Welle 1 / C2)
-- ============================================================
-- Supabase-Advisor: anon UND authenticated dürfen interne
-- SECURITY-DEFINER-Funktionen per PostgREST /rpc ausführen. Gefährlich
-- sind die SCHREIBENDEN/ADMIN-Funktionen — ein anonymer Angreifer konnte
-- Scores neu berechnen, Verfügbarkeiten für fremde HW anlegen, Quota
-- leerlaufen lassen (KI/Geocoding-DoS) oder Online-Zähler/Admin-Aktionen
-- abrufen.
--
-- Bewusst NICHT angefasst: is_admin/is_handwerker/is_verwalter,
-- has_einladung/user_has_einladung, can_bewerten — diese laufen INNERHALB
-- der RLS-Policies. Sie sind read-only (Ergebnis hängt an auth.uid(), das
-- für anon null ist) und ein Revoke würde RLS brechen.
--
-- Idempotent: REVOKE ist wiederholbar.

-- WICHTIG: Diese Funktionen haben einen impliziten GRANT ... TO PUBLIC —
-- ein Revoke von nur anon/authenticated greift nicht (anon erbt via PUBLIC).
-- Daher explizit auch von PUBLIC entziehen.

-- --- 1) Nur Cron/Trigger/Service-Role — von PUBLIC + anon + authenticated ---
-- (Trigger feuern als Owner und brauchen KEIN Client-EXECUTE-Grant.)
REVOKE EXECUTE ON FUNCTION public.recompute_sichtbarkeit_all()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_verfuegbarkeiten(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_users_online_last_5min()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.aktualisiere_handwerker_bewertung()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_verwalter_id_on_ticket()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_nachtrag_genehmigt()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_fields()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_ticket_fields()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_activity_24h()                  FROM PUBLIC, anon, authenticated;

-- --- 2) Nur eingeloggte Nutzer/Admin — von PUBLIC+anon entziehen, an authenticated zurückgeben ---
-- Quota-Funktionen: vom User-Client NACH Login aufgerufen (geocode/ki).
-- Admin-RPC: vom eingeloggten Admin aufgerufen (gatet intern via is_admin()).
REVOKE EXECUTE ON FUNCTION public.try_consume_geocode_quota(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.try_consume_ki_quota(integer)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_action_items(integer)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ticket_audit_log(uuid)         FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.try_consume_geocode_quota(integer) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.try_consume_ki_quota(integer)      TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_get_action_items(integer)    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_ticket_audit_log(uuid)         TO authenticated;

-- --- 3) SECURITY-DEFINER-View admin_action_items abschotten ---
-- Advisor-ERROR: Admin-Daten für anon/authenticated lesbar. Die App liest
-- sie ausschließlich über die Definer-Funktion admin_get_action_items
-- (läuft als Owner), nie direkt — daher SELECT für Client-Rollen entziehen.
REVOKE SELECT ON public.admin_action_items FROM anon, authenticated;

-- --- 4) Mutable search_path fixen (Advisor-WARN) ---
ALTER FUNCTION public.feedback_verdicts_set_updated_at() SET search_path = public, pg_temp;
