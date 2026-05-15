-- ============================================================
-- Reparo: Security-Hardening (2026-05-15)
-- ============================================================
-- Behebt 8 Schwachstellen aus dem Pen-Test (tests/security/pen-tests.ts):
--
--  CRITICAL
--   1. Mieter konnte profiles.rolle auf 'admin' setzen → Privilege Escalation
--   2. Zugewiesener HW konnte tickets.kosten_final beliebig erhöhen
--   3. Zugewiesener HW konnte tickets.verwalter_id auf sich selbst kapern
--      → Verwalter-Rechte am Ticket übernehmen
--
--  HIGH
--   4. Mieter konnte fremde Tickets bewerten (bewertungen_insert nahm
--      nur bewerter_id check, alte und neue Policy parallel aktiv)
--
--  MEDIUM
--   5. Mieter konnte eigenes Ticket direkt auf 'erledigt' setzen
--      (Workflow-Bypass)
--   6. Fremde Handwerker sahen alle in_bearbeitung-Tickets
--      (tickets_select aus diagnose-fixes erlaubte rolle='handwerker'
--      ohne Status-Einschränkung)
--   7. Mieter bewerten vor 'erledigt' (selbe Wurzel wie #4)
--   8. Anonyme Visitors lesen profiles inkl. email
--
-- Ansatz:
--   - Helper-Function `is_admin()` für DRY
--   - BEFORE-UPDATE-Trigger für column-level Schutz auf profiles + tickets
--     (RLS hat keine column-level Granularität in Postgres)
--   - Konsolidierte Policies: alte Duplikate droppen, eindeutige Versionen
--
-- Service-Role-Calls (auth.uid() IS NULL) bleiben unangetastet.
-- ============================================================

-- ============================================================
-- 0. Helper: is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rolle = 'admin'
  );
$$;

-- ============================================================
-- 1. profiles: Trigger gegen Privilege-Escalation
-- ============================================================
-- Das Problem: profiles_update_own erlaubt UPDATE auf eigenes Profil.
-- Postgres-RLS kennt aber kein column-level — der User darf damit
-- ALLE Spalten ändern, inkl. rolle, email, bewertung_avg, …
--
-- Lösung: BEFORE-UPDATE-Trigger der nicht-erlaubte Spalten auf OLD
-- zurückrollt (Whitelist-Ansatz). Service-Role + Admin bypassen.

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Service-Role-Calls (Cron, API mit createServiceRoleClient): durchlassen
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  -- Admin: darf alles
  IF public.is_admin() THEN RETURN NEW; END IF;

  -- Sonst: kritische Felder zurückrollen
  NEW.rolle := OLD.rolle;
  NEW.email := OLD.email;
  NEW.bewertung_avg := OLD.bewertung_avg;
  NEW.auftraege_anzahl := OLD.auftraege_anzahl;
  NEW.angebotstreue := OLD.angebotstreue;
  NEW.verfuegbarkeit_score := OLD.verfuegbarkeit_score;
  NEW.sichtbarkeit_stufe := OLD.sichtbarkeit_stufe;
  NEW.early_adopter_bis := OLD.early_adopter_bis;
  NEW.kalender_streak := OLD.kalender_streak;
  NEW.letzte_kalender_pflege := OLD.letzte_kalender_pflege;
  NEW.letzte_reaktivierung_mail := OLD.letzte_reaktivierung_mail;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

-- profiles_update_own erweitern um Admin
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- ============================================================
-- 2. profiles: Anon-User aussperren
-- ============================================================
-- Vorher: USING (true) → auch Logout-Visitors lesen alle Profile inkl. email.
-- Jetzt: nur authenticated.

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 3. tickets: Trigger gegen Mass-Assignment
-- ============================================================
-- Problem: tickets_update USING (auth.uid() = zugewiesener_hw OR …)
-- erlaubt dem HW jede Spalte zu setzen — kosten_final, verwalter_id,
-- surge_faktor, status (Workflow-Bypass), …
--
-- Whitelist pro Rolle:
--   Admin / Service-Role: alles
--   Verwalter (verwalter_id): alles außer erstellt_von, verwalter_id
--   Mieter (erstellt_von): nur titel, beschreibung, gewerk, dringlichkeit,
--                          einsatzort_* — und nur solange status='offen'
--   HW (zugewiesener_hw): nur Befund-Felder + status (in_bearbeitung,
--                         erledigt) und nur als Workflow-Übergang

CREATE OR REPLACE FUNCTION public.protect_ticket_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_befund_text     text;
  v_befund_fotos    text[];
  v_befund_aufwand  numeric;
  v_projekt_angebot numeric;
  v_leistungsumfang text[];
  v_status          text;
BEGIN
  -- Service-Role: bypass
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  -- Admin: bypass
  IF public.is_admin() THEN RETURN NEW; END IF;

  -- Verwalter (Ticket-Owner): darf fast alles, nur Identitäts-Felder fix
  IF auth.uid() = OLD.verwalter_id THEN
    NEW.erstellt_von := OLD.erstellt_von;
    NEW.verwalter_id := OLD.verwalter_id;
    RETURN NEW;
  END IF;

  -- Mieter (Ersteller, ohne verwalter-Rolle): nur im 'offen'-Status
  IF auth.uid() = OLD.erstellt_von THEN
    IF OLD.status != 'offen' THEN
      RAISE EXCEPTION 'Mieter darf Ticket nach Status-Wechsel nicht mehr ändern (status=%)', OLD.status;
    END IF;
    -- Whitelist: was Mieter setzen darf, bleibt aus NEW. Rest aus OLD.
    NEW.status := OLD.status;
    NEW.zugewiesener_hw := OLD.zugewiesener_hw;
    NEW.kosten_final := OLD.kosten_final;
    NEW.surge_faktor := OLD.surge_faktor;
    NEW.verwalter_id := OLD.verwalter_id;
    NEW.erstellt_von := OLD.erstellt_von;
    NEW.auktion_start := OLD.auktion_start;
    NEW.auktion_ende := OLD.auktion_ende;
    NEW.vorkaufsrecht_bis := OLD.vorkaufsrecht_bis;
    NEW.befund_text := OLD.befund_text;
    NEW.befund_fotos := OLD.befund_fotos;
    NEW.befund_aufwand_stunden := OLD.befund_aufwand_stunden;
    NEW.projekt_angebot := OLD.projekt_angebot;
    NEW.leistungsumfang := OLD.leistungsumfang;
    NEW.preiskorridor_min := OLD.preiskorridor_min;
    NEW.preiskorridor_max := OLD.preiskorridor_max;
    NEW.diagnosegebuehr_angerechnet := OLD.diagnosegebuehr_angerechnet;
    NEW.diagnose_ticket_id := OLD.diagnose_ticket_id;
    NEW.ticket_typ := OLD.ticket_typ;
    NEW.bewertung_reminder_gesendet := OLD.bewertung_reminder_gesendet;
    RETURN NEW;
  END IF;

  -- Handwerker (zugewiesener): nur Befund-Felder + Workflow-Status
  IF auth.uid() = OLD.zugewiesener_hw THEN
    -- Whitelist-Werte zwischenspeichern
    v_befund_text     := NEW.befund_text;
    v_befund_fotos    := NEW.befund_fotos;
    v_befund_aufwand  := NEW.befund_aufwand_stunden;
    v_projekt_angebot := NEW.projekt_angebot;
    v_leistungsumfang := NEW.leistungsumfang;
    v_status          := NEW.status;

    -- Alles aus OLD übernehmen
    NEW := OLD;

    -- Whitelist neu setzen
    NEW.befund_text             := v_befund_text;
    NEW.befund_fotos            := v_befund_fotos;
    NEW.befund_aufwand_stunden  := v_befund_aufwand;
    NEW.projekt_angebot         := v_projekt_angebot;
    NEW.leistungsumfang         := v_leistungsumfang;

    -- Status: nur Workflow-Übergänge erlauben
    --   auktion          -> in_bearbeitung   (HW gewinnt selbst, Edge-Case)
    --   in_bearbeitung   -> erledigt
    IF v_status = 'in_bearbeitung' AND OLD.status IN ('auktion', 'in_bearbeitung') THEN
      NEW.status := v_status;
    ELSIF v_status = 'erledigt' AND OLD.status = 'in_bearbeitung' THEN
      NEW.status := v_status;
    END IF;

    RETURN NEW;
  END IF;

  -- Andere User: RLS sollte schon blocken, aber Defense-in-Depth
  RAISE EXCEPTION 'Not allowed to update ticket %', OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_ticket_fields ON public.tickets;
CREATE TRIGGER trg_protect_ticket_fields
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_ticket_fields();

-- ============================================================
-- 4. tickets_update Policy nochmal sauber konsolidieren
-- ============================================================
-- Es gab parallel: schema-v2 + diagnose-fixes. Jetzt eine einzige Quelle.

DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
CREATE POLICY "tickets_update" ON public.tickets
  FOR UPDATE
  USING (
    auth.uid() = erstellt_von
    OR auth.uid() = zugewiesener_hw
    OR auth.uid() = verwalter_id
    OR public.is_admin()
  );

-- ============================================================
-- 5. tickets_select: HW-Branch enger ziehen
-- ============================================================
-- Vorher (diagnose-fixes): rolle = 'handwerker' → sah ALLE Tickets,
-- auch fremde in_bearbeitung-Tickets.
-- Jetzt: HW sieht nur Auktionen + eigene zugewiesene + Einladungen.

DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
CREATE POLICY "tickets_select" ON public.tickets
  FOR SELECT TO authenticated
  USING (
    auth.uid() = erstellt_von
    OR auth.uid() = zugewiesener_hw
    OR auth.uid() = verwalter_id
    OR public.is_admin()
    OR (
      status = 'auktion'
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND rolle = 'handwerker'
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.einladungen e
      WHERE e.ticket_id = id AND e.handwerker_id = auth.uid()
    )
  );

-- ============================================================
-- 6. bewertungen: einheitliche strict-Insert-Policy
-- ============================================================
-- Vorher: parallele Policies — schema-v2 lasch, e2e-flow strict.
-- PostgreSQL ODER-verknüpft Policies → laxere gewinnt.

DROP POLICY IF EXISTS "bewertungen_insert" ON public.bewertungen;
DROP POLICY IF EXISTS "bewertungen_insert_eigenes_ticket" ON public.bewertungen;

CREATE POLICY "bewertungen_insert" ON public.bewertungen
  FOR INSERT
  WITH CHECK (
    auth.uid() = bewerter_id
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
        AND t.erstellt_von = auth.uid()
        AND t.status = 'erledigt'
        AND t.zugewiesener_hw = handwerker_id
    )
  );

-- ============================================================
-- Smoke-Checks (manuell in Studio):
--   SELECT public.is_admin();
--   -- als normaler User: false
--   UPDATE profiles SET rolle = 'admin' WHERE id = auth.uid();
--   SELECT rolle FROM profiles WHERE id = auth.uid();
--   -- → bleibt 'mieter'/'handwerker'/'verwalter' (Trigger greift)
-- ============================================================
