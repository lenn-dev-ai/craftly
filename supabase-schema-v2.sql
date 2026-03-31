-- ===============================================================
-- CRAFTLY — Vollständiges Datenbankschema v2
-- Supabase SQL Editor → Neue Query → Run
-- ===============================================================

-- 1. PROFILES (erweitert auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  name text,
  rolle text CHECK (rolle IN ('admin','verwalter','handwerker','mieter')),
  telefon text,
  firma text,
  gewerk text,
  plz_bereich text,
  basis_preis numeric(10,2) DEFAULT 50,
  bewertung_avg numeric(3,2) DEFAULT 0,
  auftraege_anzahl int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. OBJEKTE (Immobilien)
CREATE TABLE IF NOT EXISTS public.objekte (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  adresse text,
  plz text,
  verwalter_id uuid REFERENCES public.profiles(id),
  einheiten_anzahl int,
  created_at timestamptz DEFAULT now()
);

-- 3. TICKETS (Herzstück — Aufträge/Schadensmeldungen)
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titel text NOT NULL,
  beschreibung text,
  foto_url text,
  status text CHECK (status IN ('offen','auktion','in_bearbeitung','erledigt')) DEFAULT 'offen',
  prioritaet text CHECK (prioritaet IN ('normal','hoch','dringend')) DEFAULT 'normal',
  vergabemodus text CHECK (vergabemodus IN ('direkt','auktion')) DEFAULT 'auktion',
  gewerk text,
  wohnung text,
  objekt_id uuid REFERENCES public.objekte(id),
  erstellt_von uuid REFERENCES public.profiles(id),
  zugewiesener_hw uuid REFERENCES public.profiles(id),
  auktion_ende timestamptz,
  auktion_dauer_h int DEFAULT 24,
  kosten_final numeric(10,2),
  created_at timestamptz DEFAULT now()
);

-- 4. ANGEBOTE (Handwerker-Gebote auf Tickets)
CREATE TABLE IF NOT EXISTS public.angebote (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  handwerker_id uuid REFERENCES public.profiles(id),
  preis numeric(10,2) NOT NULL,
  fruehester_termin date,
  nachricht text,
  status text CHECK (status IN ('eingereicht','angenommen','abgelehnt')) DEFAULT 'eingereicht',
  created_at timestamptz DEFAULT now(),
  UNIQUE(ticket_id, handwerker_id)
);
-- 5. EINLADUNGEN (Verwalter lädt Handwerker direkt ein)
CREATE TABLE IF NOT EXISTS public.einladungen (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  handwerker_id uuid REFERENCES public.profiles(id),
  status text CHECK (status IN ('offen','angebot','abgelehnt')) DEFAULT 'offen',
  empfohlener_preis numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(ticket_id, handwerker_id)
);

-- 6. NACHRICHTEN (Ticket-Chat)
CREATE TABLE IF NOT EXISTS public.nachrichten (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  absender_id uuid REFERENCES public.profiles(id),
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 7. BEWERTUNGEN (nach Auftragsabschluss)
CREATE TABLE IF NOT EXISTS public.bewertungen (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  handwerker_id uuid REFERENCES public.profiles(id),
  bewerter_id uuid REFERENCES public.profiles(id),
  sterne int CHECK (sterne BETWEEN 1 AND 5) NOT NULL,
  kommentar text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(ticket_id, bewerter_id)
);

-- ===============================================================
-- ROW LEVEL SECURITY
-- ===============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objekte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.angebote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einladungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nachrichten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bewertungen ENABLE ROW LEVEL SECURITY;

-- PROFILES: Jeder sieht alle Profile (öffentliche Infos)
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- OBJEKTE: Verwalter sehen + verwalten ihre eigenen Objekte
CREATE POLICY "objekte_select" ON public.objekte FOR SELECT USING (
  verwalter_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin')
);
CREATE POLICY "objekte_insert" ON public.objekte FOR INSERT WITH CHECK (verwalter_id = auth.uid());
CREATE POLICY "objekte_update" ON public.objekte FOR UPDATE USING (verwalter_id = auth.uid());

-- TICKETS: Ersteller, zugewiesene HW, eingeladene HW, und offene Auktionen
CREATE POLICY "tickets_select" ON public.tickets FOR SELECT USING (
  auth.uid() = erstellt_von
  OR auth.uid() = zugewiesener_hw
  OR status = 'auktion'
  OR EXISTS (SELECT 1 FROM public.einladungen e WHERE e.ticket_id = id AND e.handwerker_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin')
);
CREATE POLICY "tickets_insert" ON public.tickets FOR INSERT WITH CHECK (auth.uid() = erstellt_von);
CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE USING (
  auth.uid() = erstellt_von
  OR auth.uid() = zugewiesener_hw
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin')
);

-- ANGEBOTE: Handwerker sehen eigene, Verwalter sehen Angebote zu eigenen Tickets
CREATE POLICY "angebote_select" ON public.angebote FOR SELECT USING (
  auth.uid() = handwerker_id
  OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.erstellt_von = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.rolle = 'admin')
);
CREATE POLICY "angebote_insert" ON public.angebote FOR INSERT WITH CHECK (auth.uid() = handwerker_id);
CREATE POLICY "angebote_update" ON public.angebote FOR UPDATE USING (
  auth.uid() = handwerker_id
  OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.erstellt_von = auth.uid())
);
-- EINLADUNGEN
CREATE POLICY "einladungen_select" ON public.einladungen FOR SELECT USING (
  auth.uid() = handwerker_id
  OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.erstellt_von = auth.uid())
);
CREATE POLICY "einladungen_insert" ON public.einladungen FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.erstellt_von = auth.uid())
);
CREATE POLICY "einladungen_update" ON public.einladungen FOR UPDATE USING (
  auth.uid() = handwerker_id
  OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.erstellt_von = auth.uid())
);

-- NACHRICHTEN: Beteiligte eines Tickets
CREATE POLICY "nachrichten_select" ON public.nachrichten FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = ticket_id
    AND (t.erstellt_von = auth.uid() OR t.zugewiesener_hw = auth.uid())
  )
  OR auth.uid() = absender_id
);
CREATE POLICY "nachrichten_insert" ON public.nachrichten FOR INSERT WITH CHECK (auth.uid() = absender_id);

-- BEWERTUNGEN
CREATE POLICY "bewertungen_select" ON public.bewertungen FOR SELECT USING (true);
CREATE POLICY "bewertungen_insert" ON public.bewertungen FOR INSERT WITH CHECK (auth.uid() = bewerter_id);

-- ===============================================================
-- FUNKTIONEN
-- ===============================================================

-- Automatisch Bewertungsdurchschnitt aktualisieren
CREATE OR REPLACE FUNCTION update_bewertung_avg()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET bewertung_avg = (
    SELECT ROUND(AVG(sterne)::numeric, 2)
    FROM public.bewertungen
    WHERE handwerker_id = NEW.handwerker_id
  )
  WHERE id = NEW.handwerker_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_bewertung_insert
  AFTER INSERT ON public.bewertungen
  FOR EACH ROW EXECUTE FUNCTION update_bewertung_avg();

-- Automatisch Auftragsanzahl hochzählen
CREATE OR REPLACE FUNCTION increment_auftraege()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'erledigt' AND OLD.status != 'erledigt' AND NEW.zugewiesener_hw IS NOT NULL THEN
    UPDATE public.profiles
    SET auftraege_anzahl = auftraege_anzahl + 1
    WHERE id = NEW.zugewiesener_hw;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ticket_erledigt
  AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION increment_auftraege();
