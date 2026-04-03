-- ===============================================================
-- REPARO â Yield Management Migration
-- Neue Tabellen fuer Zeitslot-Auktionen & dynamisches Pricing
-- ===============================================================

-- 1. ZEITSLOTS â Handwerker veroeffentlichen verfuegbare Zeiten
CREATE TABLE IF NOT EXISTS public.zeitslots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  handwerker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  titel text NOT NULL,
  gewerk text,
  datum date NOT NULL,
  von time NOT NULL,
  bis time NOT NULL,
  stunden numeric(4,1) GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (bis - von)) / 3600) STORED,
  basis_preis_stunde numeric(10,2) NOT NULL,
  dynamischer_preis numeric(10,2),
  preisfaktor numeric(4,2) DEFAULT 1.0,
  status text CHECK (status IN ('verfuegbar','reserviert','vergeben','abgelaufen')) DEFAULT 'verfuegbar',
  ist_luecke boolean DEFAULT false,
  notizen text,
  created_at timestamptz DEFAULT now()
);

-- 2. ZEITSLOT_GEBOTE â Verwalter bieten auf Handwerker-Zeitslots
CREATE TABLE IF NOT EXISTS public.zeitslot_gebote (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  zeitslot_id uuid REFERENCES public.zeitslots(id) ON DELETE CASCADE NOT NULL,
  verwalter_id uuid REFERENCES public.profiles(id) NOT NULL,
  ticket_id uuid REFERENCES public.tickets(id),
  gebotener_preis numeric(10,2) NOT NULL,
  wunsch_stunden numeric(4,1),
  nachricht text,
  status text CHECK (status IN ('offen','angenommen','abgelehnt','abgelaufen')) DEFAULT 'offen',
  created_at timestamptz DEFAULT now(),
  UNIQUE(zeitslot_id, verwalter_id)
);

-- 3. HANDWERKER_STATS â Aggregierte Einnahmen-Statistiken (materialized view)
CREATE TABLE IF NOT EXISTS public.handwerker_stats (
  handwerker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  woche_einnahmen numeric(10,2) DEFAULT 0,
  monat_einnahmen numeric(10,2) DEFAULT 0,
  gesamt_einnahmen numeric(10,2) DEFAULT 0,
  slots_diese_woche int DEFAULT 0,
  slots_naechste_woche int DEFAULT 0,
  auslastung_prozent numeric(5,2) DEFAULT 0,
  durchschnitt_stundensatz numeric(10,2) DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- ===============================================================
-- ROW LEVEL SECURITY
-- ===============================================================

ALTER TABLE public.zeitslots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zeitslot_gebote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handwerker_stats ENABLE ROW LEVEL SECURITY;

-- ZEITSLOTS: Handwerker verwalten eigene, alle sehen verfuegbare
CREATE POLICY "zeitslots_select" ON public.zeitslots FOR SELECT USING (
  handwerker_id = auth.uid()
  OR status = 'verfuegbar'
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin')
);
CREATE POLICY "zeitslots_insert" ON public.zeitslots FOR INSERT WITH CHECK (
  handwerker_id = auth.uid()
);
CREATE POLICY "zeitslots_update" ON public.zeitslots FOR UPDATE USING (
  handwerker_id = auth.uid()
);
CREATE POLICY "zeitslots_delete" ON public.zeitslots FOR DELETE USING (
  handwerker_id = auth.uid()
);

-- ZEITSLOT_GEBOTE: Verwalter bieten, Handwerker sehen Gebote auf eigene Slots
CREATE POLICY "gebote_select" ON public.zeitslot_gebote FOR SELECT USING (
  verwalter_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.zeitslots z WHERE z.id = zeitslot_id AND z.handwerker_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin')
);
CREATE POLICY "gebote_insert" ON public.zeitslot_gebote FOR INSERT WITH CHECK (
  verwalter_id = auth.uid()
);
CREATE POLICY "gebote_update" ON public.zeitslot_gebote FOR UPDATE USING (
  verwalter_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.zeitslots z WHERE z.id = zeitslot_id AND z.handwerker_id = auth.uid())
);

-- HANDWERKER_STATS: Nur eigene Stats
CREATE POLICY "stats_select" ON public.handwerker_stats FOR SELECT USING (
  handwerker_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin')
);
CREATE POLICY "stats_upsert" ON public.handwerker_stats FOR INSERT WITH CHECK (
  handwerker_id = auth.uid()
);
CREATE POLICY "stats_update" ON public.handwerker_stats FOR UPDATE USING (
  handwerker_id = auth.uid()
);

-- ===============================================================
-- FUNKTIONEN
-- ===============================================================

-- Dynamischen Preis berechnen basierend auf Nachfrage
CREATE OR REPLACE FUNCTION berechne_dynamischen_preis()
RETURNS TRIGGER AS $$
DECLARE
  nachfrage_count int;
  verfuegbar_count int;
  faktor numeric;
BEGIN
  -- Anzahl Gebote auf dieses Gewerk in dieser Woche
  SELECT COUNT(*) INTO nachfrage_count
  FROM public.zeitslot_gebote zg
  JOIN public.zeitslots z ON z.id = zg.zeitslot_id
  WHERE z.gewerk = NEW.gewerk
    AND z.datum BETWEEN NEW.datum - interval '3 days' AND NEW.datum + interval '3 days'
    AND zg.status = 'offen';

  -- Anzahl verfuegbarer Slots im gleichen Gewerk
  SELECT COUNT(*) INTO verfuegbar_count
  FROM public.zeitslots
  WHERE gewerk = NEW.gewerk
    AND datum BETWEEN NEW.datum - interval '3 days' AND NEW.datum + interval '3 days'
    AND status = 'verfuegbar'
    AND id != NEW.id;

  -- Surge-Faktor berechnen
  IF verfuegbar_count <= 1 THEN
    faktor := 1.5;
  ELSIF verfuegbar_count <= 3 THEN
    faktor := 1.25;
  ELSE
    faktor := 1.0;
  END IF;

  -- Nachfrage-Bonus
  IF nachfrage_count >= 5 THEN
    faktor := faktor * 1.3;
  ELSIF nachfrage_count >= 2 THEN
    faktor := faktor * 1.15;
  END IF;

  NEW.preisfaktor := ROUND(faktor::numeric, 2);
  NEW.dynamischer_preis := ROUND(NEW.basis_preis_stunde * faktor, 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER zeitslot_preis_trigger
  BEFORE INSERT OR UPDATE ON public.zeitslots
  FOR EACH ROW EXECUTE FUNCTION berechne_dynamischen_preis();

-- Abgelaufene Slots automatisch markieren
CREATE OR REPLACE FUNCTION expire_zeitslots()
RETURNS void AS $$
BEGIN
  UPDATE public.zeitslots
  SET status = 'abgelaufen'
  WHERE datum < CURRENT_DATE
    AND status = 'verfuegbar';

  UPDATE public.zeitslot_gebote
  SET status = 'abgelaufen'
  WHERE status = 'offen'
    AND EXISTS (
      SELECT 1 FROM public.zeitslots z
      WHERE z.id = zeitslot_id AND z.datum < CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql;
