-- Sprint AR Finding A2.3: stamm_handwerker hatte kein Migration-File im Repo
-- (Tabelle wurde via direktem SQL in Supabase angelegt, Sprint V).
-- Dieses File dokumentiert die existierende Struktur für Disaster-Recovery.
-- IDEMPOTENT: IF NOT EXISTS + CREATE OR REPLACE für alle Objekte.

CREATE TABLE IF NOT EXISTS public.stamm_handwerker (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  verwalter_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  handwerker_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  objekt_id     uuid        REFERENCES public.objekte(id) ON DELETE SET NULL,
  gewerk        text,
  prio          integer     NOT NULL DEFAULT 100,
  frist_stunden integer     NOT NULL DEFAULT 24,
  notizen       text,
  erstellt_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stamm_handwerker ENABLE ROW LEVEL SECURITY;

-- Verwalter: voller Zugriff auf eigene Stamm-HW-Liste
CREATE POLICY "stamm_verwalter_all" ON public.stamm_handwerker
  FOR ALL TO authenticated
  USING (verwalter_id = (SELECT auth.uid()))
  WITH CHECK (verwalter_id = (SELECT auth.uid()));

-- Handwerker: kann sehen, bei welchen Verwaltern er als Stamm-HW gelistet ist
CREATE POLICY "stamm_hw_select_eigene" ON public.stamm_handwerker
  FOR SELECT TO authenticated
  USING (handwerker_id = (SELECT auth.uid()));

-- Admin: voller Zugriff
CREATE POLICY "stamm_admin_all" ON public.stamm_handwerker
  FOR ALL TO authenticated
  USING (public.is_admin());
