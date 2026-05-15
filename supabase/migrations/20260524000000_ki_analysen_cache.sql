-- ============================================================
-- Reparo: KI-Analysen-Cache (Audit Sprint 3 KI-3)
-- ============================================================
-- Vor diesem Cache wurde JEDES Foto durch Anthropic geschickt — auch
-- wenn der gleiche User exakt dasselbe Foto 10× innerhalb einer Stunde
-- hochgeladen hätte (Spam, Doppelklick, retry). Ergebnis: 10× Anthropic-
-- Kosten + 10 verbrauchte Tages-Quota-Credits für identische Antwort.
--
-- Dieser Cache speichert SHA-256-Hash des Foto-Bytes pro User. Der API-
-- Handler prüft 24h-window: Hit → cached JSON zurück, kein Anthropic-Call,
-- kein Quota-Verbrauch.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ki_analysen_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  foto_hash text NOT NULL,
  ergebnis jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, foto_hash)
)
;

-- Lookup-Index für (user_id, foto_hash) ist durch UNIQUE bereits da.
-- Cleanup-Index für TTL-Cron (älter als X Tage):
CREATE INDEX IF NOT EXISTS idx_ki_cache_created_at
  ON public.ki_analysen_cache (created_at);

ALTER TABLE public.ki_analysen_cache ENABLE ROW LEVEL SECURITY;

-- Kein direkter Client-Zugriff — alles über die API-Route mit
-- Service-Role-Client. Default ohne Policies = nichts erlaubt.
