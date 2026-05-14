-- ============================================================
-- Reparo: Sichtbarkeits-Score auf Basis der bestehenden zeitslots
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent
--
-- Strategie: KEINE neue Tabelle. zeitslots ist bereits die Quelle für
-- datums-spezifische Verfügbarkeiten (status='verfuegbar'). Wir
-- ergänzen nur Aggregat-Felder auf profiles, die per
-- /api/verfuegbarkeit/update-score gepflegt werden.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verfuegbarkeit_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sichtbarkeit_stufe text DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS kalender_streak integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS letzte_kalender_pflege timestamptz;

-- CHECK separat anlegen (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_sichtbarkeit_stufe_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_sichtbarkeit_stufe_check
      CHECK (sichtbarkeit_stufe IN ('gold', 'silber', 'bronze'));
  END IF;
END $$;

-- ============================================================
-- Done. Felder werden gepflegt von:
--   POST /api/verfuegbarkeit/update-score (Selbstbedienung)
--   und bei jeder Slot-Add/Delete-Aktion im Handwerker-UI.
-- ============================================================
