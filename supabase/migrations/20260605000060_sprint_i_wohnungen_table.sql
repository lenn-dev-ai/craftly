-- Sprint I — Bulk-Wohnungs-Import (23.05.2026)
-- Lennart hat via Cowork explizit Apply autorisiert.
-- Idempotent: alle Statements per IF NOT EXISTS.
--
-- Apply-Versuch via mcp__supabase__apply_migration ist fehlgeschlagen
-- weil die MCP-Verbindung im read-only-mode konfiguriert ist. File wird
-- daher als Migration-File ins Repo gelegt; Lennart bzw. Cowork
-- applizieren via direkter MCP-Connection nach Rückkehr.

CREATE TABLE IF NOT EXISTS public.wohnungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verwalter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  strasse text NOT NULL,
  hausnummer text NOT NULL,
  plz text NOT NULL,
  ort text NOT NULL,
  whg_bezeichnung text NOT NULL,
  mieter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  mieter_name text,
  mieter_email text,
  mieter_telefon text,
  baujahr int,
  qm numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wohnungen_unique_per_verwalter UNIQUE (verwalter_id, strasse, hausnummer, whg_bezeichnung)
);

ALTER TABLE public.wohnungen ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'wohnungen' AND policyname = 'wohnungen_verwalter_all'
  ) THEN
    CREATE POLICY wohnungen_verwalter_all ON public.wohnungen
      FOR ALL TO authenticated
      USING (verwalter_id = (SELECT auth.uid()))
      WITH CHECK (verwalter_id = (SELECT auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wohnungen_verwalter ON public.wohnungen(verwalter_id);
CREATE INDEX IF NOT EXISTS idx_wohnungen_mieter ON public.wohnungen(mieter_id) WHERE mieter_id IS NOT NULL;

COMMENT ON TABLE public.wohnungen IS 'Sprint I — Wohnungs-Bestand pro Verwaltung; Bulk-Import via CSV/XLSX';
COMMENT ON COLUMN public.wohnungen.mieter_id IS 'Optional FK auf profiles; NULL solange Mieter nicht in Reparo registriert';
COMMENT ON COLUMN public.wohnungen.mieter_name IS 'Stamm-Daten aus Import; bei mieter_id NOT NULL bevorzugt profiles.name';
