-- ============================================================
-- Reparo: Diagnose → Projekt Preismodell + Nachträge + Angebotstreue
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent (kann mehrfach laufen)
--
-- Phase-1-Migration für das zweistufige Preismodell "Doctolib-Style".
-- Spätere Phasen fügen UI/Logic-Aspekte hinzu, brauchen aber kein
-- weiteres Schema-Update.
-- ============================================================

-- 1) tickets: Diagnose/Projekt-Spalten
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ticket_typ text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS diagnose_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS befund_text text,
  ADD COLUMN IF NOT EXISTS befund_fotos text[],
  ADD COLUMN IF NOT EXISTS befund_aufwand_stunden numeric(5,2),
  ADD COLUMN IF NOT EXISTS projekt_angebot numeric(10,2),
  ADD COLUMN IF NOT EXISTS leistungsumfang text[],
  ADD COLUMN IF NOT EXISTS vorkaufsrecht_bis timestamptz,
  ADD COLUMN IF NOT EXISTS preiskorridor_min numeric(10,2),
  ADD COLUMN IF NOT EXISTS preiskorridor_max numeric(10,2),
  ADD COLUMN IF NOT EXISTS diagnosegebuehr_angerechnet boolean DEFAULT false;

-- CHECK auf ticket_typ
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_ticket_typ_check') THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_ticket_typ_check
      CHECK (ticket_typ IN ('standard', 'diagnose', 'projekt'));
  END IF;
END $$;

-- 2) Diagnose-Preise pro Gewerk
CREATE TABLE IF NOT EXISTS public.diagnose_preise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gewerk text UNIQUE NOT NULL,
  preis numeric(10,2) NOT NULL CHECK (preis > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Initial-Daten — gemappt auf unsere Gewerk-Schlüssel (siehe types/index.ts)
INSERT INTO public.diagnose_preise (gewerk, preis) VALUES
  ('sanitaer', 89),
  ('heizung', 89),
  ('elektro', 79),
  ('schlosser', 69),
  ('schreiner', 69),
  ('dachdecker', 89),
  ('maler', 59),
  ('allgemein', 59)
ON CONFLICT (gewerk) DO NOTHING;

ALTER TABLE public.diagnose_preise ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diagnose_preise_select_authenticated" ON public.diagnose_preise;
CREATE POLICY "diagnose_preise_select_authenticated"
  ON public.diagnose_preise FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "diagnose_preise_admin_write" ON public.diagnose_preise;
CREATE POLICY "diagnose_preise_admin_write"
  ON public.diagnose_preise FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin')
  );

-- 3) Nachträge (Bagatell / Wesentlich / Erheblich)
CREATE TABLE IF NOT EXISTS public.nachtraege (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  handwerker_id uuid REFERENCES public.profiles(id) NOT NULL,
  ursprungspreis numeric(10,2) NOT NULL CHECK (ursprungspreis > 0),
  nachtrag_betrag numeric(10,2) NOT NULL CHECK (nachtrag_betrag > 0),
  aufpreis_prozent numeric(6,2) GENERATED ALWAYS AS (
    (nachtrag_betrag / NULLIF(ursprungspreis, 0)) * 100
  ) STORED,
  stufe text GENERATED ALWAYS AS (
    CASE
      WHEN (nachtrag_betrag / NULLIF(ursprungspreis, 0)) * 100 <= 10 THEN 'bagatell'
      WHEN (nachtrag_betrag / NULLIF(ursprungspreis, 0)) * 100 <= 25 THEN 'wesentlich'
      ELSE 'erheblich'
    END
  ) STORED,
  begruendung text NOT NULL,
  fotos text[] NOT NULL DEFAULT '{}',
  status text DEFAULT 'offen' CHECK (status IN ('offen', 'genehmigt', 'abgelehnt')),
  genehmigt_von uuid REFERENCES public.profiles(id),
  genehmigt_am timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nachtraege_ticket
  ON public.nachtraege (ticket_id, created_at DESC);

ALTER TABLE public.nachtraege ENABLE ROW LEVEL SECURITY;

-- Lesen: Handwerker eigene + Verwalter eigene Tickets + Admin
DROP POLICY IF EXISTS "nachtraege_select_beteiligte" ON public.nachtraege;
CREATE POLICY "nachtraege_select_beteiligte"
  ON public.nachtraege FOR SELECT TO authenticated
  USING (
    handwerker_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.erstellt_von = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin')
  );

-- Einreichen: nur Handwerker, der dem Ticket zugewiesen ist
DROP POLICY IF EXISTS "nachtraege_insert_zugewiesen" ON public.nachtraege;
CREATE POLICY "nachtraege_insert_zugewiesen"
  ON public.nachtraege FOR INSERT TO authenticated
  WITH CHECK (
    handwerker_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.zugewiesener_hw = auth.uid()
    )
  );

-- Genehmigen/Ablehnen: Verwalter (Ticket-Ersteller) oder Admin
DROP POLICY IF EXISTS "nachtraege_update_verwalter" ON public.nachtraege;
CREATE POLICY "nachtraege_update_verwalter"
  ON public.nachtraege FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.erstellt_von = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin')
  );

-- 4) profiles.angebotstreue
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS angebotstreue numeric(5,2) DEFAULT 100;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_angebotstreue_range') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_angebotstreue_range
      CHECK (angebotstreue IS NULL OR (angebotstreue BETWEEN 0 AND 100));
  END IF;
END $$;

-- 5) Touch-Trigger für diagnose_preise.updated_at
CREATE OR REPLACE FUNCTION public.touch_diagnose_preise()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS diagnose_preise_touch ON public.diagnose_preise;
CREATE TRIGGER diagnose_preise_touch
  BEFORE UPDATE ON public.diagnose_preise
  FOR EACH ROW EXECUTE FUNCTION public.touch_diagnose_preise();

-- ============================================================
-- Done. Spätere Phasen brauchen kein weiteres Schema-Update für:
--   - Auto-Vergabe mit Korridor (nutzt vorhandene Felder)
--   - Vorkaufsrecht (vorkaufsrecht_bis ist schon da)
--   - Diagnosegebühr-Anrechnung (diagnosegebuehr_angerechnet)
--   - Nachtrag-Flow (nachtraege-Tabelle inkl. stufe-Auto)
--   - Angebotstreue-Score (profiles.angebotstreue)
-- ============================================================
