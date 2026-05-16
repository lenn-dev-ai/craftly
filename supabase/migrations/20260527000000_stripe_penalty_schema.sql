-- Stripe-Connect + Penalty-System für HW.
--
-- Hintergrund: Wenn ein HW die 14-Tage-Frist überschreitet, soll
-- automatisch eine Penalty (€20) berechnet werden. Die Buchung läuft
-- über Stripe Connect — der HW muss dafür einmal ein Express-Account
-- onboarden. Solange er das nicht hat, bleibt die Penalty als
-- "manual_pending" markiert und wird später (z. B. bei Auszahlung
-- über Reparo) verrechnet.
--
-- Idempotent: alle ALTER TABLE mit IF NOT EXISTS.

-- profiles: Stripe-Connect-Verbindung des HW
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_onboarded_at timestamptz;

-- tickets: Penalty-Tracking pro Frist-Überschreitung
-- status:
--   none            — keine Penalty fällig (Default)
--   manual_pending  — Penalty fällig, HW hat (noch) keinen Connect-Account
--                     oder Charge fehlgeschlagen → Reparo verbucht manuell
--   paid            — Stripe-Charge erfolgreich verbucht
--   failed          — Buchung fehlgeschlagen (z. B. card_declined)
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS penalty_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS penalty_amount_cents int,
  ADD COLUMN IF NOT EXISTS penalty_charge_id text,
  ADD COLUMN IF NOT EXISTS penalty_buchung_versucht_am timestamptz;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_penalty_status_check;
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_penalty_status_check
  CHECK (penalty_status IN ('none','manual_pending','paid','failed'));

-- protect_profile_fields um stripe_*-Felder erweitern.
-- Self-Update durch den HW könnte sonst "stripe_charges_enabled=true"
-- faken — die Penalty-Buchung würde dann gegen ein nicht-existentes
-- Konto laufen und fehlschlagen, ohne dass der HW echte Konsequenzen
-- spürt. Schutz: nur Service-Role (= Connect-Callback) darf das setzen.

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;

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

  NEW.verifiziert := OLD.verifiziert;
  NEW.verifiziert_am := OLD.verifiziert_am;
  NEW.verifiziert_von := OLD.verifiziert_von;

  -- NEU: Stripe-Connect-State wird nur per Service-Role-Client aus
  -- /api/stripe/connect/return gesetzt (nach Stripe-API-Roundtrip).
  NEW.stripe_account_id := OLD.stripe_account_id;
  NEW.stripe_charges_enabled := OLD.stripe_charges_enabled;
  NEW.stripe_payouts_enabled := OLD.stripe_payouts_enabled;
  NEW.stripe_onboarded_at := OLD.stripe_onboarded_at;

  RETURN NEW;
END;
$$;

-- Index für Cron-Queries (penalty_status='manual_pending' bei retry)
CREATE INDEX IF NOT EXISTS tickets_penalty_status_idx
  ON public.tickets (penalty_status)
  WHERE penalty_status IN ('manual_pending', 'failed');

COMMENT ON COLUMN public.profiles.stripe_account_id IS
  'Stripe Connect Express Account-ID (acct_...). NULL = HW hat noch kein Konto verbunden.';
COMMENT ON COLUMN public.profiles.stripe_charges_enabled IS
  'Spiegelt accounts.charges_enabled aus Stripe wider — nur dann können Penalty-Buchungen durchgeführt werden.';
COMMENT ON COLUMN public.tickets.penalty_status IS
  'Frist-Überschreitungs-Penalty: none|manual_pending|paid|failed.';
