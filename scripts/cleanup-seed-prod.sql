-- =====================================================================
-- Entfernt die Prod-Testdatenbasis (scripts/gen-seed-prod.mjs).
-- Alle Seed-Zeilen tragen ein 5eed-UUID-Präfix → sicher & vollständig.
-- Reihenfolge = umgekehrte FK-Abhängigkeit. Vor Public-Launch ausführen.
-- =====================================================================
BEGIN;
DELETE FROM public.nachtraege        WHERE id::text LIKE '5eed%';
DELETE FROM public.provisionen       WHERE id::text LIKE '5eed%';
DELETE FROM public.bewertungen       WHERE id::text LIKE '5eed%';
DELETE FROM public.termine           WHERE id::text LIKE '5eed%';
DELETE FROM public.einladungen       WHERE id::text LIKE '5eed%';
DELETE FROM public.angebote          WHERE id::text LIKE '5eed%';
DELETE FROM public.tickets           WHERE id::text LIKE '5eed%';
DELETE FROM public.stamm_handwerker  WHERE id::text LIKE '5eed%';
DELETE FROM public.wohnungen         WHERE id::text LIKE '5eed%';
DELETE FROM public.objekte           WHERE id::text LIKE '5eed%';
DELETE FROM public.eigentuemer       WHERE id::text LIKE '5eed%';
COMMIT;
