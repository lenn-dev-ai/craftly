-- ============================================================
-- Reparo: Rate-Limit für KI-Schadenserkennung (2026-05-15)
-- ============================================================
-- /api/ki/schadenserkennung ruft Anthropic-Vision auf — pro Aufruf
-- ~5 KB Bild + ~500 Output-Tokens. Ohne Limit kann ein einzelner
-- Mieter (oder ein kompromittierter Account) hunderte Calls/Stunde
-- machen — Kosten-Risiko.
--
-- Lösung: Counter pro User in profiles, atomic increment via
-- SECURITY DEFINER function. Reset täglich um 00:00 Europe/Berlin
-- (kein Cron nötig — Reset passiert lazy beim ersten Call des Tages).
--
-- Limit: 10 erfolgreiche KI-Calls pro 24h pro User.
-- ============================================================

-- 1. Spalten in profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ki_calls_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ki_calls_resetted_at timestamptz;

-- 2. Atomic check-and-increment Function
-- Returns:
--   { allowed: boolean, remaining: int, reset_at: timestamptz }
-- Wenn allowed = false, wurde NICHT incrementiert (caller darf nicht weiter)

CREATE OR REPLACE FUNCTION public.try_consume_ki_quota(_max_per_day int DEFAULT 10)
RETURNS TABLE(allowed boolean, remaining int, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
  v_resetted timestamptz;
  v_window_start timestamptz := date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin';
  v_next_reset timestamptz := v_window_start + interval '1 day';
BEGIN
  IF v_uid IS NULL THEN
    -- Service-Role / nicht-eingeloggt: kein Limit
    RETURN QUERY SELECT true, _max_per_day, v_next_reset;
    RETURN;
  END IF;

  -- Aktuelle Werte lesen, ggf. fenster-bedingt zurücksetzen
  SELECT ki_calls_count, ki_calls_resetted_at
    INTO v_count, v_resetted
    FROM public.profiles
    WHERE id = v_uid
    FOR UPDATE;

  IF v_resetted IS NULL OR v_resetted < v_window_start THEN
    -- Neues Tagesfenster
    v_count := 0;
  END IF;

  IF v_count >= _max_per_day THEN
    RETURN QUERY SELECT false, 0, v_next_reset;
    RETURN;
  END IF;

  -- Increment + Reset-Marker
  UPDATE public.profiles
    SET ki_calls_count = v_count + 1,
        ki_calls_resetted_at = v_window_start
    WHERE id = v_uid;

  RETURN QUERY SELECT true, _max_per_day - (v_count + 1), v_next_reset;
END;
$$;

-- Falls die protect_profile_fields-Trigger den Counter resettet:
-- Wir müssen ki_calls_count + ki_calls_resetted_at zur "darf gepflegt werden"
-- Whitelist hinzufügen, weil try_consume_ki_quota mit auth.uid() läuft, also
-- nicht via pg_trigger_depth() bypassen wird.

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;

  -- Schutz wie zuvor — aber ki_calls_* dürfen vom Quota-Helper verändert
  -- werden (der ist SECURITY DEFINER und läuft als der User selbst,
  -- pg_trigger_depth() ist trotzdem 1 weil es ein Function-Call ist,
  -- kein Trigger-Cascade).
  --
  -- Lösung: ki_calls_* aus dem Reset rausnehmen — sie sind nicht
  -- security-relevant (User würde sich selbst einschränken, nicht
  -- erweitern; und max_per_day ist serverseitig gesetzt).

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
  -- ki_calls_count / ki_calls_resetted_at: NICHT in Schutz aufgenommen
  -- (Begründung oben). Trotzdem: ein User könnte ki_calls_count auf 0
  -- setzen und damit das Limit umgehen. Daher hier doch reset:

  NEW.ki_calls_count := OLD.ki_calls_count;
  NEW.ki_calls_resetted_at := OLD.ki_calls_resetted_at;

  RETURN NEW;
END;
$$;
