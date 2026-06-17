-- Sprint AX — Handwerker-Agent: Präferenzen-Spalten in profiles
-- Drei neue Felder die der Agent nutzt um Direktvergaben zu bewerten:
--   agent_max_radius_km   — Max. Entfernung für Auto-Empfehlung (default = radius_km)
--   agent_auto_accept     — Agent nimmt passende Aufträge automatisch an (opt-in)
--   agent_min_auftragswert — Untergrenze in € — darunter kein Auto-Accept

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agent_max_radius_km   integer   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS agent_auto_accept      boolean   DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS agent_min_auftragswert numeric   DEFAULT NULL;

COMMENT ON COLUMN public.profiles.agent_max_radius_km   IS 'Sprint AX: Max. km für Agent-Empfehlung. NULL = radius_km des Profils verwenden.';
COMMENT ON COLUMN public.profiles.agent_auto_accept      IS 'Sprint AX: Agent nimmt passende Aufträge automatisch an (opt-in, default false).';
COMMENT ON COLUMN public.profiles.agent_min_auftragswert IS 'Sprint AX: Mindest-Auftragswert in € für Auto-Accept. NULL = kein Limit.';
