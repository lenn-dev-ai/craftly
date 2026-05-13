-- ============================================================
-- Reparo: KI-Analyse-Felder auf tickets
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent
--
-- tickets.foto_url existiert bereits aus schema-v2.sql.
-- ============================================================

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ki_confidence numeric(3,2),
  ADD COLUMN IF NOT EXISTS ki_schadensart text;

-- ============================================================
-- Storage-Bucket "schadens-fotos" muss separat in Supabase Studio
-- angelegt werden:
--   Storage → New bucket → Name: schadens-fotos
--   Public: false · File-size-limit: 5 MB
--   Allowed MIME: image/jpeg, image/png, image/webp, image/heic
--
-- RLS-Policy für den Bucket:
--   INSERT: auth.uid() = (storage.foldername(name))[1]::uuid
--   SELECT: gleiche Bedingung ODER Verwalter/Admin
-- ============================================================
