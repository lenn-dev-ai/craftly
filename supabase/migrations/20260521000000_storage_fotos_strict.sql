-- ============================================================
-- Reparo: Storage-RLS schadens-fotos einschränken (Audit FIX-8)
-- ============================================================
-- Vorher: Policy "schadens_fotos_select_authenticated" erlaubte allen
-- eingeloggten Nutzern SELECT auf den ganzen Bucket. Begründung damals:
-- "Schutz erfolgt durch RLS auf tickets — wer foto_url nicht sieht,
-- erzeugt keinen Signed-Link". Schwach: jeder Pfad ist ratbar
-- (uuid + filename), und Insertion via Folder-Convention "userId/..."
-- macht das Erraten noch einfacher.
--
-- Jetzt: Owner ODER Ticket-Beteiligte (erstellt_von, verwalter_id,
-- zugewiesener_hw) ODER Admin dürfen lesen.
-- ============================================================

DROP POLICY IF EXISTS "schadens_fotos_select_authenticated" ON storage.objects;

CREATE POLICY "schadens_fotos_select_strict"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'schadens-fotos'
    AND (
      -- Owner = User der hochgeladen hat (Pfad-Convention: "userId/...")
      (storage.foldername(name))[1] = auth.uid()::text

      -- Admin sieht alles
      OR public.is_admin()

      -- Ticket-Beteiligte: das Foto gehört zu einem Ticket dessen
      -- erstellt_von / verwalter_id / zugewiesener_hw der aktuelle
      -- User ist. Match über tickets.foto_url (= "userId/filename").
      OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.foto_url = storage.objects.name
          AND (
            t.erstellt_von = auth.uid()
            OR t.verwalter_id = auth.uid()
            OR t.zugewiesener_hw = auth.uid()
          )
      )

      -- Befund-Fotos: tickets.befund_fotos ist text[] mit Pfaden
      OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE storage.objects.name = ANY(t.befund_fotos)
          AND (
            t.erstellt_von = auth.uid()
            OR t.verwalter_id = auth.uid()
            OR t.zugewiesener_hw = auth.uid()
          )
      )
    )
  );
