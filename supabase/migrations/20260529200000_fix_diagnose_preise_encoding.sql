-- BUG-5 aus Agent-Review (17. Mai 2026):
-- "SanitÃ¤r" als Mojibake in Diagnose-Preise-Tabelle. Ursache: in der
-- diagnose_preise-Tabelle steht der gewerk-Wert vermutlich als anzeige-
-- nahes "Sanitär" (oder durch Encoding-Mishap "SanitÃ¤r") gespeichert,
-- statt als ASCII-Key "sanitaer", den formatGewerk() dann zu "Sanitär"
-- expandieren würde.
--
-- Diese Migration normalisiert alle gewerk-Werte auf die ASCII-Keys
-- aus types/index.ts (GEWERK_LABELS). Idempotent.

UPDATE public.diagnose_preise
   SET gewerk = CASE
     WHEN gewerk ILIKE 'sanit%'        THEN 'sanitaer'
     WHEN gewerk ILIKE 'elektr%'       THEN 'elektro'
     WHEN gewerk ILIKE 'heiz%'         THEN 'heizung'
     WHEN gewerk ILIKE 'mal%'          THEN 'maler'
     WHEN gewerk ILIKE 'schloss%'      THEN 'schlosser'
     WHEN gewerk ILIKE 'schrein%'      THEN 'schreiner'
     WHEN gewerk ILIKE 'dachdeck%'     THEN 'dachdecker'
     WHEN gewerk ILIKE 'allgemein%'    THEN 'allgemein'
     WHEN gewerk ILIKE 'fliesen%'      THEN 'fliesenleger'
     ELSE LOWER(gewerk)
   END
 WHERE gewerk IS NOT NULL
   AND gewerk NOT IN ('sanitaer','elektro','heizung','maler','schlosser','schreiner','dachdecker','allgemein','fliesenleger');

-- Verifikation (manuell im Studio):
--   SELECT DISTINCT gewerk FROM diagnose_preise ORDER BY gewerk;
--   → nur ASCII-Keys erwartet (sanitaer, elektro, …)
