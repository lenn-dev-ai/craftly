-- ============================================================
-- Reparo: Security-Hardening Trigger-Nesting-Fix (2026-05-15)
-- ============================================================
-- Folgt auf 20260519100000_security_recursion_fix.sql.
--
-- Problem: protect_profile_fields + protect_ticket_fields blockieren
-- nicht nur direkte User-Updates, sondern auch Cascading-Updates aus
-- SECURITY-DEFINER-Triggern wie handle_nachtrag_genehmigt:
--
--   Verwalter genehmigt Nachtrag (nachtraege UPDATE)
--    └─→ trg_nachtrag_genehmigt feuert (SECURITY DEFINER)
--        └─→ UPDATE tickets SET kosten_final = …
--            └─→ trg_protect_ticket_fields feuert
--                  → auth.uid() = Verwalter
--                  → Verwalter ist nicht zugewiesener_hw / verwalter_id
--                    des Trigger-Subjects → block
--
--        └─→ UPDATE profiles SET angebotstreue = …
--            └─→ trg_protect_profile_fields feuert
--                  → auth.uid() = Verwalter, profile.id = Handwerker
--                  → block, alte angebotstreue bleibt (Test failt)
--
-- Lösung: pg_trigger_depth() > 1 → wir sind im nested Trigger-Call,
-- also kommt der Update von einer anderen Trigger-Funktion (typischerweise
-- SECURITY DEFINER mit eigener Authority-Logik). Bypass.
--
-- Direkte User-Updates aus der App haben pg_trigger_depth() = 1 →
-- Schutz greift weiterhin.
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Service-Role-Calls
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  -- Cascading-Update aus anderem Trigger (z. B. handle_nachtrag_genehmigt,
  -- update_bewertung_avg) — der hat eigene Authority-Logik
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  -- Admin
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
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;

  IF auth.uid() = OLD.verwalter_id THEN
    NEW.erstellt_von := OLD.erstellt_von;
    NEW.verwalter_id := OLD.verwalter_id;
    RETURN NEW;
  END IF;

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

  IF auth.uid() = OLD.zugewiesener_hw THEN
    v_befund_text     := NEW.befund_text;
    v_befund_fotos    := NEW.befund_fotos;
    v_befund_aufwand  := NEW.befund_aufwand_stunden;
    v_projekt_angebot := NEW.projekt_angebot;
    v_leistungsumfang := NEW.leistungsumfang;
    v_status          := NEW.status;

    NEW := OLD;

    NEW.befund_text             := v_befund_text;
    NEW.befund_fotos            := v_befund_fotos;
    NEW.befund_aufwand_stunden  := v_befund_aufwand;
    NEW.projekt_angebot         := v_projekt_angebot;
    NEW.leistungsumfang         := v_leistungsumfang;

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
