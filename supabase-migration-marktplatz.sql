-- ============================================================
-- CRAFTLY — Migration: Marktplatz-Auktion mit dynamischem Pricing
-- In Supabase: SQL Editor → New query → diesen Code einfügen → Run
-- ============================================================

-- 1. Basis-Preis für Handwerker (Stundensatz/Pauschale)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS basis_preis numeric(10,2) DEFAULT 50;

-- 2. Gewerk-Feld für Tickets (welches Handwerk wird gebraucht?)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS gewerk text;

-- 3. Einladungen-Tabelle (Verwalter lädt Handwerker ein)
CREATE TABLE IF NOT EXISTS public.einladungen (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  handwerker_id uuid REFERENCES public.profiles(id),
  status text CHECK (status IN ('offen','angebot','abgelehnt')) DEFAULT 'offen',
  empfohlener_preis numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(ticket_id, handwerker_id)
);

-- 4. Row Level Security für Einladungen
ALTER TABLE public.einladungen ENABLE ROW LEVEL SECURITY;

-- Handwerker sehen ihre eigenen Einladungen
CREATE POLICY "einladungen_select_hw" ON public.einladungen
  FOR SELECT USING (
    auth.uid() = handwerker_id
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.erstellt_von = auth.uid())
  );

-- Verwalter erstellen Einladungen (für ihre eigenen Tickets)
CREATE POLICY "einladungen_insert" ON public.einladungen
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.erstellt_von = auth.uid())
  );

-- Verwalter + Handwerker können Einladungen updaten
CREATE POLICY "einladungen_update" ON public.einladungen
  FOR UPDATE USING (
    auth.uid() = handwerker_id
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.erstellt_von = auth.uid())
  );

-- 5. Ticket-Select erweitern: Handwerker sehen Tickets, zu denen sie eingeladen wurden
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
CREATE POLICY "tickets_select" ON public.tickets FOR SELECT USING (
  auth.uid() = erstellt_von
  OR status = 'auktion'
  OR auth.uid() = zugewiesener_hw
  OR EXISTS (SELECT 1 FROM public.einladungen e WHERE e.ticket_id = id AND e.handwerker_id = auth.uid())
);

-- 6. Demo-Daten: Handwerker Basis-Preise setzen (optional)
-- UPDATE public.profiles SET basis_preis = 65 WHERE rolle = 'handwerker' AND gewerk = 'sanitaer';
-- UPDATE public.profiles SET basis_preis = 55 WHERE rolle = 'handwerker' AND gewerk = 'elektro';
-- UPDATE public.profiles SET basis_preis = 70 WHERE rolle = 'handwerker' AND gewerk = 'heizung';
-- UPDATE public.profiles SET basis_preis = 45 WHERE rolle = 'handwerker' AND gewerk = 'maler';
