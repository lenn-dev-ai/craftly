-- Backlog-Hygiene · Vorbereitet 2026-05-22 (autonom, während Urlaub)
-- **GROSSER REFACTOR — NICHT direkt anwenden ohne Review-Pass.**
--
-- auth_rls_initplan (Performance-Advisor): ~57 Policies rufen `auth.uid()`
-- direkt im qual/with_check auf statt `(SELECT auth.uid())`. Postgres
-- evaluiert das pro Row neu — bei Skalierung teuer.
--
-- Standard-Fix (https://supabase.com/docs/guides/database/postgres/
-- row-level-security#call-functions-with-select):
--   auth.uid()            → (SELECT auth.uid())
--   current_setting(...)  → (SELECT current_setting(...))
--
-- Aufwand: ~50 Policies × DROP + CREATE. Plus: einige Policies rufen
-- Helper-Functions auf (is_admin(), is_verwalter(), is_handwerker(),
-- has_einladung(), can_bewerten()) — diese Helper sollten intern
-- ebenfalls auf (SELECT auth.uid()) refaktoriert werden.
--
-- ====================================================================
-- VORGEHEN
-- ====================================================================
--
-- 1. Helper-Functions zuerst (einmal anpacken, schlägt überall ein):
--    - is_admin, is_handwerker, is_verwalter, has_einladung, can_bewerten
--    Beispiel:
--      CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
--      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
--        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND rolle = 'admin');
--      $$;
--
-- 2. Policies tabellenweise: DROP + CREATE mit (SELECT auth.uid()).
--    Reihenfolge nach Tabellen-Größe (kleinste zuerst, damit ein
--    Migrations-Fehler nicht große Tabellen blockiert):
--    feedback, bewertungen, einladungen, nachrichten, nachtraege,
--    private_termine, objekte, profiles, termine, tickets,
--    zeitslots, zeitslot_gebote, verfuegbarkeiten, diagnose_preise,
--    routen_planung, handwerker_stats, provisionen, angebote
--
-- 3. Nach jeder Tabelle: Smoke-Test der relevanten Use-Cases.
--    Verlust einer Policy = Daten-Sicherheits-Lücke.
--
-- ====================================================================
-- BEISPIEL-PATTERN (für `profiles_select` — bewusst klein gestartet)
-- ====================================================================

BEGIN;

-- Helper zuerst:
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND rolle = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_handwerker()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND rolle = 'handwerker'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_verwalter()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND rolle = 'verwalter'
  );
$$;

-- profiles als Beispiel-Tabelle (Lennart-Review nach diesem Schritt):
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE
  USING (((SELECT auth.uid()) = id) OR is_admin())
  WITH CHECK (((SELECT auth.uid()) = id) OR is_admin());

ROLLBACK; -- per Default kein Apply — Lennart aktiviert + COMMIT nach Review

-- ====================================================================
-- REST DER POLICIES — TODO nach Lennart-Review
-- ====================================================================
-- Vollständige Liste aller betroffenen Policies (Stand 22.05.2026):
--   angebote: Verwalter aendert Angebote, Verwalter sieht Angebote seiner
--             Tickets, angebote_insert, angebote_select, angebote_update,
--             angebote_update_handwerker_self
--   bewertungen: bewertungen_insert
--   diagnose_preise: diagnose_preise_admin_write
--   einladungen: einladungen_insert, einladungen_select_alle_beteiligten,
--                einladungen_update
--   feedback: feedback_insert_self, feedback_select_own_or_admin
--   handwerker_stats: stats_select, stats_update, stats_upsert
--   nachrichten: nachrichten_insert, nachrichten_insert_beteiligte,
--                nachrichten_select, nachrichten_select_beteiligte
--   nachtraege: nachtraege_insert_zugewiesen,
--               nachtraege_select_beteiligte,
--               nachtraege_update_verwalter
--   objekte: objekte_insert, objekte_select
--   private_termine: 4 Policies
--   profiles: profiles_insert/select/update (oben als Pattern)
--   provisionen: provisionen_insert_verwalter,
--                provisionen_select_eigene
--   routen_planung: routen_planung_modify_own,
--                   routen_planung_select_own
--   termine: termine_delete/insert/select/update,
--            termine_insert_beteiligte, termine_select_beteiligte,
--            verwalter_insert_termine
--   tickets: tickets_insert, tickets_select, tickets_update
--   verfuegbarkeiten: (entfällt — Tabelle wird gedroppt, siehe
--                     20260605000020_drop_verfuegbarkeiten_table.sql)
--   zeitslot_gebote: gebote_insert/select/update
--   zeitslots: zeitslots_delete/insert/select/update
