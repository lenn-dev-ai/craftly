-- ============================================================
-- Reparo: Diagnose-Pipeline Bug-Fixes (Mai 2026)
-- ============================================================
-- Ausführen in Supabase Studio → SQL Editor
-- Idempotent (kann mehrfach laufen)
--
-- Behebt:
--   BUG-2: ticket_typ CHECK enthielt 'projekt' nicht
--   BUG-4: tickets-SELECT-RLS prüfte zugewiesener_hw nicht
--   BUG-5: angebotstreue wurde bei Nachtrag-Genehmigung nicht
--          automatisch aktualisiert
--   BUG-6: provisionen.auftragswert/betrag wurde nach Nachtrag-
--          Genehmigung nicht angepasst
--
-- BUG-5+6 werden über einen After-Update-Trigger auf nachtraege
-- abgewickelt — der Trigger ist die einzige Schreib-Stelle für
-- diese drei Effekte. API-Code wurde entsprechend entschlackt.
-- ============================================================

-- ============================================================
-- BUG-2: ticket_typ-Constraint inkl. 'projekt'
-- ============================================================
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_ticket_typ_check;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_ticket_typ_check
  CHECK (ticket_typ IN ('standard', 'diagnose', 'projekt'));

-- ============================================================
-- BUG-4: tickets-SELECT-Policy inkl. zugewiesener_hw
-- ============================================================
DROP POLICY IF EXISTS tickets_select ON public.tickets;
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
DROP POLICY IF EXISTS "tickets_select_authenticated" ON public.tickets;

CREATE POLICY tickets_select ON public.tickets
  FOR SELECT TO authenticated
  USING (
    auth.uid() = erstellt_von
    OR auth.uid() = zugewiesener_hw
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.rolle IN ('admin', 'verwalter', 'handwerker')
    )
  );

-- Auktion-sichtbar für Handwerker bleibt über die separate Policy oben
-- (rolle = 'handwerker') abgedeckt — die schließt auch noch nicht
-- zugewiesene Auktions-Tickets ein.

-- ============================================================
-- BUG-5 + BUG-6: After-Update-Trigger auf nachtraege
-- ============================================================
-- Pfade die den Trigger auslösen:
--   1. Direkter INSERT mit status='genehmigt' (z. B. manueller DB-Edit)
--   2. UPDATE status='offen' → 'genehmigt' (Verwalter-Approval)
--   3. Bagatell-Auto-Genehmigung (API setzt status sofort auf 'genehmigt')
--
-- Was passiert:
--   1. tickets.kosten_final += nachtrag_betrag
--   2. provisionen-Snapshot wird mit dem neuen auftragswert geupdated
--      (rate bleibt aus Snapshot — sie hängt am Surge-Faktor zum
--      Vergabe-Zeitpunkt, nicht am Nachtrag)
--   3. profiles.angebotstreue wird komplett neu aus den letzten 365
--      Tagen genehmigter Nachträge berechnet:
--        Score = 100 − 5 × wesentlich − 15 × erheblich, [0..100]
--      Bagatell zählt NICHT.

CREATE OR REPLACE FUNCTION public.handle_nachtrag_genehmigt()
RETURNS TRIGGER AS $$
DECLARE
  v_neu_kosten numeric;
  v_rate numeric;
  v_betrag numeric;
  v_gesamt numeric;
  v_wesentlich int;
  v_erheblich int;
  v_score numeric;
  v_jetzt timestamptz := now();
BEGIN
  -- Nur reagieren wenn dieser Aufruf neu auf 'genehmigt' setzt
  IF NEW.status <> 'genehmigt' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'genehmigt' THEN
    RETURN NEW;
  END IF;

  -- 1) kosten_final hochsetzen
  UPDATE public.tickets
     SET kosten_final = COALESCE(kosten_final, 0) + NEW.nachtrag_betrag
   WHERE id = NEW.ticket_id
  RETURNING kosten_final INTO v_neu_kosten;

  -- 2) Provisions-Snapshot synchron halten (Rate bleibt fix)
  SELECT provision_rate INTO v_rate
    FROM public.provisionen
   WHERE ticket_id = NEW.ticket_id;

  IF v_rate IS NOT NULL AND v_neu_kosten IS NOT NULL THEN
    v_betrag := ROUND((v_neu_kosten * v_rate)::numeric, 2);
    v_gesamt := ROUND((v_neu_kosten + v_betrag)::numeric, 2);
    UPDATE public.provisionen
       SET auftragswert = v_neu_kosten,
           provision_betrag = v_betrag,
           gesamt = v_gesamt
     WHERE ticket_id = NEW.ticket_id;
  END IF;

  -- 3) Angebotstreue für den Handwerker neu berechnen (365-Tage-Fenster)
  SELECT
    COUNT(*) FILTER (WHERE stufe = 'wesentlich'),
    COUNT(*) FILTER (WHERE stufe = 'erheblich')
  INTO v_wesentlich, v_erheblich
  FROM public.nachtraege
  WHERE handwerker_id = NEW.handwerker_id
    AND status = 'genehmigt'
    AND created_at >= v_jetzt - interval '365 days';

  v_score := GREATEST(0, LEAST(100, 100 - 5 * v_wesentlich - 15 * v_erheblich));

  UPDATE public.profiles
     SET angebotstreue = v_score
   WHERE id = NEW.handwerker_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_nachtrag_genehmigt ON public.nachtraege;
CREATE TRIGGER trg_nachtrag_genehmigt
  AFTER INSERT OR UPDATE OF status ON public.nachtraege
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_nachtrag_genehmigt();

-- ============================================================
-- Smoke-Check (sollte sofort funktionieren):
--   SELECT angebotstreue FROM profiles WHERE id = '<handwerker-id>';
--   -- bei jeder Nachtrag-Genehmigung muss der Wert ggf. sinken
-- ============================================================
