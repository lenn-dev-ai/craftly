-- ============================================================
-- Reparo: Security-Hardening Recursion-Fix (2026-05-15)
-- ============================================================
-- Folgt auf 20260519000000_security_hardening.sql.
--
-- Problem: tickets_select referenziert einladungen, deren Policy
-- wiederum tickets referenziert. Postgres erkennt die Zirkularität
-- und wirft "infinite recursion detected in policy".
--
-- Fix: EXISTS-Sub-Queries durch SECURITY-DEFINER-Helper-Functions
-- ersetzen — die umgehen RLS und brechen den Zyklus.
-- ============================================================

-- has_einladung: prüft ob auth.uid() für ein Ticket eingeladen ist
CREATE OR REPLACE FUNCTION public.has_einladung(_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.einladungen
    WHERE ticket_id = _ticket_id
      AND handwerker_id = auth.uid()
  );
$$;

-- can_bewerten: prüft ob auth.uid() eine Bewertung abgeben darf
-- (eigenes erledigtes Ticket, gegen den Handwerker, der es bearbeitet hat)
CREATE OR REPLACE FUNCTION public.can_bewerten(_ticket_id uuid, _handwerker_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets
    WHERE id = _ticket_id
      AND erstellt_von = auth.uid()
      AND status = 'erledigt'
      AND zugewiesener_hw = _handwerker_id
  );
$$;

-- is_handwerker: kleine Hilfe um die Marktplatz-Sicht für HW zu öffnen
CREATE OR REPLACE FUNCTION public.is_handwerker()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rolle = 'handwerker'
  );
$$;

-- ============================================================
-- tickets_select: Recursion-frei neu fassen
-- ============================================================
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
CREATE POLICY "tickets_select" ON public.tickets
  FOR SELECT TO authenticated
  USING (
    auth.uid() = erstellt_von
    OR auth.uid() = zugewiesener_hw
    OR auth.uid() = verwalter_id
    OR public.is_admin()
    OR (status = 'auktion' AND public.is_handwerker())
    OR public.has_einladung(id)
  );

-- ============================================================
-- bewertungen_insert: Recursion-frei via Helper
-- ============================================================
DROP POLICY IF EXISTS "bewertungen_insert" ON public.bewertungen;
CREATE POLICY "bewertungen_insert" ON public.bewertungen
  FOR INSERT
  WITH CHECK (
    auth.uid() = bewerter_id
    AND public.can_bewerten(ticket_id, handwerker_id)
  );

-- ============================================================
-- nachrichten_select: gleiche Falle vermeiden
-- ============================================================
-- Aktuelle Policy macht EXISTS (SELECT FROM tickets …) — sollte aber
-- nicht recursen (nachrichten ↛ tickets ↛ ?). tickets_select verweist
-- nicht auf nachrichten, also OK. Trotzdem zur Sicherheit prüfen.
-- (Kein Change nötig, aber explizit dokumentiert.)
