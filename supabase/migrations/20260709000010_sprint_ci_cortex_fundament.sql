-- Sprint CI — Reparo Cortex: Fundament des System-Gehirns.
--
-- Vier Organe:
--   cortex_ereignisse     — Nervenimpulse: alles, was im System passiert
--   cortex_gedaechtnis    — episodisch/semantisch/prozedural, mit Embedding
--   cortex_entscheidungen — Journal: jede Überlegung mit Begründung/Ergebnis
--   cortex_playbooks      — prozedurale Handlungsabläufe, vom Cortex pflegbar
--
-- Dazu Trigger-Nervenbahnen auf den Kern-Tabellen. WICHTIG: Der Emitter
-- schluckt JEDEN Fehler — das Gehirn darf niemals das Geschäft blockieren.
-- Zugriff: nur Admins lesen (RLS), Schreiben ausschließlich Service-Role.

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cortex_ereignisse (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quelle       text        NOT NULL,              -- 'trigger' | 'app' | 'cron' | 'cortex'
  typ          text        NOT NULL,              -- z.B. 'ticket_neu', 'ticket_status', 'angebot_neu'
  entitaet     text,                              -- Tabellen-/Objektname
  entitaet_id  uuid,
  payload      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  verarbeitet  boolean     NOT NULL DEFAULT false,
  erstellt_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cortex_ereignisse_offen_idx
  ON public.cortex_ereignisse (verarbeitet, erstellt_at);
CREATE INDEX IF NOT EXISTS cortex_ereignisse_typ_idx
  ON public.cortex_ereignisse (typ, erstellt_at DESC);

-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cortex_gedaechtnis (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  typ            text        NOT NULL CHECK (typ IN ('episodisch','semantisch','prozedural')),
  inhalt         text        NOT NULL,
  kontext        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  wichtigkeit    integer     NOT NULL DEFAULT 3 CHECK (wichtigkeit BETWEEN 1 AND 5),
  quelle         text,                            -- z.B. 'schlaf-zyklus', 'manuell'
  embedding      vector(384),                     -- gte-small (Supabase Edge AI); NULL = nur Textsuche
  such           tsvector GENERATED ALWAYS AS (to_tsvector('german', inhalt)) STORED,
  erstellt_at    timestamptz NOT NULL DEFAULT now(),
  aktualisiert_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cortex_gedaechtnis_such_idx ON public.cortex_gedaechtnis USING gin (such);
CREATE INDEX IF NOT EXISTS cortex_gedaechtnis_typ_idx  ON public.cortex_gedaechtnis (typ, wichtigkeit DESC);

-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cortex_entscheidungen (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  typ          text        NOT NULL,              -- 'schlaf' | 'reflex' | 'deliberation' | 'memo'
  ausloeser    text,
  begruendung  text,
  ergebnis     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  modell       text,
  tokens_in    integer,
  tokens_out   integer,
  erstellt_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cortex_entscheidungen_typ_idx
  ON public.cortex_entscheidungen (typ, erstellt_at DESC);

-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cortex_playbooks (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name           text        NOT NULL UNIQUE,
  beschreibung   text,
  schritte       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  aktiv          boolean     NOT NULL DEFAULT true,
  erstellt_at    timestamptz NOT NULL DEFAULT now(),
  aktualisiert_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- RLS: Admins lesen, niemand außer Service-Role schreibt.
ALTER TABLE public.cortex_ereignisse     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cortex_gedaechtnis    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cortex_entscheidungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cortex_playbooks      ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cortex_ereignisse_admin_select') THEN
    CREATE POLICY "cortex_ereignisse_admin_select" ON public.cortex_ereignisse FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cortex_gedaechtnis_admin_select') THEN
    CREATE POLICY "cortex_gedaechtnis_admin_select" ON public.cortex_gedaechtnis FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cortex_entscheidungen_admin_select') THEN
    CREATE POLICY "cortex_entscheidungen_admin_select" ON public.cortex_entscheidungen FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cortex_playbooks_admin_select') THEN
    CREATE POLICY "cortex_playbooks_admin_select" ON public.cortex_playbooks FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin'));
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Nervenbahnen: Emitter-Funktion + Trigger. Fehler werden IMMER
-- geschluckt — ein defektes Gehirn darf keine Buchung verhindern.
CREATE OR REPLACE FUNCTION public.cortex_emit(
  p_typ text, p_entitaet text, p_entitaet_id uuid, p_payload jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.cortex_ereignisse (quelle, typ, entitaet, entitaet_id, payload)
  VALUES ('trigger', p_typ, p_entitaet, p_entitaet_id, COALESCE(p_payload, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  NULL; -- niemals das Geschäft blockieren
END $$;

CREATE OR REPLACE FUNCTION public.cortex_trg_tickets() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.cortex_emit('ticket_neu', 'tickets', NEW.id, jsonb_build_object(
      'titel', NEW.titel, 'gewerk', NEW.gewerk, 'status', NEW.status,
      'prioritaet', NEW.prioritaet, 'verwalter_id', NEW.verwalter_id,
      'kein_schaden', NEW.kein_schaden, 'via', NEW.eingetragen_via));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.cortex_emit('ticket_status', 'tickets', NEW.id, jsonb_build_object(
      'titel', NEW.titel, 'von', OLD.status, 'nach', NEW.status,
      'zugewiesener_hw', NEW.zugewiesener_hw, 'kosten_final', NEW.kosten_final));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cortex_tickets_trg ON public.tickets;
CREATE TRIGGER cortex_tickets_trg
  AFTER INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.cortex_trg_tickets();

CREATE OR REPLACE FUNCTION public.cortex_trg_generisch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.cortex_emit(TG_ARGV[0], TG_TABLE_NAME, NEW.id, to_jsonb(NEW) - 'embedding' - 'such');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS cortex_angebote_trg ON public.angebote;
CREATE TRIGGER cortex_angebote_trg
  AFTER INSERT ON public.angebote
  FOR EACH ROW EXECUTE FUNCTION public.cortex_trg_generisch('angebot_neu');

DROP TRIGGER IF EXISTS cortex_bewertungen_trg ON public.bewertungen;
CREATE TRIGGER cortex_bewertungen_trg
  AFTER INSERT ON public.bewertungen
  FOR EACH ROW EXECUTE FUNCTION public.cortex_trg_generisch('bewertung_neu');

DROP TRIGGER IF EXISTS cortex_nachtraege_trg ON public.nachtraege;
CREATE TRIGGER cortex_nachtraege_trg
  AFTER INSERT ON public.nachtraege
  FOR EACH ROW EXECUTE FUNCTION public.cortex_trg_generisch('nachtrag_neu');

DROP TRIGGER IF EXISTS cortex_feedback_trg ON public.feedback;
CREATE TRIGGER cortex_feedback_trg
  AFTER INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.cortex_trg_generisch('feedback_neu');

-- ---------------------------------------------------------------
-- Semantische Suche: Cosine-Similarity über service-role RPC.
CREATE OR REPLACE FUNCTION public.cortex_erinnern(
  p_embedding vector(384), p_limit integer DEFAULT 6
) RETURNS TABLE (id uuid, typ text, inhalt text, wichtigkeit integer, aehnlichkeit float)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.typ, g.inhalt, g.wichtigkeit,
         1 - (g.embedding <=> p_embedding) AS aehnlichkeit
  FROM public.cortex_gedaechtnis g
  WHERE g.embedding IS NOT NULL
  ORDER BY g.embedding <=> p_embedding
  LIMIT p_limit;
$$;

-- Start-Playbook: der Schlaf-Zyklus dokumentiert sich selbst.
INSERT INTO public.cortex_playbooks (name, beschreibung, schritte)
VALUES ('schlaf-zyklus',
  'Nächtliche Konsolidierung: Ereignisse sichten, Auffälligkeiten erkennen, Erkenntnisse merken, Memo an den Betreiber.',
  '["Ereignisse der letzten 24h laden","Hängende Vergaben & offenes Feedback prüfen","Relevante Erinnerungen abrufen","Deliberation (Claude) mit Charta","Erkenntnisse ins Gedächtnis schreiben","Memo per Mail senden","Ereignisse als verarbeitet markieren"]'::jsonb)
ON CONFLICT (name) DO NOTHING;
