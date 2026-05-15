-- ============================================================
-- Reparo: profiles.verifiziert — echte Verifizierung statt abgeleitet
-- ============================================================
-- Sprint 4 hat TrustBadges nur aus Aktivitätsdaten abgeleitet
-- (10+ Aufträge → "erfahren"). Für echte Trust ist eine manuell vom
-- Admin gesetzte verifiziert-Flag deutlich glaubwürdiger:
--   Admin prüft Gewerbeschein, Versicherung, Steuer-Nr → setzt Flag
--
-- Hier: nur die Spalte + Schutz im protect_profile_fields-Trigger.
-- Admin-UI in app/dashboard-admin/nutzer/page.tsx separat.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verifiziert boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verifiziert_am timestamptz,
  ADD COLUMN IF NOT EXISTS verifiziert_von uuid REFERENCES public.profiles(id);

-- Filter-Index — Admin-Übersicht "ungeprüfte HW" + Verwalter-Filter
CREATE INDEX IF NOT EXISTS idx_profiles_verifiziert
  ON public.profiles (verifiziert)
  WHERE rolle = 'handwerker';

-- ============================================================
-- protect_profile_fields erweitern: verifiziert/_am/_von in Whitelist
-- (= zurückrollen wenn nicht-Admin) damit normale User es nicht
-- selbst setzen können
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;

  -- Bestehende Schutz-Felder
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

  -- NEU: Verifizierung darf nur Admin setzen, sonst Selbst-Verifizierung
  -- möglich (Trust-Mechanismus wäre nutzlos).
  NEW.verifiziert := OLD.verifiziert;
  NEW.verifiziert_am := OLD.verifiziert_am;
  NEW.verifiziert_von := OLD.verifiziert_von;

  RETURN NEW;
END;
$$;
