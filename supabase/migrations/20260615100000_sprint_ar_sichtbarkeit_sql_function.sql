-- Sprint AR: recompute_sichtbarkeit_all() — ersetzt den N×4-Round-Trip-Loop
-- im /api/cron/sichtbarkeits-recompute-Cron durch einen einzigen DB-Scan.
--
-- Score-Formel (100 Punkte):
--   15 Pkt  Google-Cal verbunden (Row in hw_google_oauth)
--   15 Pkt  Antwort-Rate letzte 30 Tage (einladungen + stamm_anfragen)
--   50 Pkt  bewertung_avg linear 0..5 → 0..50 (Neuling-Default: 30)
--   20 Pkt  Direktvergabe-Aktivität (angenommene Vergaben / 5 Ziel)
--
-- Stufen: ≥75 → gold, ≥50 → silber, sonst → bronze

CREATE OR REPLACE FUNCTION public.recompute_sichtbarkeit_all()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE public.profiles p
  SET
    verfuegbarkeit_score = scores.total_score,
    sichtbarkeit_stufe   = CASE
                             WHEN scores.total_score >= 75 THEN 'gold'
                             WHEN scores.total_score >= 50 THEN 'silber'
                             ELSE                               'bronze'
                           END
  FROM (
    SELECT
      hw.id,
      -- 15 Pkt: Google-Cal verbunden
      CASE WHEN EXISTS (
             SELECT 1 FROM public.hw_google_oauth g WHERE g.user_id = hw.id
           ) THEN 15 ELSE 0 END
      -- 15 Pkt: Antwort-Rate letzte 30 Tage (bei 0 Anfragen: volle 15 als Default)
      + CASE
          WHEN (COALESCE(e.gesamt, 0) + COALESCE(s.gesamt, 0)) > 0 THEN
            LEAST(15,
              ROUND(
                (COALESCE(e.beantwortet, 0) + COALESCE(s.beantwortet, 0))::numeric
                / (COALESCE(e.gesamt, 0) + COALESCE(s.gesamt, 0)) * 15
              )::int
            )
          ELSE 15
        END
      -- 50 Pkt: Bewertung (Neuling-Default 30 ≈ 3.0/5)
      + CASE
          WHEN hw.bewertung_avg IS NOT NULL
          THEN LEAST(50, ROUND(hw.bewertung_avg / 5.0 * 50)::int)
          ELSE 30
        END
      -- 20 Pkt: Direktvergabe-Aktivität (Ziel: 5 Vergaben / 30 Tage)
      + LEAST(20,
          ROUND(
            (COALESCE(e.angenommen, 0) + COALESCE(s.angenommen, 0))::numeric / 5 * 20
          )::int
        )
      AS total_score
    FROM public.profiles hw
    LEFT JOIN (
      SELECT
        handwerker_id,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')                        AS gesamt,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days' AND status <> 'offen')  AS beantwortet,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days' AND status = 'angebot') AS angenommen
      FROM public.einladungen
      GROUP BY handwerker_id
    ) e ON e.handwerker_id = hw.id
    LEFT JOIN (
      SELECT
        handwerker_id,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')                           AS gesamt,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days' AND status <> 'gesendet')  AS beantwortet,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days' AND status = 'angenommen') AS angenommen
      FROM public.stamm_anfragen
      GROUP BY handwerker_id
    ) s ON s.handwerker_id = hw.id
    WHERE hw.rolle = 'handwerker'
  ) scores
  WHERE p.id = scores.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', updated_count);
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_sichtbarkeit_all() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_sichtbarkeit_all() TO service_role;
