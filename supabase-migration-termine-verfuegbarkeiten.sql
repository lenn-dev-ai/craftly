-- ============================================================
-- Reparo: Termine + Verfuegbarkeiten (Repro-Migration)
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent (kann mehrfach laufen)
--
-- Diese Tabellen wurden bereits am 2026-03-28 in der Live-DB
-- (Projekt gkojaogdzzyuboajwyom) angelegt. Diese Datei dokumentiert
-- den Stand für Repro-Setups (z.B. Staging, lokale Dev-DBs) und
-- darf gegen Live ohne Effekt erneut laufen.
-- ============================================================

-- 1) Wöchentliche Verfügbarkeit der Handwerker
CREATE TABLE IF NOT EXISTS public.verfuegbarkeiten (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  handwerker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  wochentag smallint NOT NULL CHECK (wochentag BETWEEN 0 AND 6),
  von time NOT NULL DEFAULT '08:00',
  bis time NOT NULL DEFAULT '17:00',
  aktiv boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(handwerker_id, wochentag)
);

ALTER TABLE public.verfuegbarkeiten ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verfuegbarkeiten_select" ON public.verfuegbarkeiten;
CREATE POLICY "verfuegbarkeiten_select" ON public.verfuegbarkeiten
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "verfuegbarkeiten_insert" ON public.verfuegbarkeiten;
CREATE POLICY "verfuegbarkeiten_insert" ON public.verfuegbarkeiten
  FOR INSERT WITH CHECK (auth.uid() = handwerker_id);

DROP POLICY IF EXISTS "verfuegbarkeiten_update" ON public.verfuegbarkeiten;
CREATE POLICY "verfuegbarkeiten_update" ON public.verfuegbarkeiten
  FOR UPDATE USING (auth.uid() = handwerker_id);

DROP POLICY IF EXISTS "verfuegbarkeiten_delete" ON public.verfuegbarkeiten;
CREATE POLICY "verfuegbarkeiten_delete" ON public.verfuegbarkeiten
  FOR DELETE USING (auth.uid() = handwerker_id);

-- 2) Gebuchte Termine (mit Ticket verknüpft)
CREATE TABLE IF NOT EXISTS public.termine (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  handwerker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  titel text NOT NULL,
  datum date NOT NULL,
  von time NOT NULL,
  bis time NOT NULL,
  notizen text,
  google_event_id text,
  created_at timestamptz DEFAULT now()
);

-- RLS-Policies werden in supabase-migration-e2e-flow.sql gepflegt
-- (termine_select_beteiligte, termine_insert_beteiligte).

-- 3) Google Calendar Token-Speicher am Profil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_refresh_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_calendar_connected boolean DEFAULT false;

-- 4) Helper: Default-Verfügbarkeiten für neuen Handwerker erstellen
CREATE OR REPLACE FUNCTION public.create_default_verfuegbarkeiten(hw_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.verfuegbarkeiten (handwerker_id, wochentag, von, bis, aktiv)
  VALUES
    (hw_id, 1, '08:00', '17:00', true),
    (hw_id, 2, '08:00', '17:00', true),
    (hw_id, 3, '08:00', '17:00', true),
    (hw_id, 4, '08:00', '17:00', true),
    (hw_id, 5, '08:00', '17:00', true),
    (hw_id, 6, '09:00', '13:00', false),
    (hw_id, 0, '00:00', '00:00', false)
  ON CONFLICT (handwerker_id, wochentag) DO NOTHING;
END;
$$;

-- ============================================================
-- Done. Repo-DB ist nun reproduzierbar:
--   supabase-schema-v2.sql
--   supabase-migration-marktplatz.sql
--   supabase-migration-yield.sql
--   supabase-migration-termine-verfuegbarkeiten.sql  (diese Datei)
--   supabase-migration-route-optimizer.sql
--   supabase-migration-e2e-flow.sql
--   supabase-migration-ticket-einsatzort.sql
--   supabase-migration-provisionen.sql
-- ============================================================
