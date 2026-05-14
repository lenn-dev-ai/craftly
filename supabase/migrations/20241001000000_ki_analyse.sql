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
-- Storage-Bucket "schadens-fotos" (privat) + RLS-Policies
-- ============================================================
-- Bucket per SQL anlegen (Studio → Storage zeigt ihn anschließend).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'schadens-fotos',
  'schadens-fotos',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- INSERT: jeder authentifizierte User darf in seinen eigenen Folder
-- (Pfad-Convention: "userId/...") hochladen.
DROP POLICY IF EXISTS "schadens_fotos_insert_own" ON storage.objects;
CREATE POLICY "schadens_fotos_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'schadens-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: alle authentifizierten dürfen Signed URLs erstellen. Schutz
-- gegen unbefugten Zugriff erfolgt durch RLS auf tickets (wer das
-- Ticket nicht sieht, kennt foto_url nicht und kann keinen Signed-Link
-- erzeugen).
DROP POLICY IF EXISTS "schadens_fotos_select_authenticated" ON storage.objects;
CREATE POLICY "schadens_fotos_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'schadens-fotos');

-- DELETE: nur Owner darf das eigene Foto löschen.
DROP POLICY IF EXISTS "schadens_fotos_delete_own" ON storage.objects;
CREATE POLICY "schadens_fotos_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'schadens-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
