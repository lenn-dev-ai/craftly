-- ============================================================
-- Reparo: tickets.foto_urls — Multi-Foto-Support (UX-1)
-- ============================================================
-- Bisher konnte der Mieter nur EIN Foto pro Ticket hochladen.
-- Audit Sprint 2 (UX-1) verlangt bis zu 5 Fotos für bessere Diagnose.
--
-- Strategie: foto_url bleibt als "primäres Hauptfoto" (Backwards-Compat
-- für bestehende Listen, Cards, OG-Images). foto_urls ist text[] mit
-- ALLEN Pfaden inkl. dem Hauptfoto an Index 0. So müssen Anzeigen die
-- nur 1 Bild brauchen nichts ändern.
-- ============================================================

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS foto_urls text[] NOT NULL DEFAULT '{}';

-- Index nur sinnvoll wenn nach Vorhandensein eines Fotos gefiltert wird.
-- GIN auf array sparen wir uns — kein bekannter Query-Pattern dafür.

-- Storage-RLS-Policy für schadens-fotos auch auf foto_urls erweitern,
-- damit Beteiligte nicht nur das Haupt-Foto, sondern auch zusätzliche
-- Fotos sehen können. Der Owner-Pfad-Check + Admin bleibt unverändert.

DROP POLICY IF EXISTS "schadens_fotos_select_strict" ON storage.objects;

CREATE POLICY "schadens_fotos_select_strict"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'schadens-fotos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.foto_url = storage.objects.name
          AND (
            t.erstellt_von = auth.uid()
            OR t.verwalter_id = auth.uid()
            OR t.zugewiesener_hw = auth.uid()
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE storage.objects.name = ANY(t.foto_urls)
          AND (
            t.erstellt_von = auth.uid()
            OR t.verwalter_id = auth.uid()
            OR t.zugewiesener_hw = auth.uid()
          )
      )
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
