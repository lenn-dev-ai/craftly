-- Sprint BH — stamm_handwerker-FKs auf public.profiles umhängen.
--
-- Prod-Befund 05.07.2026: Die Tabelle existierte auf Prod schon VOR der
-- Migration 20260615100030 (per Studio angelegt), deren CREATE TABLE IF
-- NOT EXISTS deshalb no-op war. Die Alt-FKs zeigen auf auth.users statt
-- public.profiles — damit kann PostgREST den Embed
--   stamm_handwerker?select=...,handwerker:profiles!handwerker_id(...)
-- nicht auflösen (400, PGRST200) und der Marktplatz-Tab "Meine
-- Handwerker" bleibt leer bzw. der Einladen-Dialog zeigt "Keine
-- Stamm-HW angelegt", obwohl Zeilen existieren.
--
-- Gefahrlos: profiles.id ist 1:1 identisch mit auth.users.id, die
-- bestehenden Werte validieren gegen beide. Idempotent via IF EXISTS +
-- Neuanlage unter demselben Namen.
ALTER TABLE public.stamm_handwerker
  DROP CONSTRAINT IF EXISTS stamm_handwerker_handwerker_id_fkey;
ALTER TABLE public.stamm_handwerker
  ADD CONSTRAINT stamm_handwerker_handwerker_id_fkey
    FOREIGN KEY (handwerker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.stamm_handwerker
  DROP CONSTRAINT IF EXISTS stamm_handwerker_verwalter_id_fkey;
ALTER TABLE public.stamm_handwerker
  ADD CONSTRAINT stamm_handwerker_verwalter_id_fkey
    FOREIGN KEY (verwalter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
