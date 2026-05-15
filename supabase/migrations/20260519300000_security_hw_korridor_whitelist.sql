-- ============================================================
-- Reparo: HW-Whitelist um preiskorridor erweitern
-- ============================================================
-- /api/diagnose/befund-abgeben berechnet preiskorridor_min/max
-- server-seitig und schreibt sie via HW-User-Client. Mein erster
-- Trigger-Wurf hatte die Felder nicht in der HW-Whitelist → NULL
-- nach Speichern → diagnose-flow E2E-Test failt.
--
-- Risiko-Bewertung: HW könnte den Korridor zwar direkt-DB manipulieren,
-- aber er ist nur ein UX-Hinweis-Label im Verwalter-UI ("im Korridor").
-- Akzeptabel.
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
