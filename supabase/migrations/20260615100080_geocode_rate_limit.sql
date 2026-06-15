-- ============================================================
-- Reparo: Rate-Limit für /api/geocode
-- ============================================================
-- Audit-Report 2026-06-15 (Abschnitt 5.2 / P1): einziger noch offener
-- Punkt aus SECURITY-REPORT.md — /api/geocode hat bisher nur einen
-- Auth-Check, aber kein Quota/Throttle. Nominatim erlaubt 1 req/s und
-- erwartet "reasonable use"; ein kompromittierter oder Bot-Account
-- könnte sonst die App-IP bei Nominatim sperren lassen.
--
-- Folgt 1:1 dem bewährten Muster aus 20260520100000_rate_limit_ki_separate_table.sql
-- (eigene Tabelle, SECURITY DEFINER Function, kein direkter Tabellenzugriff).
-- Limit bewusst höher als KI-Quota (60/Tag statt 10/Tag), da Adress-
-- Autovervollständigung pro Ticket-Erstellung mehrfach (debounced)
-- aufgerufen wird.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.geocode_quota (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  calls_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.geocode_quota ENABLE ROW LEVEL SECURITY;

-- Kein direkter SELECT/UPDATE/INSERT erlaubt — alles über die Function.
-- (Default ohne Policies = nichts erlaubt für authenticated-Role.)

CREATE OR REPLACE FUNCTION public.try_consume_geocode_quota(_max_per_day int DEFAULT 60)
RETURNS TABLE(allowed boolean, remaining int, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  INSERT INTO public.geocode_quota (user_id, calls_count, window_start)
    VALUES (v_uid, 0, v_today_start)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT calls_count, window_start
    INTO v_count, v_window_start
    FROM public.geocode_quota
    WHERE user_id = v_uid
    FOR UPDATE;

  -- Fenster-Reset wenn neuer Tag
  IF v_window_start < v_today_start THEN
    v_count := 0;
    UPDATE public.geocode_quota
      SET calls_count = 0, window_start = v_today_start
      WHERE user_id = v_uid;
  END IF;

  IF v_count >= _max_per_day THEN
    RETURN QUERY SELECT false, 0, v_next_reset;
    RETURN;
  END IF;

  UPDATE public.geocode_quota
    SET calls_count = v_count + 1
    WHERE user_id = v_uid;

  RETURN QUERY SELECT true, _max_per_day - (v_count + 1), v_next_reset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_consume_geocode_quota(int) TO authenticated;
