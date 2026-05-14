-- ============================================================
-- Reparo: Tickets.einsatzort_* + Angebote.geschaetzte_dauer
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent (kann mehrfach laufen)
-- ============================================================

-- 1) Einsatzort am Ticket (von Mieter beim Melden gesetzt)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS einsatzort_adresse text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS einsatzort_lat double precision;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS einsatzort_lng double precision;

-- 2) Geschätzte Dauer am Angebot (Handwerker beim Bieten)
ALTER TABLE public.angebote ADD COLUMN IF NOT EXISTS geschaetzte_dauer text;

-- ============================================================
-- Done. Felder die der Code längst nutzt sind nun explizit dokumentiert.
-- ============================================================
