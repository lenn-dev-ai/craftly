-- Sprint BD — Verwalter-Präferenzen ("Leitplanken" für die KI-Vergabe).
--
-- Strategie: "KI entscheidet, Mensch genehmigt." Damit der Verwalter die
-- automatische Vergabe vertrauensvoll laufen lassen kann, definiert er
-- einmalig Leitplanken — danach arbeitet die KI innerhalb dieser Grenzen.
--
-- Drei Felder auf profiles (verwalter-relevant, analog Sprint AX für HW):
--   auto_vergabe_aktiv     — Master-Schalter: übernimmt die KI die Vergabe
--                            automatisch? (default true = passiv/automatisch)
--   auto_vergabe_budget_eur— Über diesem geschätzten Auftragswert vergibt
--                            die KI NICHT automatisch, sondern lässt das
--                            Ticket für den Verwalter offen. NULL = kein Limit.
--   auto_freigabe_stunden  — Mieter-Tickets (zeitnah/planbar), die auf die
--                            Verwalter-Freigabe warten, werden nach X Stunden
--                            automatisch der Vergabe übergeben. NULL = nur
--                            manuelle Freigabe (Sicherheitsnetz bleibt aktiv).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_vergabe_aktiv      boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS auto_vergabe_budget_eur numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_freigabe_stunden   integer DEFAULT NULL;

COMMENT ON COLUMN public.profiles.auto_vergabe_aktiv      IS 'Sprint BD: Master-Schalter — KI vergibt Tickets automatisch (default true). false = Verwalter vergibt manuell.';
COMMENT ON COLUMN public.profiles.auto_vergabe_budget_eur IS 'Sprint BD: Budget-Grenze in € — über diesem geschätzten Auftragswert keine Auto-Vergabe, Ticket bleibt offen für den Verwalter. NULL = kein Limit.';
COMMENT ON COLUMN public.profiles.auto_freigabe_stunden   IS 'Sprint BD: Mieter-Tickets (zeitnah/planbar) werden nach X Stunden automatisch freigegeben/vergeben. NULL = nur manuelle Freigabe.';
