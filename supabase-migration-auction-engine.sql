-- ============================================================
-- Reparo: Auction Engine — Dringlichkeit, Surge, Smart-Score, Routen
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent (kann mehrfach laufen)
--
-- Strategie: nutzt vorhandene Geo-Felder (tickets.einsatzort_*,
-- profiles.startort_*) und erweitert nur um auktion-spezifische Felder.
-- Kein Parallel-Schema.
-- ============================================================

-- 1) Dringlichkeits-Enum (orthogonal zu prioritaet — letzteres ist
--    Mieter-Wahrnehmung, dringlichkeit ist Verwalter-Klassifizierung
--    der Auktion und steuert Radius, Laufzeit und Surge.)
DO $$
BEGIN
  CREATE TYPE public.dringlichkeit AS ENUM ('notfall', 'zeitnah', 'planbar');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Tickets: Dringlichkeit + Surge + Auktions-Start
--    (auktion_ende existiert bereits aus schema-v2; status ebenso —
--     der status-Wert 'auktion' deckt 'aktiv' ab)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS dringlichkeit public.dringlichkeit DEFAULT 'planbar',
  ADD COLUMN IF NOT EXISTS surge_faktor numeric(3,2) DEFAULT 1.00 CHECK (surge_faktor >= 1.00 AND surge_faktor <= 2.00),
  ADD COLUMN IF NOT EXISTS auktion_start timestamptz;

-- 3) Profiles: max_radius_km für die Auktions-Suche
--    (radius_km als Property existiert in der App-Logik bereits, aber
--     nicht als DB-Spalte — daher hier explizit anlegen)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_radius_km integer DEFAULT 25 CHECK (max_radius_km BETWEEN 1 AND 100);

-- 4) Angebote: Smart-Score und Routen-Daten
ALTER TABLE public.angebote
  ADD COLUMN IF NOT EXISTS smart_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS entfernung_km numeric(6,2),
  ADD COLUMN IF NOT EXISTS fahrzeit_min integer,
  ADD COLUMN IF NOT EXISTS ist_routen_bonus boolean DEFAULT false;

-- 5) Routen-Planung: Tagesbündelung pro Handwerker
CREATE TABLE IF NOT EXISTS public.routen_planung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handwerker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  datum date NOT NULL,
  ticket_ids uuid[] NOT NULL,
  optimierte_reihenfolge uuid[],
  gesamt_fahrzeit_min integer,
  gesamt_distanz_km numeric(7,2),
  erstellt_am timestamptz DEFAULT now(),
  UNIQUE(handwerker_id, datum)
);

CREATE INDEX IF NOT EXISTS idx_routen_planung_hw_datum
  ON public.routen_planung (handwerker_id, datum);

ALTER TABLE public.routen_planung ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routen_planung_select_own" ON public.routen_planung;
CREATE POLICY "routen_planung_select_own"
  ON public.routen_planung FOR SELECT
  USING (
    handwerker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin')
  );

DROP POLICY IF EXISTS "routen_planung_modify_own" ON public.routen_planung;
CREATE POLICY "routen_planung_modify_own"
  ON public.routen_planung FOR ALL
  USING (handwerker_id = auth.uid())
  WITH CHECK (handwerker_id = auth.uid());

-- 6) RLS: Sicherstellen dass max_radius_km nur vom Handwerker selbst
--    gesetzt wird. Vorhandene profiles_update_own-Policy (auth.uid() = id)
--    deckt das bereits ab — keine zusätzliche Policy nötig.

-- 7) Helper: berechnet effektive Provisions-Rate inkl. Surge.
--    Wird von der App-Schicht (lib/pricing/commission.ts) gespiegelt;
--    hier als optionale DB-Funktion für Reporting/Audits.
CREATE OR REPLACE FUNCTION public.effektive_provision_rate(
  basis_rate numeric,
  surge numeric,
  early_adopter boolean
) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF early_adopter THEN
    RETURN 0;
  END IF;
  RETURN ROUND((basis_rate * COALESCE(surge, 1.00))::numeric, 4);
END;
$$;

-- ============================================================
-- Done. Reparo Auction Engine ist DB-seitig bereit:
--   - tickets.dringlichkeit (notfall|zeitnah|planbar)
--   - tickets.surge_faktor (1.00 .. 2.00)
--   - tickets.auktion_start (auktion_ende existiert bereits)
--   - profiles.max_radius_km (1..100, default 25)
--   - angebote.smart_score, entfernung_km, fahrzeit_min, ist_routen_bonus
--   - routen_planung (Tagesbündelung)
--   - effektive_provision_rate(basis, surge, early_adopter)
-- ============================================================
