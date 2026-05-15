-- ============================================================
-- Reparo: KI-Quota in eigene Tabelle (statt profiles)
-- ============================================================
-- Folgt auf 20260520000000_rate_limit_ki_calls.sql.
--
-- Problem mit der ersten Variante: try_consume_ki_quota macht
-- UPDATE profiles, was vom protect_profile_fields-Trigger blockiert
-- wird (Trigger läuft im selben Transaktions-Kontext mit auth.uid()
-- = User, depth = 1, kein bypass).
--
-- Sauberer: eigene Tabelle ki_quota, kein Trigger drauf, RLS so
-- konfiguriert dass nur via SECURITY-DEFINER-Function gelesen/geschrieben
-- wird.
-- ============================================================

-- Aufräumen aus der ersten Migration: profiles-Spalten + alte Function
ALTER TABLE public.profiles DROP COLUMN IF EXISTS ki_calls_count;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS ki_calls_resetted_at;
DROP FUNCTION IF EXISTS public.try_consume_ki_quota(int);

-- protect_profile_fields wieder ohne ki_calls_*-Schutz
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;

  NEW.rolle := OLD.rolle;
  NEW.email := OLD.email;
  NEW.bewertung_avg := OLD.bewertung_avg;
  NEW.auftraege_anzahl := OLD.auftraege_anzahl;
  NEW.angebotstreue := OLD.angebotstreue;
  NEW.verfuegbarkeit_score := OLD.verfuegbarkeit_score;
  NEW.sichtbarkeit_stufe := OLD.sichtbarkeit_stufe;
  NEW.early_adopter_bis := OLD.early_adopter_bis;
  NEW.kalender_streak := OLD.kalender_streak;
  NEW.letzte_kalender_pflege := OLD.letzte_kalender_pflege;
  NEW.letzte_reaktivierung_mail := OLD.letzte_reaktivierung_mail;

  RETURN NEW;
END;
$$;

-- ============================================================
-- ki_quota-Tabelle
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ki_quota (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  calls_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ki_quota ENABLE ROW LEVEL SECURITY;

-- Kein direkter SELECT/UPDATE/INSERT erlaubt — alles über die Function.
-- (Default ohne Policies = nichts erlaubt für authenticated-Role.)

-- ============================================================
-- Atomic check-and-increment Function
-- ============================================================
CREATE OR REPLACE FUNCTION public.try_consume_ki_quota(_max_per_day int DEFAULT 10)
RETURNS TABLE(allowed boolean, remaining int, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int := 0;
  v_window_start timestamptz;
  v_today_start timestamptz := date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin';
  v_next_reset timestamptz := v_today_start + interval '1 day';
BEGIN
  IF v_uid IS NULL THEN
    -- Kein Auth-Kontext: durchlassen (Service-Role-Pfade)
    RETURN QUERY SELECT true, _max_per_day, v_next_reset;
    RETURN;
  END IF;

  -- Upsert mit FOR UPDATE-Lock
  INSERT INTO public.ki_quota (user_id, calls_count, window_start)
    VALUES (v_uid, 0, v_today_start)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT calls_count, window_start
    INTO v_count, v_window_start
    FROM public.ki_quota
    WHERE user_id = v_uid
    FOR UPDATE;

  -- Fenster-Reset wenn neuer Tag
  IF v_window_start < v_today_start THEN
    v_count := 0;
    UPDATE public.ki_quota
      SET calls_count = 0, window_start = v_today_start
      WHERE user_id = v_uid;
  END IF;

  IF v_count >= _max_per_day THEN
    RETURN QUERY SELECT false, 0, v_next_reset;
    RETURN;
  END IF;

  UPDATE public.ki_quota
    SET calls_count = v_count + 1
    WHERE user_id = v_uid;

  RETURN QUERY SELECT true, _max_per_day - (v_count + 1), v_next_reset;
END;
$$;

-- Authenticated-Users sollen die Function callen dürfen
GRANT EXECUTE ON FUNCTION public.try_consume_ki_quota(int) TO authenticated;
