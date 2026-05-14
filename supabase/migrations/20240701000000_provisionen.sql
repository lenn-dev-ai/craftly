-- ============================================================
-- Reparo: Provisionen + Provision-Settings (idempotent)
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- ============================================================

-- 1) Versionierte Provisions-Konfiguration (kein Code-Deploy für Rate-Änderung)
CREATE TABLE IF NOT EXISTS public.provision_settings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  rate         numeric(5,4) NOT NULL CHECK (rate >= 0 AND rate <= 1),
  gueltig_ab   timestamptz NOT NULL DEFAULT now(),
  gueltig_bis  timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- Initial-Eintrag nur wenn Tabelle leer
INSERT INTO public.provision_settings (name, rate, gueltig_ab)
SELECT 'Standard 5 %', 0.0500, now()
WHERE NOT EXISTS (SELECT 1 FROM public.provision_settings);

ALTER TABLE public.provision_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provision_settings_select_authenticated" ON public.provision_settings;
CREATE POLICY "provision_settings_select_authenticated"
  ON public.provision_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2) Snapshot pro Auftrag (Audit-Trail, übersteht Rate-Änderungen)
CREATE TABLE IF NOT EXISTS public.provisionen (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  verwalter_id      uuid REFERENCES public.profiles(id),
  handwerker_id     uuid REFERENCES public.profiles(id),
  auftragswert      numeric(10,2) NOT NULL,
  provision_rate    numeric(5,4) NOT NULL,
  provision_betrag  numeric(10,2) NOT NULL,
  gesamt            numeric(10,2) NOT NULL,
  is_early_adopter  boolean DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_provisionen_ticket
  ON public.provisionen (ticket_id);
CREATE INDEX IF NOT EXISTS idx_provisionen_verwalter_datum
  ON public.provisionen (verwalter_id, created_at DESC);

ALTER TABLE public.provisionen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provisionen_select_eigene" ON public.provisionen;
CREATE POLICY "provisionen_select_eigene"
  ON public.provisionen FOR SELECT
  USING (auth.uid() = verwalter_id OR auth.uid() = handwerker_id);

DROP POLICY IF EXISTS "provisionen_insert_verwalter" ON public.provisionen;
CREATE POLICY "provisionen_insert_verwalter"
  ON public.provisionen FOR INSERT
  WITH CHECK (auth.uid() = verwalter_id);

-- 3) Early-Adopter-Datum am Profil (explizites Feld statt impliziter Rechnung)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS early_adopter_bis timestamptz;

-- Backfill für bestehende Verwalter: 90 Tage ab Registrierung
UPDATE public.profiles
SET early_adopter_bis = created_at + interval '90 days'
WHERE rolle = 'verwalter' AND early_adopter_bis IS NULL;

-- ============================================================
-- Done. Was du jetzt hast:
--   - provision_settings: zentrale Konfiguration (5 % aktiv)
--   - provisionen: Snapshot pro Auftrag
--   - profiles.early_adopter_bis: explizit setzbar (für Sonderdeals)
-- ============================================================
