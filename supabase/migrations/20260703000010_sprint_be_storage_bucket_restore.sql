-- ============================================================
-- Reparo: Storage-Bucket "schadens-fotos" wiederherstellen
-- ============================================================
-- Befund (Review 2026-07-03): storage.buckets ist in der Live-DB LEER —
-- der Bucket aus Migration 20241001 fehlt (vermutlich beim DB-Cleanup
-- verloren). Folge: ALLE Foto-Uploads (Mieter-Meldung, Wizard) schlagen
-- still fehl. Von den Policies überlebte nur schadens_fotos_select_strict
-- (20260521); die INSERT/DELETE-Policies fehlen ebenfalls.
--
-- Diese Migration ist vollständig idempotent und stellt Bucket +
-- INSERT/DELETE-Policies wieder her. Die strikte SELECT-Policy aus
-- 20260521 bleibt unangetastet (existiert bereits).

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

-- DELETE: nur Owner darf das eigene Foto löschen.
DROP POLICY IF EXISTS "schadens_fotos_delete_own" ON storage.objects;
CREATE POLICY "schadens_fotos_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'schadens-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
