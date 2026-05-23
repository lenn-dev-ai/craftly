-- Sprint L — HW-Stamm-Gewerke aus Profil (23.05.2026)
-- Bug-Fix für Feedback 7de666f7: HW soll nicht pro Ticket frei Gewerk
-- wählen können, sondern nur seine in Profil-Settings gesetzten 1-3
-- Stamm-Gewerke.
--
-- Verwendet die Reparo-Gewerk-Strings (heizung_sanitaer, elektro, ...)
-- statt der Spec-Strings — sonst würde das Array nicht mit der
-- bestehenden tickets.gewerk-Spalte matchen.
--
-- Idempotent: alle Statements per IF NOT EXISTS / DO $$.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS handwerker_gewerke text[] DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname  = 'handwerker_gewerke_valid'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT handwerker_gewerke_valid
      CHECK (
        handwerker_gewerke IS NULL
        OR (
          array_length(handwerker_gewerke, 1) BETWEEN 1 AND 3
          AND handwerker_gewerke <@ ARRAY[
            'heizung_sanitaer', 'elektro', 'schreiner', 'maler',
            'dachdecker', 'bodenleger', 'schluessel', 'allgemein'
          ]
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_handwerker_gewerke
  ON public.profiles USING gin(handwerker_gewerke)
  WHERE rolle = 'handwerker';

-- Backfill für bestehende HW: das einzelne 'gewerk'-Feld wird zum
-- 1-Element-Array. Präziser als die Spec-Variante (ARRAY der 5
-- Defaults) — HW sehen sofort nur ihre echten Tickets und müssen
-- nur dann ihre Auswahl erweitern, wenn sie tatsächlich mehrere
-- Gewerke abdecken.
UPDATE public.profiles
SET handwerker_gewerke = ARRAY[gewerk]
WHERE rolle = 'handwerker'
  AND handwerker_gewerke IS NULL
  AND gewerk IS NOT NULL
  AND gewerk IN (
    'heizung_sanitaer', 'elektro', 'schreiner', 'maler',
    'dachdecker', 'bodenleger', 'schluessel', 'allgemein'
  );

COMMENT ON COLUMN public.profiles.handwerker_gewerke IS
  'Sprint L: 1-3 Stamm-Gewerke. Marktplatz filtert auf diese. NULL = noch nicht gesetzt (HW sieht leeren Marktplatz mit CTA).';
