-- ============================================================
-- WoonWoon (REK Berlin Home Service): Digitale Selbstauskunft
-- ============================================================
-- Baustein 1 der Vermietungs-Digitalisierung: Interessenten füllen die
-- Selbstauskunft über einen Token-Link online aus, statt PDFs zu mailen.
--
-- Hinweis: Die Original-Datei woonwoon_selbstauskunft_schema.sql aus dem
-- Brief lag nicht vor — dieses Schema ist die v1-Rekonstruktion aus dem
-- Feldkatalog des Briefs (Einkommen ja / Bankverbindung nein, Mietdauer
-- 3–12 Monate, Paket standard|premium exklusiv). Unbekannte Zusatzfelder
-- landen in selbstauskuenfte.daten (JSONB) und überleben so spätere
-- Katalog-Abweichungen ohne Schemaänderung.
--
-- Sicherheitsmodell:
--   * anon hat KEINE direkten Tabellenrechte (RLS deny-all, keine Policies
--     für anon). Einreichen geht ausschließlich über die SECURITY-DEFINER-
--     RPC selbstauskunft_einreichen(), die das Token serverseitig prüft —
--     ohne gültiges Token ist kein Insert möglich, Auslesen nie.
--   * Interner Lesezugriff (Vermietungskoordination): authenticated mit
--     profiles.rolle in ('admin','verwalter').
--   * Dokumente liegen im privaten Bucket selbstauskunft-dokumente.

-- ------------------------------------------------------------
-- 1) Tabellen
-- ------------------------------------------------------------

-- Anfrage = ein konkreter Vermietungs-Fall (Interessent × Wohnung).
-- Das Token ist der einzige Schlüssel, den der Interessent je sieht.
CREATE TABLE IF NOT EXISTS public.anfragen (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token              uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  objekt             text,                 -- Wohnungs-/Inseratsbezeichnung
  interessent_name   text,
  interessent_email  text,
  status             text NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen', 'eingereicht', 'in_pruefung', 'angenommen', 'abgelehnt')),
  gueltig_bis        timestamptz,          -- optionaler Token-Ablauf (NULL = unbegrenzt)
  eingereicht_am     timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Genau eine Selbstauskunft je Anfrage (UNIQUE anfrage_id).
-- Bewusst KEINE Bankverbindung (Prozessanalyse-Entscheidung).
CREATE TABLE IF NOT EXISTS public.selbstauskuenfte (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anfrage_id          uuid NOT NULL UNIQUE REFERENCES public.anfragen(id) ON DELETE CASCADE,
  -- Person
  vorname             text NOT NULL,
  nachname            text NOT NULL,
  geburtsdatum        date NOT NULL,
  email               text NOT NULL,
  telefon             text NOT NULL,
  -- Aktuelle Anschrift
  strasse             text NOT NULL,
  plz                 text NOT NULL,
  ort                 text NOT NULL,
  -- Beruf & Einkommen (Bankverbindung bewusst nicht erhoben)
  beruf               text NOT NULL,
  arbeitgeber         text,
  netto_einkommen_eur numeric(10,2) NOT NULL CHECK (netto_einkommen_eur >= 0),
  -- Haushalt
  anzahl_personen     int NOT NULL DEFAULT 1 CHECK (anzahl_personen BETWEEN 1 AND 20),
  haustiere           boolean NOT NULL DEFAULT false,
  raucher             boolean NOT NULL DEFAULT false,
  -- Mietwunsch
  einzug_ab           date NOT NULL,
  mietdauer_monate    int NOT NULL CHECK (mietdauer_monate BETWEEN 3 AND 12),
  paket               text NOT NULL CHECK (paket IN ('standard', 'premium')),
  -- Alle übrigen / künftigen Felder (Anrede, Haustier-Details, Erklärungen …)
  daten               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Upload-Referenzen (Dateien selbst liegen im Storage-Bucket).
CREATE TABLE IF NOT EXISTS public.dokumente (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selbstauskunft_id  uuid NOT NULL REFERENCES public.selbstauskuenfte(id) ON DELETE CASCADE,
  anfrage_id         uuid NOT NULL REFERENCES public.anfragen(id) ON DELETE CASCADE,
  typ                text NOT NULL CHECK (typ IN ('gehaltsnachweis', 'ausweis', 'sonstiges')),
  storage_pfad       text NOT NULL,        -- Pfad im Bucket selbstauskunft-dokumente
  dateiname          text NOT NULL,
  mime_type          text,
  groesse_bytes      bigint,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anfragen_token       ON public.anfragen (token);
CREATE INDEX IF NOT EXISTS idx_dokumente_anfrage    ON public.dokumente (anfrage_id);

-- updated_at automatisch pflegen
CREATE OR REPLACE FUNCTION public.anfragen_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anfragen_updated_at ON public.anfragen;
CREATE TRIGGER trg_anfragen_updated_at
  BEFORE UPDATE ON public.anfragen
  FOR EACH ROW EXECUTE FUNCTION public.anfragen_touch_updated_at();

-- ------------------------------------------------------------
-- 2) Row Level Security
-- ------------------------------------------------------------
-- Deny-by-default: RLS an, für anon existiert KEINE Policy →
-- der anon-Key kann weder lesen noch direkt schreiben.

ALTER TABLE public.anfragen         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selbstauskuenfte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dokumente        ENABLE ROW LEVEL SECURITY;

-- Interner Vollzugriff (lesen) für die Vermietungskoordination.
-- (select auth.uid()) statt auth.uid() — InitPlan-Optimierung wie im
-- restlichen Projekt (Sprint CJ).
CREATE OR REPLACE FUNCTION public.ist_vermietungskoordination()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND rolle IN ('admin', 'verwalter')
  );
$$;

DROP POLICY IF EXISTS anfragen_select_intern ON public.anfragen;
CREATE POLICY anfragen_select_intern
  ON public.anfragen FOR SELECT TO authenticated
  USING (public.ist_vermietungskoordination());

DROP POLICY IF EXISTS selbstauskuenfte_select_intern ON public.selbstauskuenfte;
CREATE POLICY selbstauskuenfte_select_intern
  ON public.selbstauskuenfte FOR SELECT TO authenticated
  USING (public.ist_vermietungskoordination());

DROP POLICY IF EXISTS dokumente_select_intern ON public.dokumente;
CREATE POLICY dokumente_select_intern
  ON public.dokumente FOR SELECT TO authenticated
  USING (public.ist_vermietungskoordination());

-- ------------------------------------------------------------
-- 3) RPCs für den anonymen Formular-Flow (Token-gated)
-- ------------------------------------------------------------

-- Token → minimale Anfrage-Infos fürs Formular (kein Datenleck: nur
-- Objekt, Name, Status). NULL wenn Token unbekannt oder abgelaufen.
CREATE OR REPLACE FUNCTION public.anfrage_by_token(p_token uuid)
RETURNS TABLE (objekt text, interessent_name text, status text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.objekt, a.interessent_name, a.status
  FROM public.anfragen a
  WHERE a.token = p_token
    AND (a.gueltig_bis IS NULL OR a.gueltig_bis > now());
$$;

-- Kanonischer (und einziger) Schreibpfad für anon: prüft das Token,
-- legt Selbstauskunft + Dokument-Referenzen atomar an und setzt die
-- Anfrage auf 'eingereicht'. Doppel-Einreichung wird abgewiesen.
--
-- p_selbstauskunft: JSONB mit den bekannten Spalten + Rest in "daten".
-- p_dokumente:      JSONB-Array [{typ, storage_pfad, dateiname, mime_type, groesse_bytes}]
CREATE OR REPLACE FUNCTION public.selbstauskunft_einreichen(
  p_token uuid,
  p_selbstauskunft jsonb,
  p_dokumente jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anfrage public.anfragen%ROWTYPE;
  v_id uuid;
  v_dok jsonb;
BEGIN
  SELECT * INTO v_anfrage
  FROM public.anfragen
  WHERE token = p_token
    AND (gueltig_bis IS NULL OR gueltig_bis > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOKEN_UNGUELTIG' USING ERRCODE = 'P0001';
  END IF;

  IF v_anfrage.status <> 'offen' THEN
    RAISE EXCEPTION 'BEREITS_EINGEREICHT' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.selbstauskuenfte (
    anfrage_id, vorname, nachname, geburtsdatum, email, telefon,
    strasse, plz, ort, beruf, arbeitgeber, netto_einkommen_eur,
    anzahl_personen, haustiere, raucher, einzug_ab, mietdauer_monate,
    paket, daten
  ) VALUES (
    v_anfrage.id,
    p_selbstauskunft->>'vorname',
    p_selbstauskunft->>'nachname',
    (p_selbstauskunft->>'geburtsdatum')::date,
    p_selbstauskunft->>'email',
    p_selbstauskunft->>'telefon',
    p_selbstauskunft->>'strasse',
    p_selbstauskunft->>'plz',
    p_selbstauskunft->>'ort',
    p_selbstauskunft->>'beruf',
    p_selbstauskunft->>'arbeitgeber',
    (p_selbstauskunft->>'netto_einkommen_eur')::numeric,
    COALESCE((p_selbstauskunft->>'anzahl_personen')::int, 1),
    COALESCE((p_selbstauskunft->>'haustiere')::boolean, false),
    COALESCE((p_selbstauskunft->>'raucher')::boolean, false),
    (p_selbstauskunft->>'einzug_ab')::date,
    (p_selbstauskunft->>'mietdauer_monate')::int,
    p_selbstauskunft->>'paket',
    COALESCE(p_selbstauskunft->'daten', '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  FOR v_dok IN SELECT * FROM jsonb_array_elements(p_dokumente)
  LOOP
    -- Pfad-Bindung: ein direkter RPC-Aufruf mit erratenem Token soll keine
    -- beliebigen Storage-Pfade referenzieren können.
    IF (v_dok->>'storage_pfad') IS NULL
       OR (v_dok->>'storage_pfad') NOT LIKE p_token::text || '/%' THEN
      RAISE EXCEPTION 'DOKUMENT_PFAD_UNGUELTIG' USING ERRCODE = 'P0003';
    END IF;

    INSERT INTO public.dokumente (
      selbstauskunft_id, anfrage_id, typ, storage_pfad,
      dateiname, mime_type, groesse_bytes
    ) VALUES (
      v_id,
      v_anfrage.id,
      v_dok->>'typ',
      v_dok->>'storage_pfad',
      v_dok->>'dateiname',
      v_dok->>'mime_type',
      (v_dok->>'groesse_bytes')::bigint
    );
  END LOOP;

  UPDATE public.anfragen
  SET status = 'eingereicht', eingereicht_am = now()
  WHERE id = v_anfrage.id;

  RETURN v_id;
END;
$$;

-- Nur die RPCs sind für anon aufrufbar — keinerlei Tabellen-Grants.
-- (Supabase vergibt per Default-Privileges sonst Rechte an anon.)
REVOKE ALL ON public.anfragen, public.selbstauskuenfte, public.dokumente FROM anon;
GRANT SELECT ON public.anfragen, public.selbstauskuenfte, public.dokumente TO authenticated;
GRANT EXECUTE ON FUNCTION public.anfrage_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.selbstauskunft_einreichen(uuid, jsonb, jsonb) TO anon, authenticated;

-- ------------------------------------------------------------
-- 4) Storage-Bucket für Uploads (privat)
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'selbstauskunft-dokumente',
  'selbstauskunft-dokumente',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Lesen: nur Vermietungskoordination. Uploads laufen serverseitig über
-- den Service-Role-Key (API-Route) — keine anon-Policies nötig.
DROP POLICY IF EXISTS selbstauskunft_dok_select_intern ON storage.objects;
CREATE POLICY selbstauskunft_dok_select_intern
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'selbstauskunft-dokumente'
    AND public.ist_vermietungskoordination()
  );
