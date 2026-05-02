-- ============================================================
-- Reparo: Route-Optimierung & Effektiv-Preis
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent: Kann mehrfach ausgeführt werden
-- ============================================================

-- 1) Zeitslots bekommen einen Einsatzort
ALTER TABLE public.zeitslots ADD COLUMN IF NOT EXISTS einsatzort_adresse text;
ALTER TABLE public.zeitslots ADD COLUMN IF NOT EXISTS einsatzort_lat double precision;
ALTER TABLE public.zeitslots ADD COLUMN IF NOT EXISTS einsatzort_lng double precision;

-- 2) Konkrete Auftrags-Termine bekommen einen Einsatzort
ALTER TABLE public.termine ADD COLUMN IF NOT EXISTS einsatzort_adresse text;
ALTER TABLE public.termine ADD COLUMN IF NOT EXISTS einsatzort_lat double precision;
ALTER TABLE public.termine ADD COLUMN IF NOT EXISTS einsatzort_lng double precision;

-- 3) Private/externe Termine (für Routenberechnung — keine Auftragsdetails)
CREATE TABLE IF NOT EXISTS public.private_termine (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handwerker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  datum        date NOT NULL,
  von          time NOT NULL,
  bis          time NOT NULL,
  adresse      text,
  lat          double precision,
  lng          double precision,
  bezeichnung  text DEFAULT 'Privat',
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_termine_tag
  ON public.private_termine (handwerker_id, datum);

ALTER TABLE public.private_termine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "private_termine_select_own" ON public.private_termine;
CREATE POLICY "private_termine_select_own"
  ON public.private_termine FOR SELECT
  USING (auth.uid() = handwerker_id);

DROP POLICY IF EXISTS "private_termine_modify_own" ON public.private_termine;
CREATE POLICY "private_termine_modify_own"
  ON public.private_termine FOR ALL
  USING (auth.uid() = handwerker_id)
  WITH CHECK (auth.uid() = handwerker_id);

-- 4) Profile: Stundensatz, Fahrtkosten, Startort, Mindestpreis
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fahrtkosten_pro_km numeric(5,2) DEFAULT 0.50;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS basis_stundensatz numeric(6,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mindest_stundensatz numeric(6,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS startort_adresse text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS startort_lat double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS startort_lng double precision;

-- 5) Angebote: berechnete Routen-Daten
ALTER TABLE public.angebote ADD COLUMN IF NOT EXISTS routen_score integer;
ALTER TABLE public.angebote ADD COLUMN IF NOT EXISTS fahrzeit_minuten integer;
ALTER TABLE public.angebote ADD COLUMN IF NOT EXISTS fahrzeit_delta_minuten integer;
ALTER TABLE public.angebote ADD COLUMN IF NOT EXISTS effektiv_preis numeric(6,2);

-- ============================================================
-- Done. Du kannst jetzt:
--   - Im Handwerker-Profil Stundensatz / Fahrtkosten / Startort setzen
--   - In Termine + Privat-Termine Adressen pflegen
--   - Verwalter sehen Effektiv-Preis und Routen-Score in der Auktion
-- ============================================================
