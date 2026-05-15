-- ============================================================
-- Reparo: Unzugewiesene Tickets für alle Verwalter sichtbar (2026-05-15)
-- ============================================================
-- Bug: Mieter erstellen Tickets in melden/page.tsx ohne objekt_id.
-- Der fill_verwalter_id_on_ticket-Trigger kann dann nichts auto-füllen
-- (Prio 1 braucht objekt_id, Prio 2 nur wenn Ersteller selbst Verwalter
-- ist). Resultat: verwalter_id = NULL.
--
-- Mit dem gestrigen Security-Hardening (tickets_select strict auf
-- verwalter_id = auth.uid()) sieht jetzt KEIN Verwalter mehr
-- Mieter-Tickets, und kann sie nicht annehmen → "Annehmen"-Button
-- wirkt klickfrei (Audit-Befund 1).
--
-- Fix:
-- 1. tickets_select: Verwalter sehen auch unzugewiesene Mieter-Tickets
-- 2. tickets_update (Trigger): Verwalter darf unzugewiesenes Mieter-
--    Ticket übernehmen (verwalter_id auf sich setzen)
-- 3. Backfill: bestehende verwalter_id-NULL-Tickets auf den ersten
--    aktiven Verwalter zuordnen (damit alte Daten konsistent werden;
--    in Beta-Phase mit nur 1 Verwalter ohnehin der richtige).
-- ============================================================

-- Helper: gibt es überhaupt unzugewiesene Tickets, die ein Verwalter
-- übernehmen darf? Nutzen wir in tickets_select.
CREATE OR REPLACE FUNCTION public.is_verwalter()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rolle = 'verwalter'
  );
$$;

-- ============================================================
-- 1. tickets_select um "verwalter_id IS NULL"-Branch erweitern
-- ============================================================
-- Verwalter sehen jetzt:
--   - eigene zugewiesene Tickets (verwalter_id = auth.uid())
--   - unzugewiesene Tickets (verwalter_id IS NULL und nicht erledigt)
-- Erledigte Unzugewiesene bleiben versteckt — die sind historisch.

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
    OR (
      verwalter_id IS NULL
      AND status <> 'erledigt'
      AND public.is_verwalter()
    )
  );

-- ============================================================
-- 2. protect_ticket_fields: Verwalter darf unzugewiesenes Ticket
--    übernehmen (verwalter_id = auth.uid() setzen) und dann normal
--    bearbeiten
-- ============================================================
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
  v_korridor_min    numeric;
  v_korridor_max    numeric;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;

  -- Bestehender Verwalter (verwalter_id matcht) — alles erlaubt außer
  -- erstellt_von / verwalter_id
  IF auth.uid() = OLD.verwalter_id THEN
    NEW.erstellt_von := OLD.erstellt_von;
    NEW.verwalter_id := OLD.verwalter_id;
    RETURN NEW;
  END IF;

  -- NEU: unzugewiesenes Ticket (OLD.verwalter_id IS NULL) wird von
  -- einem Verwalter übernommen. Erlaubt: verwalter_id auf sich selbst
  -- setzen (NEW.verwalter_id = auth.uid()) plus normales Update.
  IF OLD.verwalter_id IS NULL AND public.is_verwalter() THEN
    -- erstellt_von darf nicht geändert werden
    NEW.erstellt_von := OLD.erstellt_von;
    -- verwalter_id muss entweder NULL bleiben oder auf den aktuellen
    -- Verwalter gesetzt werden (kein Übernahme-Klau auf einen Dritten)
    IF NEW.verwalter_id IS NOT NULL AND NEW.verwalter_id <> auth.uid() THEN
      NEW.verwalter_id := OLD.verwalter_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Mieter-Branch (unverändert)
  IF auth.uid() = OLD.erstellt_von THEN
    IF OLD.status != 'offen' THEN
      RAISE EXCEPTION 'Mieter darf Ticket nach Status-Wechsel nicht mehr ändern (status=%)', OLD.status;
    END IF;
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

  -- Handwerker-Branch (unverändert, mit preiskorridor)
  IF auth.uid() = OLD.zugewiesener_hw THEN
    v_befund_text     := NEW.befund_text;
    v_befund_fotos    := NEW.befund_fotos;
    v_befund_aufwand  := NEW.befund_aufwand_stunden;
    v_projekt_angebot := NEW.projekt_angebot;
    v_leistungsumfang := NEW.leistungsumfang;
    v_status          := NEW.status;
    v_korridor_min    := NEW.preiskorridor_min;
    v_korridor_max    := NEW.preiskorridor_max;

    NEW := OLD;

    NEW.befund_text             := v_befund_text;
    NEW.befund_fotos            := v_befund_fotos;
    NEW.befund_aufwand_stunden  := v_befund_aufwand;
    NEW.projekt_angebot         := v_projekt_angebot;
    NEW.leistungsumfang         := v_leistungsumfang;
    NEW.preiskorridor_min       := v_korridor_min;
    NEW.preiskorridor_max       := v_korridor_max;

    IF v_status = 'in_bearbeitung' AND OLD.status IN ('auktion', 'in_bearbeitung') THEN
      NEW.status := v_status;
    ELSIF v_status = 'erledigt' AND OLD.status = 'in_bearbeitung' THEN
      NEW.status := v_status;
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to update ticket %', OLD.id;
END;
$$;

-- ============================================================
-- 3. tickets_update Policy: NULL-Branch ergänzen
-- ============================================================
DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
CREATE POLICY "tickets_update" ON public.tickets
  FOR UPDATE
  USING (
    auth.uid() = erstellt_von
    OR auth.uid() = zugewiesener_hw
    OR auth.uid() = verwalter_id
    OR public.is_admin()
    OR (verwalter_id IS NULL AND public.is_verwalter())
  );

-- ============================================================
-- 4. Backfill: bestehende Mieter-Tickets ohne verwalter_id
-- ============================================================
-- In der Beta-Phase ist nur 1 aktiver Verwalter zu erwarten. Bestehende
-- unzugewiesene Tickets werden ihm zugeordnet, damit der Bestand
-- nicht im Limbo bleibt. Wenn 0 Verwalter im System sind, no-op.
DO $$
DECLARE
  v_first_vw uuid;
BEGIN
  SELECT id INTO v_first_vw
  FROM public.profiles
  WHERE rolle = 'verwalter'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_first_vw IS NOT NULL THEN
    UPDATE public.tickets
       SET verwalter_id = v_first_vw
     WHERE verwalter_id IS NULL;
  END IF;
END $$;
